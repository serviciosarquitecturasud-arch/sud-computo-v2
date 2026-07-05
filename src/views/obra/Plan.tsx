/** Plan de trabajo — planificación por rubro principal (port del PlanTrabajo legacy). */
import { useMemo } from 'react';
import { buildPlan, fmtN, money } from '../../core';
import type { Catalogo, Motor, Obra, PlanObra, PlanRubroConfig } from '../../core';
import { Badge, Card, td, th } from '../../ui/base';
import { EditCell, EditSelect } from '../../ui/edit';

export function Plan({
  obra,
  setObra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}) {
  const planData = useMemo(() => buildPlan(obra, motor), [obra, motor]);
  const { base, plazo, hsSem } = planData;

  const planActual = (): PlanObra => obra.plan ?? { hsSem: 45, rubros: {} };

  const setCfg = (rp: string, patch: Partial<PlanRubroConfig>) => {
    const plan = planActual();
    const rubros = plan.rubros ?? {};
    const cfgActual = rubros[rp] ?? {};
    setObra({
      ...obra,
      plan: { ...plan, rubros: { ...rubros, [rp]: { ...cfgActual, ...patch } } }
    });
  };

  const setHsSem = (v: string) => {
    const plan = planActual();
    setObra({ ...obra, plan: { ...plan, hsSem: Number(v) || 45 } });
  };

  const num = (v: string) => Math.max(0, Number(v) || 0);

  const badgeEstado = (estado?: string) => {
    if (estado === 'ok') return <Badge tono="ok">ok</Badge>;
    if (estado === 'sin duración') return <Badge tono="alerta">sin duración</Badge>;
    return <Badge tono="neutro">sin planificar</Badge>;
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Plan de trabajo</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            Planificación por rubro principal. La duración se carga en semanas; el inicio se
            encadena por la precedencia. Si cargás cuadrilla, la duración se calcula sola.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--texto-2)]">
          Horas operario / semana
          <span className="w-20">
            <EditCell value={hsSem} tipo="number" onCommit={setHsSem} />
          </span>
        </label>
      </header>

      {base.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Cargá ítems en la Planilla de cotización para planificar la obra.
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-4">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr>
                  <th className={`${th} w-16`}>Rubro</th>
                  <th className={th}>Descripción</th>
                  <th className={`${th} w-28 text-right`}>Monto $</th>
                  <th className={`${th} w-20 text-right`}>HS ofic.</th>
                  <th className={`${th} w-20 text-right`}>HS ayud.</th>
                  <th className={`${th} w-24`}>Duración (sem)</th>
                  <th className={`${th} w-16`}>Of. cuad.</th>
                  <th className={`${th} w-16`}>Ay. cuad.</th>
                  <th className={`${th} w-32`}>Precede de</th>
                  <th className={`${th} w-20`}>Inicio man.</th>
                  <th className={`${th} w-14 text-right`}>Inicio</th>
                  <th className={`${th} w-14 text-right`}>Fin</th>
                  <th className={`${th} w-20 text-right`}>Ofic/sem</th>
                  <th className={`${th} w-20 text-right`}>Ayud/sem</th>
                  <th className={`${th} w-28`}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {base.map((b) => (
                  <tr key={b.rp} className="hover:bg-[var(--color-neutro-100)]/40">
                    <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{b.rp}.00</td>
                    <td className={td}>{b.nombre}</td>
                    <td className={`${td} text-right tabular-nums`}>{money(b.monto)}</td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {fmtN(b.hsOf)}
                    </td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {fmtN(b.hsAy)}
                    </td>
                    <td className={td}>
                      {b.modo === 'cuadrilla' ? (
                        <span
                          className="block text-right text-xs italic tabular-nums text-[var(--texto-2)]"
                          title={`Calculada desde la cuadrilla (exacta: ${b.duracionCalc.toFixed(2)} sem)`}
                        >
                          {b.duracion} sem
                          <span className="block text-[10px] not-italic opacity-70">
                            calc {b.duracionCalc.toFixed(1)}
                          </span>
                        </span>
                      ) : (
                        <EditCell
                          value={b.duracion || ''}
                          tipo="number"
                          placeholder="—"
                          onCommit={(v) => setCfg(b.rp, { duracion: num(v) })}
                        />
                      )}
                    </td>
                    <td className={td}>
                      <EditCell
                        value={b.ofsCuad || ''}
                        tipo="number"
                        placeholder="—"
                        onCommit={(v) => setCfg(b.rp, { ofsCuad: num(v) })}
                      />
                    </td>
                    <td className={td}>
                      <EditCell
                        value={b.ayudCuad || ''}
                        tipo="number"
                        placeholder="—"
                        onCommit={(v) => setCfg(b.rp, { ayudCuad: num(v) })}
                      />
                    </td>
                    <td className={td}>
                      <EditSelect
                        value={b.precede}
                        opciones={base.filter((x) => x.rp !== b.rp).map((x) => x.rp)}
                        onCommit={(v) => setCfg(b.rp, { precede: v })}
                      />
                    </td>
                    <td className={td}>
                      {b.precede ? (
                        <span className="block text-right text-xs text-[var(--texto-2)]">—</span>
                      ) : (
                        <EditCell
                          value={b.inicioManual || ''}
                          tipo="number"
                          placeholder="1"
                          onCommit={(v) => setCfg(b.rp, { inicioManual: num(v) })}
                        />
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{b.inicio ?? '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.fin ?? '—'}</td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {b.oficSem ? b.oficSem.toFixed(1) : '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {b.ayudSem ? b.ayudSem.toFixed(1) : '—'}
                    </td>
                    <td className={td}>{badgeEstado(b.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="flex items-baseline gap-2 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]">
              Plazo total de obra
            </span>
            <span className="text-2xl tabular-nums">{plazo}</span>
            <span className="text-sm text-[var(--texto-2)]">
              semanas{plazo > 0 ? ` (~${Math.ceil(plazo / 4)} meses)` : ''}
            </span>
          </Card>
        </>
      )}
    </div>
  );
}
