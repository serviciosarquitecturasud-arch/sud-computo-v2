/**
 * Mano de obra (tab de obra) — subtabs Precios | Análisis (paridad legacy).
 *  · Precios: overrides por obra (obra.precios.manoObra + obra.proveedores.manoObra).
 *  · Análisis: port completo de `ManoDeObraObra` legacy — matriz jornalizados × rubro,
 *    presupuesto asignado (obra.presupuestoMOJorn), subcontratos contratados
 *    (obra.subcontratosManuales), subcontratos por gremio y resumen con incidencia.
 * Campos persistidos con nombre/estructura EXACTOS del legacy (passthrough).
 */
import { useMemo, useState } from 'react';
import { cmpCodigo, fmtN, money } from '../../core';
import type { Catalogo, ManoObra, Motor, Obra } from '../../core';
import { Card, SectionTitle, SubTabs, td, th } from '../../ui/base';
import { EditCell } from '../../ui/edit';
import { PreciosInsumos } from './PreciosInsumos';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

const SUBS = [
  ['precios', 'Precios'],
  ['analisis', 'Análisis']
] as const;

export function ManoObraObra(props: Props) {
  const [sub, setSub] = useState<'precios' | 'analisis'>('precios');
  return (
    <div>
      <header className="mb-4">
        <h1 className="font-marca text-3xl tracking-tight">Mano de obra</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Precios y contratistas de esta obra, y análisis de horas y costos según los APU
          computados.
        </p>
      </header>
      <SubTabs tabs={SUBS} activa={sub} onCambiar={setSub} />
      {sub === 'precios' ? (
        <PreciosInsumos tipo="mo" {...props} />
      ) : (
        <AnalisisMO {...props} />
      )}
    </div>
  );
}

/* ════════════════════════ ANÁLISIS (port legacy completo) ════════════════════════ */

interface FilaSub {
  cod: string;
  desc: string;
  unidad: string;
  cant: number;
  valor: number;
  total: number;
  rubroPadre?: string;
}

