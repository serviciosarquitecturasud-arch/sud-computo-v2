/**
 * DIARIO de obra (H8a) — jornales por día, fijos semanales y adelantos.
 * Mobile-first: el usuario carga desde el celular parado en la obra.
 * Una columna, botones grandes, teclado numérico; el cierre replica su
 * planilla: TOTAL SEMANA / − adelantos / NETO A PAGAR (el viernes).
 */
import { useState } from 'react';
import {
  adelantosDeSemana,
  costoJornalDia,
  lunesDeSemana,
  money,
  resumenSemana,
  sumarDias,
  tarifasDerivadas,
  tarifasDiario,
  uid
} from '../../core';
import type { AdelantoPersonal, DiarioObra, JornalDia, Motor, Obra } from '../../core';
import { Badge, Btn, Card, SectionTitle } from '../../ui/base';
import { EditCell } from '../../ui/edit';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

function fmtCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
}

const DIARIO_VACIO: DiarioObra = { jornales: [], fijos: [], adelantos: [] };

/** Stepper grande para cargar of/ay con el pulgar (+1 / −1 / +½). */
function Stepper({
  label,
  valor,
  onChange
}: {
  label: string;
  valor: number;
  onChange: (v: number) => void;
}) {
  const btn =
    'flex h-10 w-10 items-center justify-center rounded-md border border-[var(--borde)] ' +
    'bg-[var(--panel)] text-lg font-medium active:bg-[var(--color-neutro-100)] ' +
    'dark:active:bg-[var(--color-neutro-800)]';
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 text-xs font-semibold uppercase tracking-wide text-[var(--texto-2)]">
        {label}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, valor - 1))} aria-label={`quitar ${label}`}>
        −
      </button>
      <input
        className="h-10 w-14 rounded-md border border-[var(--borde)] bg-[var(--panel)] text-center text-base tabular-nums focus:outline-2 focus:outline-[var(--color-sud-azul)]"
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        value={valor}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      <button type="button" className={btn} onClick={() => onChange(valor + 1)} aria-label={`sumar ${label}`}>
        +
      </button>
      <button
        type="button"
        className={btn + ' w-12 text-sm'}
        onClick={() => onChange(valor + 0.5)}
        title="Medio jornal (medio ayudante, media jornada)"
      >
        +½
      </button>
    </div>
  );
}

