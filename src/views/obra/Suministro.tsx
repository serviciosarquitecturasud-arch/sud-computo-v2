/**
 * Plan de suministro — Modelo A: todo el material entra la semana de inicio del rubro.
 * Vistas (paridad legacy PlanSuministro): Por rubro | Gantt | Por semana | Por mes |
 * Checklist | Saldo.
 *  · Gantt: SVG (patrón de CaminoCritico) con materiales por tarea en el tooltip.
 *  · Checklist: hojas imprimibles por rubro — el legacy NO persiste el estado del
 *    check (casilleros para tildar en papel), así que acá tampoco se inventa campo.
 *  · Saldo: total obra vs asignado a tareas planificadas.
 */
import { useMemo, useState } from 'react';
import { buildPlan, buildSuministro, cmpCodigo, fmtN, materialesTotalObra, money } from '../../core';
import type { Catalogo, EntradaSuministro, Motor, Obra, PlanRubro } from '../../core';
import { Badge, Btn, Card, td, th } from '../../ui/base';

type Vista = 'rubro' | 'gantt' | 'semana' | 'mes' | 'check' | 'saldo';

const VISTAS: [Vista, string][] = [
  ['rubro', 'Por rubro'],
  ['gantt', 'Gantt'],
  ['semana', 'Por semana'],
  ['mes', 'Por mes'],
  ['check', 'Checklist'],
  ['saldo', 'Saldo']
];

interface MatPeriodo {
  matCod: string;
  matDesc: string;
  unidad: string;
  cant: number;
  cantConDesp: number;
  desp: number;
  precioUnit: number;
  costoTotal: number;
  origenItems: string[];
  origenRubros: string[];
}

interface Periodo {
  periodo: number;
  esMes: boolean;
  tareas: { rp: string; nombre: string }[];
  materiales: MatPeriodo[];
  globales: { cod: string; cant: number; rp: string }[];
  totalCosto: number;
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
  const suministro = useMemo(() => buildSuministro(obra, planData, motor), [obra, planData, motor]);
  const [vista, setVista] = useState<Vista>('rubro');

  const totalGeneral = suministro.reduce((s, x) => s + (x.costoTotal || 0), 0);
  const totalEntradas = suministro.length;

  /* ── Agrupación por rubro, ordenada por semana de arranque (legacy) ── */
  const lista = useMemo(() => {
    const grupos: Record<string, { rp: string; nombre: string; semana: number | null | undefined; items: EntradaSuministro[] }> = {};
    suministro.forEach((s) => {
      if (!grupos[s.rp]) grupos[s.rp] = { rp: s.rp, nombre: s.rubroNombre, semana: s.semanaInicio, items: [] };
      grupos[s.rp].items.push(s);
    });
    return Object.values(grupos).sort(
      (a, b) => (a.semana || 0) - (b.semana || 0) || cmpCodigo(a.rp, b.rp)
    );
  }, [suministro]);

  const sinPlanificar = planData.base.filter((b) => b.inicio == null).length;
  const sinAPU = suministro.filter((s) => s.esGlobal).length;
  const sinPrecio = suministro.filter((s) => !s.esGlobal && (!s.precioUnit || s.precioUnit === 0)).length;