function AnalisisMO({ obra, setObra, cat, motor }: Props) {
  const items = obra.items ?? [];
  const scManualesMap = (obra.subcontratosManuales as Record<string, number | string> | undefined) ?? {};
  const presupMOJorn = Number(obra.presupuestoMOJorn) || 0;

  const moComputo = useMemo(() => {
    const porRubro: Record<string, Record<string, number>> = {};
    const totales: Record<string, number> = {};
    const rubrosUsados = new Set<string>();
    items.forEach((it) => {
      const rp = String(it.cod || '').split('.')[0];
      if (!rp) return;
      (motor.bibMap[it.cod] ?? []).forEach((b) => {
        if (b.tipo !== 'MO') return;
        const cantTotal = (b.cant || 0) * (it.cant || 0);
        if (cantTotal <= 0) return;
        if (!porRubro[rp]) porRubro[rp] = {};
        porRubro[rp][b.insumo] = (porRubro[rp][b.insumo] ?? 0) + cantTotal;
        totales[b.insumo] = (totales[b.insumo] ?? 0) + cantTotal;
        rubrosUsados.add(rp);
      });
    });
    const moDefs = (cat.manoObra ?? []).filter((o) => (totales[o.cod] ?? 0) > 0);
    const jornalizados = moDefs
      .filter((o) => (o.unidad || 'hs') === 'hs')
      .sort((a, b) => cmpCodigo(a.cod, b.cod));
    const subcontratos = moDefs
      .filter((o) => (o.unidad || 'hs') !== 'hs')
      .sort((a, b) => cmpCodigo(a.cod, b.cod));
    const rubros = [...rubrosUsados].sort(cmpCodigo).map((rp) => {
      const padre = (cat.rubros ?? []).find((r) => r.cod === rp + '.00');
      return { rp, nombre: padre ? padre.desc : 'Rubro ' + rp, porCod: porRubro[rp] ?? {} };
    });
    const costoJorn = jornalizados.reduce(
      (s, o) => s + (totales[o.cod] ?? 0) * motor.costoInsumoEnObra('MO', o.cod, obra),
      0
    );
    const costoSub = subcontratos.reduce(
      (s, o) => s + (totales[o.cod] ?? 0) * motor.costoInsumoEnObra('MO', o.cod, obra),
      0
    );
    // Ítems subcontrato por convención: el rubro tiene "subcontrato" en su descripción.
    const subcontratosItems: FilaSub[] = items
      .filter((it) => {
        const r = motor.rubMap[it.cod];
        return !!r && /subcontrat/i.test(r.desc || '');
      })
      .map((it) => {
        const r = motor.rubMap[it.cod] ?? { desc: '', unidad: 'Gl' };
        const cant = Number(it.cant) || 0;
        const valor = motor.apuTiene(it.cod)
          ? motor.costoAPUEnObra(it.cod, obra)
          : Number(it.precioManual) || 0;
        return {
          cod: it.cod,
          desc: r.desc || '',
          unidad: r.unidad || 'Gl',
          cant,
          valor,
          total: cant * valor,
          rubroPadre: String(it.cod || '').split('.')[0]
        };
      })
      .filter((x) => x.cant > 0)
      .sort((a, b) => cmpCodigo(a.cod, b.cod));
    const costoSubItems = subcontratosItems.reduce((s, x) => s + x.total, 0);
    // Subcontratos manuales — carga directa por obra (obra.subcontratosManuales).
    const scDefs: ManoObra[] = (cat.manoObra ?? [])
      .filter((o) => (o.unidad || 'hs') !== 'hs')
      .sort((a, b) => cmpCodigo(a.cod, b.cod));
    const subcontratosManuales: FilaSub[] = scDefs.map((o) => {
      const cant = Number(scManualesMap[o.cod]) || 0;
      const valor = motor.costoInsumoEnObra('MO', o.cod, obra);
      return { cod: o.cod, desc: o.desc || '', unidad: o.unidad || 'Gl', cant, valor, total: cant * valor };
    });
    const costoSubManuales = subcontratosManuales.reduce((s, x) => s + x.total, 0);
    return {
      jornalizados,
      subcontratos,
      subcontratosItems,
      subcontratosManuales,
      scDefs,
      rubros,
      totales,
      costoJorn,
      costoSub,
      costoSubItems,
      costoSubManuales,
      costoTotal: costoJorn + costoSub + costoSubItems + costoSubManuales
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, motor, cat, obra]);

  const costoDirecto = useMemo(
    () =>
      items.reduce((s, it) => {
        if (motor.apuTiene(it.cod)) return s + motor.costoAPUEnObra(it.cod, obra) * (it.cant || 0);
        return s + (it.precioManual || 0) * (it.cant || 0);
      }, 0),
    [items, motor, obra]
  );

  const rubrosQueUsan = (codSub: string): string =>
    moComputo.rubros
      .filter((r) => (r.porCod[codSub] ?? 0) > 0)
      .map((r) => r.rp)
      .sort(cmpCodigo)
      .join(', ');

  const setScManual = (cod: string, v: string) => {
    const nuevaCant = Number(v) || 0;
    const nuevo: Record<string, number | string> = { ...scManualesMap };
    if (nuevaCant > 0) nuevo[cod] = nuevaCant;
    else delete nuevo[cod];
    setObra({ ...obra, subcontratosManuales: nuevo });
  };

  const pctInc = (v: number): string =>
    costoDirecto > 0 ? ((v / costoDirecto) * 100).toFixed(1).replace('.', ',') + ' %' : '—';

  if (items.length === 0 || moComputo.rubros.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
        Sin mano de obra computada todavía: cargá ítems con APU en el cómputo.
      </Card>
    );
  }

  const subtotalJornFila = (r: { porCod: Record<string, number> }): number =>
    moComputo.jornalizados.reduce((s, o) => s + (r.porCod[o.cod] ?? 0), 0);

  const excede = presupMOJorn > 0 && moComputo.costoJorn > presupMOJorn;
  const manualesActivos = moComputo.subcontratosManuales.filter((x) => x.cant > 0);
  const subSubTotal = moComputo.costoSub + moComputo.costoSubItems + moComputo.costoSubManuales;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--texto-2)]">
        Recuento de mano de obra agrupado por rubro padre. Jornalizados en horas, subcontratos en
        su unidad de facturación. Los precios provienen del catálogo o del override por obra
        (subtab Precios).
      </p>

      {/* ══ BLOQUE 1: matriz jornalizados ══ */}
      {moComputo.jornalizados.length > 0 && (
        <Card className="overflow-x-auto p-4">
          <SectionTitle>Jornalizados — horas por rubro</SectionTitle>
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={`${th} w-16`}>Rubro</th>
                <th className={th}>Descripción</th>
                {moComputo.jornalizados.map((o) => (
                  <th key={o.cod} className={`${th} w-36 text-right`}>
                    <div>{o.cod}</div>
                    <div className="font-normal normal-case tracking-normal text-[var(--texto-2)]">
                      {o.desc}
                    </div>
                  </th>
                ))}
                <th className={`${th} w-32 text-right`}>Total hs</th>
              </tr>
            </thead>
            <tbody>
              {moComputo.rubros.map((r) => (
                <tr key={r.rp} className="hover:bg-[var(--color-neutro-100)]/40">
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{r.rp}</td>
                  <td className={`${td} text-xs`}>{r.nombre}</td>
                  {moComputo.jornalizados.map((o) => {
                    const v = r.porCod[o.cod] ?? 0;
                    return (
                      <td
                        key={o.cod}
                        className={`${td} text-right font-mono tabular-nums ${v > 0 ? '' : 'text-[var(--texto-2)]/40'}`}
                      >
                        {v > 0 ? fmtN(v) : '—'}
                      </td>
                    );
                  })}
                  <td className={`${td} text-right font-mono font-semibold tabular-nums`}>
                    {fmtN(subtotalJornFila(r))}
                  </td>
                </tr>
              ))}
              <tr className="bg-[var(--color-neutro-100)] font-semibold dark:bg-[var(--color-neutro-800)]">
                <td className={td} colSpan={2}>
                  TOTAL OBRA (hs)
                </td>
                {moComputo.jornalizados.map((o) => (
                  <td key={o.cod} className={`${td} text-right font-mono tabular-nums`}>
                    {fmtN(moComputo.totales[o.cod] ?? 0)}
                  </td>
                ))}
                <td className={`${td} text-right font-mono tabular-nums`}>
                  {fmtN(moComputo.jornalizados.reduce((s, o) => s + (moComputo.totales[o.cod] ?? 0), 0))}
                </td>
              </tr>
              <tr className="text-xs text-[var(--texto-2)]">
                <td className={td} colSpan={2}>
                  Costo MO jornalizada (ARS)
                </td>
                {moComputo.jornalizados.map((o) => {
                  const val = motor.costoInsumoEnObra('MO', o.cod, obra);
                  return (
                    <td key={o.cod} className={`${td} whitespace-nowrap text-right font-mono tabular-nums`}>
                      {money((moComputo.totales[o.cod] ?? 0) * val)}
                    </td>
                  );
                })}
                <td
                  className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums ${
                    excede ? 'text-[var(--color-alerta)]' : 'text-[var(--texto)]'
                  }`}
                >
                  {money(moComputo.costoJorn)}
                </td>
              </tr>
              <tr className="text-xs">
                <td className={`${td} text-[var(--texto-2)]`} colSpan={moComputo.jornalizados.length + 2}>
                  Presupuesto asignado (ARS) — cargado a mano para control
                </td>
                <td className={td}>
                  <EditCell
                    tipo="number"
                    value={presupMOJorn > 0 ? String(presupMOJorn) : ''}
                    placeholder="cargar"
                    onCommit={(v) => setObra({ ...obra, presupuestoMOJorn: Number(v) || 0 })}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* ══ BLOQUE 2A: subcontratos contratados (carga manual) ══ */}
      {moComputo.scDefs.length > 0 && (
        <Card className="overflow-x-auto p-4">
          <SectionTitle>Subcontratos contratados en esta obra</SectionTitle>
          <p className="mb-2 text-xs text-[var(--texto-2)]">
            Cargá la cantidad de cada subcontrato que aplica a esta obra (típicamente 1 por
            gremio). El valor unitario sale del catálogo o del override en la subtab Precios.
          </p>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <th className={`${th} w-20`}>Código</th>
                <th className={th}>Descripción</th>
                <th className={`${th} w-14`}>Un.</th>
                <th className={`${th} w-24 text-right`}>Cantidad</th>
                <th className={`${th} w-32 text-right`}>Valor unitario</th>
                <th className={`${th} w-32 text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {moComputo.subcontratosManuales.map((x) => {
                const sinPrecio = !x.valor || x.valor <= 0;
                const inactivo = x.cant <= 0;
                return (
                  <tr
                    key={'sm-' + x.cod}
                    className={`hover:bg-[var(--color-neutro-100)]/40 ${inactivo ? '' : 'bg-[var(--color-sud-azul)]/5'}`}
                  >
                    <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{x.cod}</td>
                    <td className={`${td} ${inactivo ? 'text-[var(--texto-2)]' : ''}`}>{x.desc}</td>
                    <td className={`${td} text-[var(--texto-2)]`}>{x.unidad || 'Gl'}</td>
                    <td className={td}>
                      <EditCell
                        tipo="number"
                        value={x.cant > 0 ? String(x.cant) : ''}
                        placeholder="0"
                        onCommit={(v) => setScManual(x.cod, v)}
                      />
                    </td>
                    <td
                      className={`${td} whitespace-nowrap text-right font-mono tabular-nums ${
                        sinPrecio ? 'text-[var(--color-alerta)]' : inactivo ? 'text-[var(--texto-2)]' : ''
                      }`}
                    >
                      {sinPrecio ? '(sin precio)' : money(x.valor)}
                    </td>
                    <td
                      className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums ${
                        inactivo ? 'text-[var(--texto-2)]' : ''
                      }`}
                    >
                      {x.cant > 0 ? money(x.total) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--color-neutro-100)] font-semibold dark:bg-[var(--color-neutro-800)]">
                <td className={td} colSpan={5}>
                  Total subcontratos contratados
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono tabular-nums`}>
                  {money(moComputo.costoSubManuales)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* ══ BLOQUE 2B: subcontratos por gremio (ítems por convención + SC en APUs) ══ */}
      {(moComputo.subcontratos.length > 0 || moComputo.subcontratosItems.length > 0) && (
        <Card className="overflow-x-auto p-4">
          <SectionTitle>Subcontratos por gremio</SectionTitle>
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={`${th} w-20`}>Código</th>
                <th className={th}>Descripción</th>
                <th className={`${th} w-32`}>Rubros que lo usan</th>
                <th className={`${th} w-14`}>Un.</th>
                <th className={`${th} w-20 text-right`}>Cantidad</th>
                <th className={`${th} w-32 text-right`}>Valor unitario</th>
                <th className={`${th} w-32 text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {moComputo.subcontratosItems.map((x) => (
                <tr key={'sci-' + x.cod} className="hover:bg-[var(--color-neutro-100)]/40">
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{x.cod}</td>
                  <td className={td}>{x.desc}</td>
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{x.rubroPadre}</td>
                  <td className={`${td} text-[var(--texto-2)]`}>{x.unidad || 'Gl'}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(x.cant)}</td>
                  <td
                    className={`${td} whitespace-nowrap text-right font-mono tabular-nums ${
                      x.valor > 0 ? '' : 'text-[var(--color-alerta)]'
                    }`}
                  >
                    {x.valor > 0 ? money(x.valor) : '(sin precio)'}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums`}>
                    {money(x.total)}
                  </td>
                </tr>
              ))}
              {moComputo.subcontratos.map((o) => {
                const cant = moComputo.totales[o.cod] ?? 0;
                const val = motor.costoInsumoEnObra('MO', o.cod, obra);
                return (
                  <tr key={o.cod} className="hover:bg-[var(--color-neutro-100)]/40">
                    <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{o.cod}</td>
                    <td className={td}>{o.desc}</td>
                    <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{rubrosQueUsan(o.cod)}</td>
                    <td className={`${td} text-[var(--texto-2)]`}>{o.unidad || 'Gl'}</td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(cant)}</td>
                    <td
                      className={`${td} whitespace-nowrap text-right font-mono tabular-nums ${
                        val > 0 ? '' : 'text-[var(--color-alerta)]'
                      }`}
                    >
                      {val > 0 ? money(val) : '(sin precio)'}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums`}>
                      {money(cant * val)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--color-neutro-100)] font-semibold dark:bg-[var(--color-neutro-800)]">
                <td className={td} colSpan={6}>
                  Total subcontratos
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono tabular-nums`}>
                  {money(moComputo.costoSub + moComputo.costoSubItems)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* ══ BLOQUE 3: resumen con incidencia ══ */}
      <Card className="overflow-x-auto p-4">
        <SectionTitle>Resumen de mano de obra</SectionTitle>
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr>
              <th className={`${th} w-20`}>Código</th>
              <th className={th}>Descripción</th>
              <th className={`${th} w-14`}>Un.</th>
              <th className={`${th} w-24 text-right`}>Cantidad</th>
              <th className={`${th} w-32 text-right`}>Valor unitario</th>
              <th className={`${th} w-32 text-right`}>Total</th>
              <th className={`${th} w-20 text-right`}>% Inc.</th>
            </tr>
          </thead>
          <tbody>
            {moComputo.jornalizados.length > 0 && (
              <tr className="bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]">
                <td className={`${td} text-xs font-semibold uppercase tracking-wide text-[var(--texto-2)]`} colSpan={7}>
                  Jornalizados
                </td>
              </tr>
            )}
            {moComputo.jornalizados.map((o) => {
              const cant = moComputo.totales[o.cod] ?? 0;
              const val = motor.costoInsumoEnObra('MO', o.cod, obra);
              const tot = cant * val;
              return (
                <tr key={'j-' + o.cod} className="hover:bg-[var(--color-neutro-100)]/40">
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{o.cod}</td>
                  <td className={td}>{o.desc}</td>
                  <td className={`${td} text-[var(--texto-2)]`}>{o.unidad || 'hs'}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(cant)}</td>
                  <td
                    className={`${td} whitespace-nowrap text-right font-mono tabular-nums ${
                      val > 0 ? '' : 'text-[var(--color-alerta)]'
                    }`}
                  >
                    {val > 0 ? money(val) : '(sin precio)'}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums`}>
                    {money(tot)}
                  </td>
                  <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
                    {pctInc(tot)}
                  </td>
                </tr>
              );
            })}
            {moComputo.jornalizados.length > 0 && (
              <tr className="text-xs text-[var(--texto-2)]">
                <td className={td} colSpan={5}>
                  Subtotal jornalizados
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums text-[var(--texto)]`}>
                  {money(moComputo.costoJorn)}
                </td>
                <td className={`${td} text-right font-mono font-semibold tabular-nums`}>
                  {pctInc(moComputo.costoJorn)}
                </td>
              </tr>
            )}
            {manualesActivos.length + moComputo.subcontratosItems.length > 0 && (
              <tr className="bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]">
                <td className={`${td} text-xs font-semibold uppercase tracking-wide text-[var(--texto-2)]`} colSpan={7}>
                  Subcontratos
                </td>
              </tr>
            )}
            {[...manualesActivos, ...moComputo.subcontratosItems].map((x, i) => (
              <tr key={'sc-' + x.cod + '-' + i} className="hover:bg-[var(--color-neutro-100)]/40">
                <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{x.cod}</td>
                <td className={td}>{x.desc}</td>
                <td className={`${td} text-[var(--texto-2)]`}>{x.unidad || 'Gl'}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(x.cant)}</td>
                <td
                  className={`${td} whitespace-nowrap text-right font-mono tabular-nums ${
                    x.valor > 0 ? '' : 'text-[var(--color-alerta)]'
                  }`}
                >
                  {x.valor > 0 ? money(x.valor) : '(sin precio)'}
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums`}>
                  {money(x.total)}
                </td>
                <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
                  {pctInc(x.total)}
                </td>
              </tr>
            ))}
            {moComputo.subcontratos.length > 0 && (
              <tr className="bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]">
                <td className={`${td} text-xs font-semibold uppercase tracking-wide text-[var(--texto-2)]`} colSpan={7}>
                  Subcontratos (legacy — SC en APUs)
                </td>
              </tr>
            )}
            {moComputo.subcontratos.map((o) => {
              const cant = moComputo.totales[o.cod] ?? 0;
              const val = motor.costoInsumoEnObra('MO', o.cod, obra);
              const tot = cant * val;
              return (
                <tr key={'s-' + o.cod} className="hover:bg-[var(--color-neutro-100)]/40">
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{o.cod}</td>
                  <td className={td}>{o.desc}</td>
                  <td className={`${td} text-[var(--texto-2)]`}>{o.unidad || 'Gl'}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(cant)}</td>
                  <td
                    className={`${td} whitespace-nowrap text-right font-mono tabular-nums ${
                      val > 0 ? '' : 'text-[var(--color-alerta)]'
                    }`}
                  >
                    {val > 0 ? money(val) : '(sin precio)'}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums`}>
                    {money(tot)}
                  </td>
                  <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
                    {pctInc(tot)}
                  </td>
                </tr>
              );
            })}
            {(moComputo.subcontratos.length > 0 ||
              moComputo.subcontratosItems.length > 0 ||
              manualesActivos.length > 0) && (
              <tr className="text-xs text-[var(--texto-2)]">
                <td className={td} colSpan={5}>
                  Subtotal subcontratos
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums text-[var(--texto)]`}>
                  {money(subSubTotal)}
                </td>
                <td className={`${td} text-right font-mono font-semibold tabular-nums`}>
                  {pctInc(subSubTotal)}
                </td>
              </tr>
            )}
            <tr className="bg-[var(--color-neutro-100)] font-semibold dark:bg-[var(--color-neutro-800)]">
              <td className={td} colSpan={5}>
                TOTAL MO DE OBRA
              </td>
              <td className={`${td} whitespace-nowrap text-right font-mono tabular-nums`}>
                {money(moComputo.costoTotal)}
              </td>
              <td className={`${td} text-right font-mono tabular-nums`}>{pctInc(moComputo.costoTotal)}</td>
            </tr>
            {costoDirecto > 0 && (
              <tr className="text-xs text-[var(--texto-2)]">
                <td className={td} colSpan={5}>
                  Costo directo total de obra (referencia)
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono tabular-nums`}>
                  {money(costoDirecto)}
                </td>
                <td className={`${td} text-right font-mono tabular-nums`}>100,0 %</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
