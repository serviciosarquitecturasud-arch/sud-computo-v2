/**
 * Imprimir — salidas para cliente (H6).
 * Panel de control (columna izquierda, no imprimible) + vista previa del
 * documento (hoja A4) que en @media print se convierte en la página.
 * Cálculo idéntico a Presupuesto.tsx:
 *   cu = apuTiene(cod) ? costoAPUEnObra(cod, obra) : precioManual || 0
 *   coef = calcCoef(obra.coef ?? coefDefault())
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { calcCoef, cmpCodigo, coefDefault, fmt, fmtN, money } from '../../core';
import type { Catalogo, ItemObra, Motor, Obra } from '../../core';
import { Btn, Card, SectionTitle } from '../../ui/base';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

/* Campos de carátula/superficies preservados por passthrough (misma forma que Caratula.tsx) */
interface CaratulaData {
  estado?: string;
  fechaCot?: string;
  tipoCambio?: number | string;
  [k: string]: unknown;
}
interface Superficies {
  cub?: number | string;
  semi?: number | string;
  desc?: number | string;
  [k: string]: unknown;
}

interface FilaItem {
  cod: string;
  desc: string;
  unidad: string;
  cant: number;
  /** Costo unitario directo (sin coeficiente) */
  unit: number;
  /** Costo directo de la fila (unit × cant) */
  subtotal: number;
}
interface GrupoRubro {
  rp: string;
  nombre: string;
  costo: number;
  filas: FilaItem[];
}

interface Secciones {
  caratula: boolean;
  presupuesto: boolean;
  detalle: boolean;
  observaciones: boolean;
}

const num = (v: unknown): number => Number(v) || 0;