  /* ── Agregación temporal semana/mes (1 mes = 4 semanas; materiales iguales se SUMAN) ── */
  const porPeriodo: Periodo[] = useMemo(() => {
    const esMes = vista === 'mes';
    interface Acum {
      periodo: number;
      esMes: boolean;
      tareas: Record<string, string>;
      materiales: Record<
        string,
        Omit<MatPeriodo, 'origenItems' | 'origenRubros'> & {
          origenItems: Set<string>;
          origenRubros: Set<string>;
        }
      >;
      globales: { cod: string; cant: number; rp: string }[];
      totalCosto: number;
    }
    const map: Record<number, Acum> = {};
    suministro.forEach((s) => {
      const sem = s.semanaInicio;
      if (sem == null) return;
      const pid = esMes ? Math.ceil(sem / 4) : sem;
      if (!map[pid]) map[pid] = { periodo: pid, esMes, tareas: {}, materiales: {}, globales: [], totalCosto: 0 };
      map[pid].tareas[s.rp] = s.rubroNombre;
      if (s.esGlobal) {
        map[pid].globales.push({ cod: s.origenItems[0] ?? '', cant: s.cantidad, rp: s.rp });
      } else {
        const k = s.matCod ?? '';
        if (!map[pid].materiales[k]) {
          map[pid].materiales[k] = {
            matCod: s.matCod ?? '',
            matDesc: s.matDesc,
            unidad: s.unidad,
            cant: 0,
            cantConDesp: 0,
            desp: s.desperdicioPct,
            precioUnit: s.precioUnit,
            costoTotal: 0,
            origenItems: new Set<string>(),
            origenRubros: new Set<string>()
          };
        }
        const m = map[pid].materiales[k];
        m.cant += s.cantidad;
        m.cantConDesp += s.cantidadConDesperdicio;
        m.costoTotal += s.costoTotal;
        (s.origenItems || []).forEach((it) => m.origenItems.add(it));
        m.origenRubros.add(s.rp);
        map[pid].totalCosto += s.costoTotal;
      }
    });
    return Object.values(map)
      .map((g) => ({
        ...g,
        tareas: Object.entries(g.tareas)
          .map(([rp, nombre]) => ({ rp, nombre }))
          .sort((a, b) => cmpCodigo(a.rp, b.rp)),
        materiales: Object.values(g.materiales)
          .map((m) => ({
            ...m,
            origenItems: [...m.origenItems].sort(cmpCodigo),
            origenRubros: [...m.origenRubros].sort(cmpCodigo)
          }))
          .sort((a, b) => (b.costoTotal || 0) - (a.costoTotal || 0))
      }))
      .sort((a, b) => a.periodo - b.periodo);
  }, [suministro, vista]);

  /* ── Saldo por material: total obra vs asignado a tareas planificadas ── */
  const saldo = useMemo(() => {
    const total = materialesTotalObra(obra, motor);
    const asignadoMap: Record<string, number> = {};
    suministro.forEach((s) => {
      if (s.esGlobal || !s.matCod) return;
      asignadoMap[s.matCod] = (asignadoMap[s.matCod] ?? 0) + (s.cantidadConDesperdicio || 0);
    });
    return total
      .map((m) => {
        const asignado = asignadoMap[m.matCod] ?? 0;
        const sinAsignar = Math.max(0, (m.cantidadConDesperdicio || 0) - asignado);
        return { ...m, asignado, sinAsignar, pendiente: sinAsignar > 0.01 };
      })
      .sort((a, b) => (b.costoTotal || 0) - (a.costoTotal || 0));
  }, [obra, motor, suministro]);

  const sinPlan = planData.base.length === 0 || planData.plazo === 0 || suministro.length === 0;

