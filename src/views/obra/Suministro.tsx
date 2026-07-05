/** Plan de suministro — Modelo A: todo el material entra la semana de inicio del rubro. */
import { useMemo, useState } from 'react';
import { buildPlan, buildSuministro, cmpCodigo, fmtN, money } from '../../core';
import type { Catalogo, EntradaSuministro, Motor, Obra } from '../../core';
import { Badge, Btn, Card, td, th } from '../../ui/base';

function TablaMateriales({ items }: { items: EntradaSuministro[] }) {
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr>
          <th className={th}>Material</th>
          <th className={`${th} w-20`}>Unidad</th>
          <th className={`${th} w-32 text-right`}>Cant. c/desp.</th>
          <th className={`${th} w-28 text-right`}>Precio unit.</th>
          <th className={`${th} w-32 text-right`}>Costo total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((s, i) => (
          <tr key={`${s.rp}-${s.matCod ?? 'g' + i}-${i}`} className="hover:bg-[var(--color-neutro-100)]/40">
            <td className={td}>
              {s.matDesc}
              {s.esGlobal && (
                <span className="ml-2">
                  <Badge tono="neutro">global</Badge>
                </span>
              )}
            </td>
            <td className={`${td} text-[var(--texto-2)]`}>{s.unidad || '—'}</td>
            <td className={`${td} text-right tabular-nums`}>{fmtN(s.cantidadConDesperdicio)}</td>
            <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
              {s.esGlobal ? '—' : money(s.precioUnit)}
            </td>
            <td className={`${td} text-right tabular-nums`}>
              {s.esGlobal ? '—' : money(s.costoTotal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Suministro({
  obra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}) {
  const planData = useMemo(() => buildPlan(obra, motor), [obra, motor]);
  const suministro = useMemo(
    () => buildSuministro(obra, planData, motor),
    [obra, planData, motor]
  );
  const [porRubro, setPorRubro] = useState(false);

  const totalGeneral = suministro.reduce((s, x) => s + (x.costoTotal || 0), 0);

  // Agrupación semana → rubro (vista por defecto)
  const porSemana = useMemo(() => {
    const map = new Map<number, EntradaSuministro[]>();
    suministro.forEach((s) => {
      const sem = s.semanaInicio;
      if (sem == null) return;
      const arr = map.get(sem) ?? [];
      arr.push(s);
      map.set(sem, arr);
    });
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([semana, entradas]) => {
        const rubros = new Map<string, EntradaSuministro[]>();
        entradas.forEach((s) => {
          const arr = rubros.get(s.rp) ?? [];
          arr.push(s);
          rubros.set(s.rp, arr);
        });
        return {
          semana,
          subtotal: entradas.reduce((t, s) => t + (s.costoTotal || 0), 0),
          rubros: [...rubros.entries()]
            .sort((a, b) => cmpCodigo(a[0], b[0]))
            .map(([rp, items]) => ({ rp, nombre: items[0].rubroNombre, items }))
        };
      });
  }, [suministro]);

  // Agrupación rubro → semana (toggle). Con el Modelo A cada rubro tiene una sola semana.
  const grupoRubros = useMemo(() => {
    const map = new Map<string, EntradaSuministro[]>();
    suministro.forEach((s) => {
      const arr = map.get(s.rp) ?? [];
      arr.push(s);
      map.set(s.rp, arr);
    });
    return [...map.entries()]
      .sort((a, b) => cmpCodigo(a[0], b[0]))
      .map(([rp, items]) => ({
        rp,
        nombre: items[0].rubroNombre,
        semana: items[0].semanaInicio,
        subtotal: items.reduce((t, s) => t + (s.costoTotal || 0), 0),
        items
      }));
  }, [suministro]);

  const sinPlan = planData.base.length === 0 || planData.plazo === 0 || suministro.length === 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Plan de suministro</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            Modelo A: todo el material de un rubro entra en la semana de inicio del rubro.
          </p>
        </div>
        {!sinPlan && (
          <Btn variante={porRubro ? 'primario' : 'secundario'} onClick={() => setPorRubro(!porRubro)}>
            Agrupar por rubro
          </Btn>
        )}
      </header>

      {sinPlan ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          No hay rubros planificados: cargá duraciones e inicios en el Plan de trabajo para
          distribuir el suministro.
        </Card>
      ) : porRubro ? (
        <>
          {grupoRubros.map((g) => (
            <Card key={g.rp} className="overflow-x-auto p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  <span className="font-mono text-xs text-[var(--texto-2)]">{g.rp}.00</span>{' '}
                  {g.nombre}
                </h3>
                <span className="text-xs text-[var(--texto-2)]">
                  entra en semana {g.semana ?? '—'}
                </span>
              </div>
              <TablaMateriales items={g.items} />
              <div className="mt-2 flex justify-end text-sm">
                <span className="text-[var(--texto-2)]">Subtotal rubro:&nbsp;</span>
                <span className="font-medium tabular-nums">{money(g.subtotal)}</span>
              </div>
            </Card>
          ))}
        </>
      ) : (
        <>
          {porSemana.map((g) => (
            <Card key={g.semana} className="overflow-x-auto p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">Semana {g.semana}</h3>
                <span className="text-xs text-[var(--texto-2)]">
                  {g.rubros.length} rubro{g.rubros.length !== 1 ? 's' : ''} arranca
                  {g.rubros.length !== 1 ? 'n' : ''} esta semana
                </span>
              </div>
              <div className="space-y-4">
                {g.rubros.map((r) => (
                  <div key={r.rp}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--texto-2)]">
                      <span className="font-mono">{r.rp}.00</span> · {r.nombre}
                    </div>
                    <TablaMateriales items={r.items} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-end text-sm">
                <span className="text-[var(--texto-2)]">Subtotal semana {g.semana}:&nbsp;</span>
                <span className="font-medium tabular-nums">{money(g.subtotal)}</span>
              </div>
            </Card>
          ))}
        </>
      )}

      {!sinPlan && (
        <Card className="flex items-baseline justify-between px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]">
            Total general de materiales
          </span>
          <span className="text-xl font-medium tabular-nums">{money(totalGeneral)}</span>
        </Card>
      )}
    </div>
  );
}