const fmtFecha = (iso: string | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ── Tinta fija del documento: siempre se imprime oscuro sobre blanco,
      independiente del tema de la app ── */
const TINTA = '#1B1B18';
const GRIS = '#6B685C';
const LINEA = '#E5E1D3';

function ChkRow({
  checked,
  onChange,
  disabled = false,
  children
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-sm ${
        disabled
          ? 'cursor-default opacity-45'
          : 'cursor-pointer hover:bg-[var(--color-neutro-100)] dark:hover:bg-[var(--color-neutro-800)]'
      }`}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[var(--color-sud-naranja)]"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </label>
  );
}

export function Imprimir({ obra, motor }: Props) {
  // ── Cálculo (réplica exacta de Presupuesto.tsx) ──
  const items = obra.items ?? [];
  const coef = calcCoef(obra.coef ?? coefDefault());
  const cu = (it: ItemObra): number =>
    motor.apuTiene(it.cod) ? motor.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;

  const map: Record<string, GrupoRubro> = {};
  items.forEach((it) => {
    const rp = String(it.cod || '').split('.')[0];
    if (!map[rp]) {
      const r = motor.rubMap[rp + '.00'] ?? motor.rubMap[rp];
      map[rp] = { rp, nombre: r?.desc ? r.desc : 'Rubro ' + rp, costo: 0, filas: [] };
    }
    const r = motor.rubMap[it.cod];
    const unit = cu(it);
    const cant = it.cant || 0;
    map[rp].costo += unit * cant;
    map[rp].filas.push({
      cod: it.cod,
      desc: r?.desc ?? '—',
      unidad: r?.unidad ?? '',
      cant,
      unit,
      subtotal: unit * cant
    });
  });
  const grupos = Object.values(map).sort((a, b) => cmpCodigo(a.rp, b.rp));

  // ── Selección: secciones + rubros (mapa de excluidos: lo nuevo entra tildado) ──
  const [sec, setSec] = useState<Secciones>({
    caratula: true,
    presupuesto: true,
    detalle: false,
    observaciones: true
  });
  const [rubrosOff, setRubrosOff] = useState<Record<string, boolean>>({});
  const toggleSec = (k: keyof Secciones) => setSec({ ...sec, [k]: !sec[k] });
  const toggleRubro = (rp: string) => setRubrosOff({ ...rubrosOff, [rp]: !rubrosOff[rp] });
  const marcarTodos = (v: boolean) => {
    const o: Record<string, boolean> = {};
    if (!v) grupos.forEach((g) => (o[g.rp] = true));
    setRubrosOff(o);
  };

  const gruposSel = grupos.filter((g) => !rubrosOff[g.rp]);
  const obs = String(obra.observacionesPresupuesto ?? '').trim();

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* ══ Controles (no se imprimen) ══ */}
      <div className="no-print w-full shrink-0 space-y-4 xl:w-72">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Imprimir</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            Armá el documento para el cliente y guardalo como PDF.
          </p>
        </div>

        <Card className="p-4">
          <SectionTitle>Secciones</SectionTitle>
          <div className="space-y-0.5">
            <ChkRow checked={sec.caratula} onChange={() => toggleSec('caratula')}>
              Carátula
            </ChkRow>
            <ChkRow checked={sec.presupuesto} onChange={() => toggleSec('presupuesto')}>
              Presupuesto por rubro
            </ChkRow>
            <ChkRow checked={sec.detalle} onChange={() => toggleSec('detalle')}>
              Detalle de ítems
            </ChkRow>
            <ChkRow
              checked={sec.observaciones && obs !== ''}
              disabled={obs === ''}
              onChange={() => toggleSec('observaciones')}
            >
              Observaciones{obs === '' ? ' (sin texto)' : ''}
            </ChkRow>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-baseline justify-between">
            <SectionTitle>Rubros</SectionTitle>
            <div className="flex gap-1 text-xs text-[var(--texto-2)]">
              <button className="px-1 hover:text-[var(--texto)]" onClick={() => marcarTodos(true)}>
                Todos
              </button>
              <span>·</span>
              <button className="px-1 hover:text-[var(--texto)]" onClick={() => marcarTodos(false)}>
                Ninguno
              </button>
            </div>
          </div>
          {grupos.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-[var(--texto-2)]">
              La obra todavía no tiene ítems computados.
            </p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto">
              {grupos.map((g) => (
                <ChkRow key={g.rp} checked={!rubrosOff[g.rp]} onChange={() => toggleRubro(g.rp)}>
                  <span className="font-mono text-xs text-[var(--texto-2)]">{g.rp}</span> {g.nombre}
                </ChkRow>
              ))}
            </div>
          )}
        </Card>

        <Btn
          variante="primario"
          className="w-full justify-center py-3 text-base"
          onClick={() => window.print()}
        >
          Imprimir / guardar PDF
        </Btn>
        <p className="text-xs text-[var(--texto-2)]">
          En el diálogo del navegador elegí «Guardar como PDF». Formato A4, márgenes ya definidos.
        </p>
      </div>

      {/* ══ Vista previa / documento ══ */}
      <div className="min-w-0 flex-1">
        <div className="documento-print">
          <DocumentoPresupuesto
            obra={obra}
            grupos={gruposSel}
            coef={coef}
            sec={sec}
            obs={obs}
          />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DocumentoPresupuesto — el documento que ve el cliente.
   Sobrio: tinta sobre blanco, Acid Grotesk solo para marca y
   títulos, números tabulares alineados a la derecha.
   ════════════════════════════════════════════════════════════ */
function DocumentoPresupuesto({
  obra,
  grupos,
  coef,
  sec,
  obs
}: {
  obra: Obra;
  grupos: GrupoRubro[];
  coef: number;
  sec: Secciones;
  obs: string;
}) {
  const car = (obra.caratula ?? {}) as CaratulaData;
  const sup = (obra.superficies ?? {}) as Superficies;
  const cub = num(sup.cub);
  const semi = num(sup.semi);
  const desc = num(sup.desc);
  const m2Equiv = cub + 0.5 * semi + 0.25 * desc;

  const costoDirecto = grupos.reduce((s, g) => s + g.costo, 0);
  const total = costoDirecto * coef;
  const tc = num(car.tipoCambio);

  const hoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const hCell = 'pb-1.5 pt-1 text-left text-[10px] font-semibold uppercase tracking-[0.12em]';
  const cell = 'py-1.5 align-top';
  const dato = (etiqueta: string, valor: ReactNode) => (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: GRIS }}>
        {etiqueta}
      </div>
      <div className="mt-0.5 text-sm">{valor}</div>
    </div>
  );

  return (
    <div style={{ color: TINTA }}>
      {/* ── Encabezado de marca ── */}
      <header
        className="doc-bloque flex items-end justify-between gap-4 border-b pb-4"
        style={{ borderColor: TINTA }}
      >
        <div className="font-marca select-none leading-none">
          <span className="text-4xl tracking-tight">SUD</span>
          <span className="text-xl" style={{ color: GRIS }}>
            _estudio
          </span>
        </div>
        <div className="text-right text-[10px] leading-relaxed" style={{ color: GRIS }}>
          serviciosarquitectura.sud@gmail.com
          <br />
          11.7368.4530 · @sud_estudio
        </div>
      </header>

      {/* ── Carátula ── */}
      {sec.caratula && (
        <section className="doc-bloque mt-10">
          <div className="fondo-paleta h-2 w-full rounded-full" />
          <h1 className="font-marca mt-6 text-3xl leading-tight tracking-tight">
            {obra.nombre || 'Obra sin nombre'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: GRIS }}>
            Presupuesto de obra
          </p>
          <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4">
            {dato('Comitente', String(obra.comitente ?? '') || '—')}
            {dato('Dirección', String(obra.direccion ?? '') || '—')}
            {dato('Fecha de cotización', fmtFecha(car.fechaCot))}
            {dato('Estado', car.estado ? String(car.estado) : '—')}
          </div>
          <div
            className="mt-6 grid grid-cols-4 gap-x-8 border-t pt-4"
            style={{ borderColor: LINEA }}
          >
            {dato('Sup. cubierta', <span className="tabular-nums">{fmtN(cub)} m²</span>)}
            {dato('Semicubierta', <span className="tabular-nums">{fmtN(semi)} m²</span>)}
            {dato('Descubierta', <span className="tabular-nums">{fmtN(desc)} m²</span>)}
            {dato('m² equivalentes', <span className="tabular-nums">{fmtN(m2Equiv)} m²</span>)}
          </div>
        </section>
      )}

      {/* ── Presupuesto por rubro ── */}
      {sec.presupuesto && (
        <section className="doc-bloque mt-10">
          <h2 className="font-marca text-lg tracking-tight">Presupuesto por rubro</h2>
          {grupos.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: GRIS }}>
              No hay rubros seleccionados.
            </p>
          ) : (
            <table className="mt-3 w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="border-b" style={{ borderColor: TINTA, color: GRIS }}>
                  <th className={`${hCell} w-12`}>Rubro</th>
                  <th className={hCell}>Descripción</th>
                  <th className={`${hCell} w-36 text-right`}>Monto</th>
                  <th className={`${hCell} w-20 text-right`}>Incidencia</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.rp} className="border-b" style={{ borderColor: LINEA }}>
                    <td className={`${cell} font-mono text-xs`} style={{ color: GRIS }}>
                      {g.rp}
                    </td>
                    <td className={cell}>{g.nombre}</td>
                    <td className={`${cell} text-right`}>{money(g.costo * coef)}</td>
                    <td className={`${cell} text-right`} style={{ color: GRIS }}>
                      {costoDirecto > 0 ? fmtN((g.costo / costoDirecto) * 100) + ' %' : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="border-b-2" style={{ borderColor: TINTA }}>
                  <td className="pt-2.5 pb-2 text-sm font-semibold" colSpan={2}>
                    PRECIO TOTAL DE OBRA
                  </td>
                  <td className="pt-2.5 pb-2 text-right text-base font-semibold">{money(total)}</td>
                  <td className="pt-2.5 pb-2 text-right" style={{ color: GRIS }}>
                    100 %
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ── Detalle de ítems ── */}
      {sec.detalle && grupos.length > 0 && (
        <section className="mt-10">
          <h2 className="font-marca text-lg tracking-tight">Detalle de ítems</h2>
          {grupos.map((g) => (
            <div key={g.rp} className="doc-bloque mt-5">
              <h3
                className="border-b pb-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ borderColor: TINTA }}
              >
                <span className="font-mono" style={{ color: GRIS }}>
                  {g.rp}
                </span>{' '}
                {g.nombre}
              </h3>
              <table className="w-full text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <tbody>
                  {g.filas.map((f, i) => (
                    <tr key={f.cod + i} className="border-b" style={{ borderColor: LINEA }}>
                      <td className={`${cell} w-14 font-mono`} style={{ color: GRIS }}>
                        {f.cod}
                      </td>
                      <td className={cell}>{f.desc}</td>
                      <td className={`${cell} w-12 text-center`} style={{ color: GRIS }}>
                        {f.unidad}
                      </td>
                      <td className={`${cell} w-16 text-right`}>{fmtN(f.cant)}</td>
                      <td className={`${cell} w-28 text-right`} style={{ color: GRIS }}>
                        {money(f.unit * coef)}
                      </td>
                      <td className={`${cell} w-28 text-right`}>{money(f.subtotal * coef)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-1.5 text-right text-xs" colSpan={5} style={{ color: GRIS }}>
                      Subtotal {g.nombre}
                    </td>
                    <td className="pt-1.5 text-right text-xs font-semibold">
                      {money(g.costo * coef)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
          <p className="mt-2 text-[10px]" style={{ color: GRIS }}>
            Precios unitarios finales (incluyen coeficiente de pase).
          </p>
        </section>
      )}

      {/* ── Observaciones ── */}
      {sec.observaciones && obs !== '' && (
        <section className="doc-bloque mt-10">
          <h2 className="font-marca text-lg tracking-tight">Observaciones</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{obs}</p>
        </section>
      )}

      {/* ── Pie ── */}
      <footer
        className="doc-bloque mt-12 flex items-end justify-between gap-4 border-t pt-3 text-[10px]"
        style={{ borderColor: LINEA, color: GRIS }}
      >
        <div>
          Documento generado por SUD Cómputo — {hoy}
          {tc > 0 && (
            <>
              <br />
              Tipo de cambio de referencia: $ {fmt(tc)} · Total equivalente: USD{' '}
              <span className="tabular-nums">{fmt(total / tc)}</span>
            </>
          )}
        </div>
        <div className="font-marca select-none whitespace-nowrap text-xs" style={{ color: TINTA }}>
          SUD<span style={{ color: GRIS }}>_estudio</span>
        </div>
      </footer>
    </div>
  );
}