  if (sinPlan) {
    return (
      <div className="space-y-4">
        <Encabezado />
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          {planData.base.length === 0
            ? 'Cargá ítems en el cómputo para ver el suministro.'
            : 'Cargá duraciones e inicios en el Plan de trabajo para distribuir el suministro.'}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Encabezado />

      {/* ── KPIs ── */}
      <div className="no-print flex flex-wrap gap-3">
        <Kpi titulo="Costo materiales" valor={money(totalGeneral)} />
        <Kpi titulo="Rubros con materiales" valor={String(lista.length)} />
        <Kpi titulo="Entradas totales" valor={String(totalEntradas)} />
      </div>

      {/* ── Avisos ── */}
      <div className="no-print space-y-2">
        {sinPlanificar > 0 && (
          <Card className="border-[var(--color-alerta)]/40 px-4 py-2 text-sm">
            <Badge tono="alerta">{sinPlanificar}</Badge>{' '}
            rubro{sinPlanificar !== 1 ? 's' : ''} sin planificar — no aparece
            {sinPlanificar !== 1 ? 'n' : ''} en el suministro hasta que le
            {sinPlanificar !== 1 ? 's' : ''} cargues duración e inicio en el Plan de trabajo.
          </Card>
        )}
        {sinAPU > 0 && (
          <Card className="px-4 py-2 text-xs text-[var(--texto-2)]">
            {sinAPU} ítem{sinAPU !== 1 ? 's' : ''} global{sinAPU !== 1 ? 'es' : ''} sin desglose de
            materiales — aparece{sinAPU !== 1 ? 'n' : ''} sin lista detallada (carga manual o
            precio fijo).
          </Card>
        )}
        {sinPrecio > 0 && (
          <Card className="border-[var(--color-alerta)]/40 px-4 py-2 text-sm">
            <Badge tono="alerta">{sinPrecio}</Badge>{' '}
            material{sinPrecio !== 1 ? 'es' : ''} con precio $0 — el costo total del suministro va
            a estar incompleto hasta que cargues precios.
          </Card>
        )}
      </div>

      {/* ── Toggle de vistas ── */}
      <div className="no-print inline-flex flex-wrap rounded-lg border border-[var(--borde)] bg-[var(--panel)] p-0.5">
        {VISTAS.map(([v, lbl]) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${
              vista === v
                ? 'bg-[var(--color-sud-tinta)] font-medium text-[var(--color-sud-crema)] dark:bg-[var(--color-sud-crema)] dark:text-[var(--color-sud-tinta)]'
                : 'text-[var(--texto-2)] hover:text-[var(--texto)]'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* ══ POR RUBRO ══ */}
      {vista === 'rubro' &&
        (lista.length === 0 ? (
          <Card className="p-6 text-center text-sm text-[var(--texto-2)]">
            Ningún rubro planificado tiene materiales asociados en su APU.
          </Card>
        ) : (
          lista.map((g) => (
            <Card key={g.rp} className="overflow-x-auto p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  <span className="font-mono text-xs text-[var(--texto-2)]">{g.rp}.00</span>{' '}
                  {g.nombre}
                  {g.semana != null && (
                    <span className="ml-3 align-middle">
                      <Badge tono="info">arranque: semana {g.semana}</Badge>
                    </span>
                  )}
                </h3>
                <span className="font-mono text-sm tabular-nums">
                  {money(g.items.reduce((s, x) => s + (x.costoTotal || 0), 0))}
                </span>
              </div>
              <TablaEntradas items={g.items} />
            </Card>
          ))
        ))}

      {/* ══ GANTT ══ */}
      {vista === 'gantt' && (
        <GanttSuministro base={planData.base} plazo={planData.plazo} suministro={suministro} />
      )}

      {/* ══ POR SEMANA / POR MES ══ */}
      {(vista === 'semana' || vista === 'mes') &&
        (porPeriodo.length === 0 ? (
          <Card className="p-6 text-center text-sm text-[var(--texto-2)]">
            No hay tareas planificadas todavía. Cargá inicio y duración en el Plan de trabajo.
          </Card>
        ) : (
          <>
            {porPeriodo.map((g) => (
              <Card key={'p-' + g.periodo} className="overflow-hidden">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--borde)] bg-[var(--color-neutro-100)]/50 px-4 py-3 dark:bg-[var(--color-neutro-800)]/50">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{(g.esMes ? 'Mes ' : 'Semana ') + g.periodo}</span>
                    <span className="text-xs text-[var(--texto-2)]">
                      · arranca{g.tareas.length !== 1 ? 'n' : ''} {g.tareas.length} tarea
                      {g.tareas.length !== 1 ? 's' : ''}:
                    </span>
                    {g.tareas.map((t) => (
                      <Badge key={t.rp} tono="info">
                        R{t.rp} {t.nombre.slice(0, 22)}
                      </Badge>
                    ))}
                  </div>
                  <span className="font-mono text-sm tabular-nums">{money(g.totalCosto)}</span>
                </div>
                {g.materiales.length > 0 && (
                  <div className="overflow-x-auto p-4">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr>
                          <th className={`${th} w-16`}>Cód</th>
                          <th className={th}>Material</th>
                          <th className={`${th} w-24 text-right`}>Cantidad</th>
                          <th className={`${th} w-16`}>Unidad</th>
                          <th className={`${th} w-24 text-right`}>Con desp.</th>
                          <th className={`${th} w-24 text-right`}>$ unit</th>
                          <th className={`${th} w-28 text-right`}>Total</th>
                          <th className={`${th} w-28`}>Rubros origen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.materiales.map((m, i) => (
                          <tr
                            key={(m.matCod || '') + '-' + i}
                            className={m.origenRubros.length > 1 ? 'bg-[var(--color-sud-azul)]/5' : ''}
                          >
                            <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>
                              {m.matCod || '—'}
                            </td>
                            <td className={td}>
                              {m.matDesc}
                              {m.origenRubros.length > 1 && (
                                <span className="ml-2">
                                  <Badge tono="info">compartido</Badge>
                                </span>
                              )}
                            </td>
                            <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(m.cant)}</td>
                            <td className={`${td} text-[var(--texto-2)]`}>{m.unidad || ''}</td>
                            <td className={`${td} text-right font-mono tabular-nums`}>
                              {m.desp ? fmtN(m.cantConDesp) : '—'}
                            </td>
                            <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                              {m.precioUnit ? money(m.precioUnit) : <span className="text-xs">sin precio</span>}
                            </td>
                            <td className={`${td} text-right font-mono tabular-nums`}>
                              {m.costoTotal ? money(m.costoTotal) : '—'}
                            </td>
                            <td className={`${td} text-xs text-[var(--texto-2)]`}>
                              {m.origenRubros.map((rp) => 'R' + rp).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {g.globales.length > 0 && (
                  <div className="border-t border-[var(--borde)] px-4 py-2 text-xs text-[var(--texto-2)]">
                    Ítems globales sin desglose este período: {g.globales.map((x) => x.cod).join(', ')}
                  </div>
                )}
              </Card>
            ))}

            {/* Footer resumen + progresión acumulada */}
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="mr-2 text-[var(--texto-2)]">
                    {(vista === 'mes' ? 'Meses' : 'Semanas') + ' con arranque:'}
                  </span>
                  <span className="font-mono tabular-nums">{porPeriodo.length}</span>
                </div>
                <div>
                  <span className="mr-2 text-[var(--texto-2)]">Costo materiales total:</span>
                  <span className="font-mono tabular-nums">
                    {money(porPeriodo.reduce((s, g) => s + g.totalCosto, 0))}
                  </span>
                </div>
                {porPeriodo.length > 0 && (
                  <div>
                    <span className="mr-2 text-[var(--texto-2)]">
                      Promedio por {vista === 'mes' ? 'mes' : 'semana'}:
                    </span>
                    <span className="font-mono tabular-nums">
                      {money(porPeriodo.reduce((s, g) => s + g.totalCosto, 0) / porPeriodo.length)}
                    </span>
                  </div>
                )}
              </div>
              {porPeriodo.length > 1 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr>
                        <th className={`${th} w-20`}>{vista === 'mes' ? 'Mes' : 'Semana'}</th>
                        <th className={th}>Tareas que arrancan</th>
                        <th className={`${th} w-32 text-right`}>Costo del período</th>
                        <th className={`${th} w-32 text-right`}>Acumulado</th>
                        <th className={`${th} w-24 text-right`}>% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalCosto = porPeriodo.reduce((s, g) => s + g.totalCosto, 0);
                        let acum = 0;
                        return porPeriodo.map((g) => {
                          acum += g.totalCosto;
                          const pct = totalCosto > 0 ? (acum / totalCosto) * 100 : 0;
                          return (
                            <tr key={'prog-' + g.periodo}>
                              <td className={`${td} font-mono tabular-nums`}>
                                {(g.esMes ? 'M' : 'S') + g.periodo}
                              </td>
                              <td className={`${td} text-xs text-[var(--texto-2)]`}>
                                {g.tareas.map((t) => 'R' + t.rp).join(', ')}
                              </td>
                              <td className={`${td} text-right font-mono tabular-nums`}>
                                {money(g.totalCosto)}
                              </td>
                              <td className={`${td} text-right font-mono tabular-nums`}>{money(acum)}</td>
                              <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
                                {pct.toFixed(0)} %
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ))}

      {/* ══ CHECKLIST ══ */}
      {vista === 'check' && (
        <div className="space-y-4">
          <div className="no-print flex items-center gap-3">
            <Btn onClick={() => window.print()}>Imprimir checklists</Btn>
            <span className="text-xs text-[var(--texto-2)]">
              Una hoja por rubro con casilleros para verificar antes de arrancar cada tarea
              (se tildan en papel, igual que en el legacy).
            </span>
          </div>
          {lista.length === 0 ? (
            <Card className="p-6 text-center text-sm text-[var(--texto-2)]">
              Ningún rubro planificado tiene materiales asociados en su APU.
            </Card>
          ) : (
            <div className="documento-print">
              {lista.map((g) => (
                <HojaChecklist key={'ck-' + g.rp} grupo={g} nombreObra={obra.nombre || 'Obra'} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ SALDO ══ */}
      {vista === 'saldo' &&
        (saldo.length === 0 ? (
          <Card className="p-6 text-center text-sm text-[var(--texto-2)]">
            No hay materiales con desglose en esta obra. Cargá ítems con APU en el cómputo.
          </Card>
        ) : (
          <>
            {saldo.filter((m) => m.pendiente).length > 0 && (
              <Card className="border-[var(--color-alerta)]/40 px-4 py-2 text-sm">
                <Badge tono="alerta">{saldo.filter((m) => m.pendiente).length}</Badge>{' '}
                material(es) con saldo «sin asignar» — corresponden a rubros que todavía no tienen
                fecha de inicio en el Plan de trabajo.
              </Card>
            )}
            <Card className="overflow-x-auto p-4">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr>
                    <th className={`${th} w-16`}>Cód</th>
                    <th className={th}>Material</th>
                    <th className={`${th} w-14`}>Unid</th>
                    <th className={`${th} w-24 text-right`}>Total obra</th>
                    <th className={`${th} w-24 text-right`}>Asignado</th>
                    <th className={`${th} w-24 text-right`}>Sin asignar</th>
                    <th className={`${th} w-24 text-right`}>$ unit</th>
                    <th className={`${th} w-28 text-right`}>Costo total</th>
                  </tr>
                </thead>
                <tbody>
                  {saldo.map((m) => (
                    <tr key={m.matCod} className={m.pendiente ? 'bg-[var(--color-alerta)]/5' : ''}>
                      <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{m.matCod}</td>
                      <td className={td}>{m.matDesc}</td>
                      <td className={`${td} text-[var(--texto-2)]`}>{m.unidad || ''}</td>
                      <td className={`${td} text-right font-mono tabular-nums`}>
                        {fmtN(m.cantidadConDesperdicio)}
                      </td>
                      <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(m.asignado)}</td>
                      <td
                        className={`${td} text-right font-mono tabular-nums ${
                          m.pendiente ? 'font-medium text-[var(--color-alerta)]' : 'text-[var(--texto-2)]/50'
                        }`}
                      >
                        {m.pendiente ? fmtN(m.sinAsignar) : '—'}
                      </td>
                      <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                        {m.precioUnit ? money(m.precioUnit) : <span className="text-xs">sin precio</span>}
                      </td>
                      <td className={`${td} text-right font-mono tabular-nums`}>
                        {m.costoTotal ? money(m.costoTotal) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className={`${td} border-t-2 border-[var(--borde)] text-right`} colSpan={7}>
                      Total general materiales obra:
                    </td>
                    <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                      {money(saldo.reduce((s, m) => s + (m.costoTotal || 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </>
        ))}
    </div>
  );
}

/* ════════════════════════ Sub-componentes ════════════════════════ */

function Encabezado() {
  return (
    <header className="no-print">
      <h1 className="font-marca text-3xl tracking-tight">Plan de suministro</h1>
      <p className="mt-1 text-sm text-[var(--texto-2)]">
        Materiales que necesita cada tarea, al inicio de la tarea (Modelo A — todo el material
        entra de una vez).
      </p>
    </header>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-xs uppercase tracking-[0.08em] text-[var(--texto-2)]">{titulo}</div>
      <div className="mt-0.5 font-mono text-xl tabular-nums">{valor}</div>
    </Card>
  );
}

function TablaEntradas({ items }: { items: EntradaSuministro[] }) {
  return (
    <table className="w-full min-w-[760px] text-sm">
      <thead>
        <tr>
          <th className={`${th} w-16`}>Cód</th>
          <th className={th}>Material</th>
          <th className={`${th} w-24 text-right`}>Cantidad</th>
          <th className={`${th} w-16`}>Unidad</th>
          <th className={`${th} w-16 text-right`}>Desp. %</th>
          <th className={`${th} w-24 text-right`}>Con desp.</th>
          <th className={`${th} w-24 text-right`}>$ unit</th>
          <th className={`${th} w-28 text-right`}>Total</th>
          <th className={`${th} w-24`}>Origen</th>
        </tr>
      </thead>
      <tbody>
        {items.map((s, i) => (
          <tr
            key={(s.matCod ?? s.origenItems[0] ?? '') + '-' + i}
            className={s.esGlobal ? 'italic text-[var(--texto-2)]' : 'hover:bg-[var(--color-neutro-100)]/40'}
          >
            <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{s.matCod || '—'}</td>
            <td className={td}>
              {s.matDesc}
              {s.esGlobal && (
                <span className="ml-2">
                  <Badge tono="neutro">global</Badge>
                </span>
              )}
            </td>
            <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(s.cantidad)}</td>
            <td className={`${td} text-[var(--texto-2)]`}>{s.unidad || ''}</td>
            <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
              {s.desperdicioPct ? s.desperdicioPct + ' %' : '—'}
            </td>
            <td className={`${td} text-right font-mono tabular-nums`}>
              {s.desperdicioPct ? fmtN(s.cantidadConDesperdicio) : '—'}
            </td>
            <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
              {s.esGlobal ? '—' : s.precioUnit ? money(s.precioUnit) : <span className="text-xs">sin precio</span>}
            </td>
            <td className={`${td} text-right font-mono tabular-nums`}>
              {s.esGlobal ? '—' : s.costoTotal ? money(s.costoTotal) : '—'}
            </td>
            <td className={`${td} text-xs text-[var(--texto-2)]`}>{(s.origenItems || []).join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Gantt de suministro (SVG, patrón CaminoCritico) ── */
function GanttSuministro({
  base,
  plazo,
  suministro
}: {
  base: PlanRubro[];
  plazo: number;
  suministro: EntradaSuministro[];
}) {
  const filas = base
    .filter((b) => b.inicio != null && b.duracion > 0)
    .sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0));

  if (filas.length === 0 || plazo <= 0) {
    return (
      <Card className="p-6 text-center text-sm text-[var(--texto-2)]">
        No hay tareas planificadas. Cargá duración e inicio en el Plan de trabajo.
      </Card>
    );
  }

  const matsDe = (rp: string): EntradaSuministro[] => {
    const vistos = new Set<string>();
    const out: EntradaSuministro[] = [];
    suministro
      .filter((s) => s.rp === rp)
      .forEach((m) => {
        const key = m.matCod ?? 'global-' + (m.origenItems[0] ?? '');
        if (vistos.has(key)) return;
        vistos.add(key);
        out.push(m);
      });
    return out;
  };

  const labelW = 250;
  const rowH = 30;
  const axisH = 26;
  const padB = 8;
  const W = 780;
  const chartW = W - labelW - 12;
  const H = axisH + filas.length * rowH + padB;
  const xSem = (s: number) => labelW + ((s - 1) / plazo) * chartW;
  const anchoSem = chartW / plazo;
  const paso = Math.max(1, Math.ceil(plazo / 18));

  const tooltipDe = (b: PlanRubro, mats: EntradaSuministro[]): string => {
    const cab =
      `${b.rp}.00 · ${b.nombre}\n` +
      `Inicio: semana ${b.inicio} · Duración: ${b.duracion} sem\n` +
      (b.critico ? '⚠ Crítica' : `Holgura: ${b.holgura ?? 0} sem`) +
      '\n\nMateriales a comprar antes:';
    if (mats.length === 0) return cab + '\n(sin materiales detallados)';
    const cuerpo = mats
      .slice(0, 15)
      .map((m) => {
        const cant = m.cantidadConDesperdicio || m.cantidad || 0;
        return ` • ${m.matDesc.slice(0, 40)} — ${fmtN(cant)} ${m.unidad || ''}`;
      })
      .join('\n');
    const resto = mats.length > 15 ? `\n …y ${mats.length - 15} más` : '';
    return cab + '\n' + cuerpo + resto;
  };

  return (
    <Card className="p-4">
      <p className="mb-3 text-xs text-[var(--texto-2)]">
        Lectura rápida por tarea: cuándo arranca y cuántos materiales tener listos. Pasá el cursor
        sobre las barras para ver el detalle con cantidades.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gantt del plan de suministro">
        {/* Grilla vertical + eje de semanas */}
        {Array.from({ length: plazo + 1 }).map((_, i) => (
          <line
            key={'g' + i}
            x1={xSem(i + 1)}
            y1={axisH - 6}
            x2={xSem(i + 1)}
            y2={H - padB}
            stroke="var(--borde)"
            strokeWidth={i % 4 === 0 ? 1.2 : 0.6}
          />
        ))}
        {Array.from({ length: plazo }).map((_, i) =>
          (i + 1) % paso === 0 || i === 0 ? (
            <text
              key={'s' + i}
              x={xSem(i + 1) + anchoSem / 2}
              y={axisH - 10}
              textAnchor="middle"
              fontSize="10"
              fill="var(--texto-2)"
            >
              S{i + 1}
            </text>
          ) : null
        )}

        {filas.map((b, fi) => {
          const y = axisH + fi * rowH;
          const ini = b.inicio as number;
          const mats = matsDe(b.rp);
          return (
            <g key={b.rp}>
              <rect
                x={labelW}
                y={y + 4}
                width={chartW}
                height={rowH - 10}
                fill="var(--color-neutro-100)"
                opacity={0.35}
                rx={3}
              />
              <text x={labelW - 8} y={y + rowH / 2 - 2} textAnchor="end" fontSize="10.5" fill="var(--texto)">
                {(b.rp + '.00 · ' + b.nombre).slice(0, 38)}
              </text>
              <text x={labelW - 8} y={y + rowH / 2 + 9.5} textAnchor="end" fontSize="9" fill="var(--texto-2)">
                {`Sem ${ini} · ${mats.length} material${mats.length !== 1 ? 'es' : ''} antes de arrancar`}
              </text>
              <rect
                x={xSem(ini)}
                y={y + 5}
                width={(b.duracion / plazo) * chartW}
                height={rowH - 12}
                fill={b.critico ? 'var(--color-alerta)' : 'var(--color-sud-azul)'}
                rx={3}
              >
                <title>{tooltipDe(b, mats)}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[var(--texto-2)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-alerta)]" /> Tarea crítica
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-sud-azul)]" /> Tarea con holgura
        </span>
        <span>El «Sem N» indica cuándo arranca: los materiales deben estar en obra antes de esa semana.</span>
      </div>
    </Card>
  );
}

/* ── Hoja de checklist imprimible (paridad legacy: se tilda en papel) ── */
function HojaChecklist({
  grupo,
  nombreObra
}: {
  grupo: { rp: string; nombre: string; semana: number | null | undefined; items: EntradaSuministro[] };
  nombreObra: string;
}) {
  const subtotal = grupo.items.reduce((s, x) => s + (x.costoTotal || 0), 0);
  const casillero = <div className="h-5 w-5 rounded-sm border-2 border-neutral-400" />;
  return (
    <div className="doc-bloque mb-6 border-b border-neutral-200 pb-6 last:border-b-0">
      <div className="mb-4 border-b-2 border-neutral-800 pb-3">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="font-marca text-xl text-neutral-900">
            Rubro {grupo.rp} · {grupo.nombre}
          </h3>
          {grupo.semana != null && (
            <div className="font-mono text-sm text-neutral-600">
              Semana de arranque: {grupo.semana}
            </div>
          )}
        </div>
        <div className="text-sm text-neutral-600">{nombreObra}</div>
      </div>
      <div className="mb-3 text-sm text-neutral-700">
        Verificar disponibilidad antes de comenzar la tarea:
      </div>
      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-neutral-500">
            <th className="w-10 py-2 text-left">✓</th>
            <th className="py-2 text-left">Material</th>
            <th className="py-2 text-right">Cantidad</th>
            <th className="px-2 py-2 text-left">Unidad</th>
            <th className="py-2 text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          {grupo.items.map((s, i) => (
            <tr
              key={i}
              className={`border-b border-neutral-100 ${s.esGlobal ? 'italic text-neutral-500' : 'text-neutral-800'}`}
            >
              <td className="py-2 align-top">{casillero}</td>
              <td className="py-2">{s.matDesc}</td>
              <td className="py-2 text-right font-mono tabular-nums">
                {fmtN(s.desperdicioPct ? s.cantidadConDesperdicio : s.cantidad)}
              </td>
              <td className="px-2 py-2 text-neutral-600">{s.unidad || ''}</td>
              <td className="py-2 text-right font-mono tabular-nums">
                {s.costoTotal ? money(s.costoTotal) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-neutral-300 pt-3 text-sm">
        <div className="mb-3 flex justify-between">
          <span className="text-neutral-600">Total inversión materiales:</span>
          <span className="font-mono font-medium text-neutral-800">{money(subtotal)}</span>
        </div>
        <div className="mb-2 text-neutral-700">Verificaciones adicionales:</div>
        <div className="space-y-1 text-neutral-700">
          {[
            'Cuadrilla disponible y comunicada',
            'Herramientas presentes en obra',
            'Espacio de acopio limpio y seco',
            'Frente de tarea preparado'
          ].map((t) => (
            <div key={t} className="flex items-center gap-2">
              {casillero}
              {t}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          <div>Fecha verificación: __________________</div>
          <div>Firma: __________________</div>
        </div>
      </div>
    </div>
  );
}