export function ObraDiario({
  obra,
  setObra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  motor: Motor;
}) {
  const [lunes, setLunes] = useState(() => lunesDeSemana(hoyISO()));
  const diario: DiarioObra = obra.diario ?? DIARIO_VACIO;
  const setDiario = (d: DiarioObra) => setObra({ ...obra, diario: d });

  const tarifas = tarifasDiario(obra, motor);
  const derivadas = tarifasDerivadas(obra, motor);
  const conOverride = !!diario.tarifas;

  const jornalDe = (fecha: string): JornalDia | undefined =>
    diario.jornales.find((j) => j.fecha === fecha);

  const setJornal = (fecha: string, patch: Partial<JornalDia>) => {
    const previo = jornalDe(fecha);
    const nuevo: JornalDia = {
      id: previo?.id ?? uid(),
      fecha,
      of: previo?.of ?? 0,
      ay: previo?.ay ?? 0,
      ...(previo?.nota ? { nota: previo.nota } : {}),
      ...patch
    };
    if (!(nuevo.nota ?? '').trim()) delete nuevo.nota;
    const vacio = !nuevo.of && !nuevo.ay && !nuevo.nota;
    const jornales = vacio
      ? diario.jornales.filter((j) => j.fecha !== fecha)
      : previo
        ? diario.jornales.map((j) => (j.fecha === fecha ? nuevo : j))
        : [...diario.jornales, nuevo];
    setDiario({ ...diario, jornales });
  };

  const setTarifa = (campo: 'of' | 'ay', v: string) => {
    const n = Number(v) || 0;
    if (n <= 0) return;
    setDiario({ ...diario, tarifas: { of: tarifas.of, ay: tarifas.ay, [campo]: n } });
  };

  const r = resumenSemana(diario, lunes, tarifas);
  const adelSem = adelantosDeSemana(diario.adelantos, lunes);
  const esSemanaActual = lunes === lunesDeSemana(hoyISO());

  const [adPersona, setAdPersona] = useState('');
  const [adMonto, setAdMonto] = useState('');

  const agregarAdelanto = () => {
    const monto = Number(adMonto) || 0;
    if (!adPersona.trim() || monto <= 0) return;
    const hoy = hoyISO();
    const a: AdelantoPersonal = {
      id: uid(),
      fecha: lunes <= hoy && hoy <= sumarDias(lunes, 6) ? hoy : lunes,
      persona: adPersona.trim(),
      monto
    };
    setDiario({ ...diario, adelantos: [...diario.adelantos, a] });
    setAdPersona('');
    setAdMonto('');
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Selector de semana */}
      <div className="flex items-center justify-between gap-2">
        <Btn onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="semana anterior">‹</Btn>
        <div className="text-center">
          <div className="font-marca text-lg">
            Semana del {fmtCorta(lunes)} al {fmtCorta(sumarDias(lunes, 6))}
          </div>
          {!esSemanaActual && (
            <button
              className="text-xs text-[var(--color-sud-azul)] underline-offset-2 hover:underline"
              onClick={() => setLunes(lunesDeSemana(hoyISO()))}
            >
              volver a hoy
            </button>
          )}
        </div>
        <Btn onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="semana siguiente">›</Btn>
      </div>

      {/* Tarifas de jornal diario */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Jornal diario</SectionTitle>
          {conOverride && (
            <button
              className="mb-3 text-xs text-[var(--texto-2)] underline-offset-2 hover:underline"
              onClick={() => {
                const { tarifas: _t, ...resto } = diario;
                setDiario({ ...resto });
              }}
            >
              restablecer catálogo
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Oficial ($/día)</span>
            <EditCell tipo="number" value={tarifas.of} onCommit={(v) => setTarifa('of', v)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Ayudante ($/día)</span>
            <EditCell tipo="number" value={tarifas.ay} onCommit={(v) => setTarifa('ay', v)} />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-[var(--texto-2)]">
          Del catálogo (valor hora × 8): oficial {money(derivadas.of)} · ayudante {money(derivadas.ay)}.
        </p>
      </Card>

      {/* Grilla lun–sáb */}
      <div className="space-y-2">
        {DIAS.map((nom, i) => {
          const fecha = sumarDias(lunes, i);
          const j = jornalDe(fecha);
          const of = j?.of ?? 0;
          const ay = j?.ay ?? 0;
          const costo = costoJornalDia({ of, ay }, tarifas);
          const esHoy = fecha === hoyISO();
          return (
            <Card key={fecha} className={'p-3 ' + (esHoy ? 'border-[var(--color-sud-azul)]/60' : '')}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {nom} {fmtCorta(fecha)} {esHoy && <Badge tono="info">hoy</Badge>}
                </div>
                <div className="text-sm tabular-nums text-[var(--texto-2)]">
                  {costo > 0 ? money(costo) : '—'}
                </div>
              </div>
              <div className="mt-2 space-y-2">
                <Stepper label="Ofic." valor={of} onChange={(v) => setJornal(fecha, { of: v })} />
                <Stepper label="Ayud." valor={ay} onChange={(v) => setJornal(fecha, { ay: v })} />
              </div>
              <input
                className="mt-2 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-[var(--texto-2)] placeholder:text-[var(--texto-2)]/60 focus:border-[var(--borde)] focus:outline-none"
                value={j?.nota ?? ''}
                placeholder="Nota del día (lluvia, feriado, quién faltó…)"
                onChange={(e) => setJornal(fecha, { nota: e.target.value })}
              />
            </Card>
          );
        })}
      </div>

      {/* Fijos semanales */}
      <Card className="p-4">
        <SectionTitle>Fijos semanales</SectionTitle>
        {diario.fijos.length === 0 && (
          <p className="mb-2 text-xs text-[var(--texto-2)]">
            Pagos fijos por semana a personas (ej. «Jesús $50.000/sem»).
          </p>
        )}
        <div className="space-y-2">
          {diario.fijos.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <EditCell
                value={f.persona}
                placeholder="Persona"
                onCommit={(v) =>
                  setDiario({
                    ...diario,
                    fijos: diario.fijos.map((x) => (x.id === f.id ? { ...x, persona: v } : x))
                  })
                }
              />
              <EditCell
                tipo="number"
                className="max-w-32"
                value={f.montoSemanal}
                onCommit={(v) =>
                  setDiario({
                    ...diario,
                    fijos: diario.fijos.map((x) =>
                      x.id === f.id ? { ...x, montoSemanal: Number(v) || 0 } : x
                    )
                  })
                }
              />
              <button
                className="px-1 text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                title="Quitar fijo"
                onClick={() =>
                  setDiario({ ...diario, fijos: diario.fijos.filter((x) => x.id !== f.id) })
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <Btn
          className="mt-2"
          onClick={() =>
            setDiario({
              ...diario,
              fijos: [...diario.fijos, { id: uid(), persona: '', montoSemanal: 0 }]
            })
          }
        >
          + Agregar fijo
        </Btn>
      </Card>

      {/* Adelantos de la semana */}
      <Card className="p-4">
        <SectionTitle>Adelantos de la semana</SectionTitle>
        <div className="space-y-1.5">
          {adelSem.length === 0 && (
            <p className="text-xs text-[var(--texto-2)]">
              Entregas a cuenta durante la semana: se descuentan del pago del viernes.
            </p>
          )}
          {adelSem.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-[var(--texto-2)] tabular-nums">{fmtCorta(a.fecha)}</span>
              <span className="flex-1 truncate">{a.persona}</span>
              <span className="tabular-nums">{money(a.monto)}</span>
              <button
                className="px-1 text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                title="Quitar adelanto"
                onClick={() =>
                  setDiario({
                    ...diario,
                    adelantos: diario.adelantos.filter((x) => x.id !== a.id)
                  })
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            className="w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1.5 text-sm focus:outline-2 focus:outline-[var(--color-sud-azul)]"
            value={adPersona}
            placeholder="Persona"
            onChange={(e) => setAdPersona(e.target.value)}
          />
          <input
            className="w-32 rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1.5 text-right text-sm tabular-nums focus:outline-2 focus:outline-[var(--color-sud-azul)]"
            type="number"
            inputMode="numeric"
            min={0}
            value={adMonto}
            placeholder="$"
            onChange={(e) => setAdMonto(e.target.value)}
          />
          <Btn variante="primario" onClick={agregarAdelanto}>+</Btn>
        </div>
      </Card>

      {/* Cierre de la semana */}
      <Card className="p-4">
        <SectionTitle>Cierre de la semana</SectionTitle>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--texto-2)]">Jornales</span>
            <span className="tabular-nums">{money(r.jornales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--texto-2)]">Fijos semanales</span>
            <span className="tabular-nums">{money(r.fijos)}</span>
          </div>
          <div className="flex justify-between border-t border-[var(--borde)] pt-1 font-medium">
            <span>TOTAL SEMANA</span>
            <span className="tabular-nums">{money(r.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--texto-2)]">− Adelantos</span>
            <span className="tabular-nums text-[var(--color-alerta)]">− {money(r.adelantos)}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[var(--borde)] pt-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--texto-2)]">
            Neto a pagar
          </span>
          <span className="font-marca text-2xl tabular-nums">{money(r.neto)}</span>
        </div>
      </Card>
    </div>
  );
}
