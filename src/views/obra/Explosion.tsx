/**
 * Explosión de insumos — subtabs Completa | A comprar | Comparativa (paridad legacy).
 *  · Completa: materiales totales agrupados por división con presentación comercial,
 *    precios P1/P2, total de compra y proveedor.
 *  · A comprar: agrupación por RUBRO (compra escalonada, redondeo a presentación por
 *    rubro — Opción A del legacy) con selección de rubros e impresión.
 *  · Comparativa: REUSA la vista Comparativa de proveedores (misma estructura
 *    obra.cotizacionesPorRubro que el legacy) — sin duplicar lógica.
 */
import { useMemo, useState } from 'react';
import { cmpCodigo, fmtN, money } from '../../core';
import type { Catalogo, MaterialConfigObra, Motor, Obra, PreciosObra } from '../../core';
import { Btn, Card, SubTabs, td, th } from '../../ui/base';
import { Comparativa } from './Comparativa';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

type MapaNum = Record<string, number | string>;
type MapaStr = Record<string, string>;
type PreciosExt = PreciosObra & { materialesPres2ConIVA?: MapaNum; [k: string]: unknown };

interface ProveedoresObra {
  materiales?: MapaStr;
  [k: string]: unknown;
}

/** Fila de explosión con presentación comercial resuelta (override por obra). */
interface FilaExp {
  cod: string;
  desc: string;
  div: string;
  unidad: string;
  nec: number;
  desp: number;
  conDesp: number;
  pres1: string;
  comp1: number | null;
  pres2: string;
  comp2: number | null;
  fac1: number;
  fac2: number;
  totalComprar: number;
  precioP1: number;
  precioP2: number;
  totalCompraPesos: number;
  proveedor: string;
}

const SUBS = [
  ['completa', 'Completa'],
  ['comprar', 'A comprar'],
  ['comparativa', 'Comparativa proveedores']
] as const;

export function Explosion(props: Props) {
  const { obra, motor } = props;
  const [sub, setSub] = useState<'completa' | 'comprar' | 'comparativa'>('completa');
  const [rubrosSel, setRubrosSel] = useState<Record<string, boolean> | null>(null); // null = todos

  const cfg: Record<string, MaterialConfigObra> = obra.materialesConfig ?? {};
  const oPrec = (obra.precios ?? {}) as PreciosExt;
  const oProv = (obra.proveedores as ProveedoresObra | undefined) ?? {};
  const items = obra.items ?? [];

  /** Campos de presentación con override de obra (idéntico a getMatConfig legacy). */
  const getMatConfig = (cod: string) => {
    const base = motor.matMap[cod] ?? {
      desc: '(sin catálogo)',
      unidad: '',
      desp: 0,
      pres1: '',
      fac1: 0,
      pres2: '',
      fac2: 0
    };
    const ov = cfg[cod] ?? {};
    const pick = (v: unknown, def: unknown): unknown =>
      v !== undefined && v !== '' && v !== null ? v : def;
    return {
      desc: base.desc,
      unidad: base.unidad,
      desp: Number(pick(ov.desp, base.desp ?? 0)) || 0,
      pres1: String(pick(ov.pres1, base.pres1 ?? '') ?? ''),
      fac1: Number(pick(ov.fac1, base.fac1 ?? 0)) || 0,
      pres2: String(pick(ov.pres2, base.pres2 ?? '') ?? ''),
      fac2: Number(pick(ov.fac2, base.fac2 ?? 0)) || 0
    };
  };

  /** Redondeo a presentación comercial (comp1 palet + comp2 suelto). */
  const redondear = (conDesp: number, fac1: number, fac2: number) => {
    let comp1: number | null = null;
    let comp2: number | null = null;
    let totalComprar = conDesp;
    if (fac1 > 0) {
      if (fac2 > 0) {
        comp1 = Math.floor(conDesp / fac1);
        comp2 = Math.ceil((conDesp - comp1 * fac1) / fac2);
      } else {
        comp1 = Math.ceil(conDesp / fac1);
      }
      totalComprar = (comp1 ?? 0) * fac1 + (comp2 ?? 0) * fac2;
    }
    return { comp1, comp2, totalComprar };
  };

  /* ===== Explosión completa (colapsada por material, toda la obra) ===== */
  const explosion: FilaExp[] = useMemo(() => {
    const need: Record<string, number> = {};
    items.forEach((it) => {
      (motor.bibMap[it.cod] ?? []).forEach((b) => {
        if (b.tipo === 'M') need[b.insumo] = (need[b.insumo] ?? 0) + b.cant * (it.cant || 0);
      });
    });
    return Object.keys(need)
      .filter((k) => need[k] > 0)
      .map((k) => {
        const m = getMatConfig(k);
        const nec = need[k];
        const conDesp = nec * (1 + m.desp / 100);
        const { comp1, comp2, totalComprar } = redondear(conDesp, m.fac1, m.fac2);
        const beta = motor.costoInsumoEnObra('M', k, obra);
        const precioP1 = m.fac1 > 0 ? beta * m.fac1 : beta;
        const precioP2 = Number((oPrec.materialesPres2ConIVA ?? {})[k]) || 0;
        const totalCompraPesos = (comp1 ?? 0) * precioP1 + (comp2 ?? 0) * precioP2;
        return {
          cod: k,
          desc: m.desc,
          div: motor.matMap[k]?.div ?? '',
          unidad: m.unidad,
          nec,
          desp: m.desp,
          conDesp,
          pres1: m.pres1,
          comp1,
          pres2: m.pres2,
          comp2,
          fac1: m.fac1,
          fac2: m.fac2,
          totalComprar,
          precioP1,
          precioP2,
          totalCompraPesos,
          proveedor: (oProv.materiales ?? {})[k] ?? ''
        };
      })
      .sort((a, b) => cmpCodigo(a.cod, b.cod));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, motor, obra]);

  /* ===== Explosión por RUBRO (compra escalonada; redondeo por rubro) ===== */
  const explosionPorRubro = useMemo(() => {
    const need: Record<string, Record<string, number>> = {};
    items.forEach((it) => {
      const rp = String(it.cod || '').split('.')[0];
      (motor.bibMap[it.cod] ?? []).forEach((b) => {
        if (b.tipo === 'M' && b.cant * (it.cant || 0) > 0) {
          if (!need[rp]) need[rp] = {};
          need[rp][b.insumo] = (need[rp][b.insumo] ?? 0) + b.cant * (it.cant || 0);
        }
      });
    });
    return Object.keys(need)
      .sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
      .map((rp) => {
        const nombre = motor.rubMap[rp + '.00']?.desc ?? 'Rubro ' + rp;
        const mats = Object.keys(need[rp])
          .filter((k) => need[rp][k] > 0)
          .map((k) => {
            const m = getMatConfig(k);
            const nec = need[rp][k];
            const conDesp = nec * (1 + m.desp / 100);
            const { comp1, comp2, totalComprar } = redondear(conDesp, m.fac1, m.fac2);
            return {
              cod: k,
              desc: m.desc,
              unidad: m.unidad,
              nec,
              desp: m.desp,
              conDesp,
              pres1: m.pres1,
              comp1,
              pres2: m.pres2,
              comp2,
              fac1: m.fac1,
              fac2: m.fac2,
              totalComprar
            };
          })
          .sort((a, b) => cmpCodigo(a.cod, b.cod));
        return { rp, nombre, mats };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, motor, obra.materialesConfig]);

  /* ===== A comprar: selección de rubros ===== */
  const rubsDisp = explosionPorRubro.map((g) => g.rp);
  const estaSel = (rp: string): boolean => (rubrosSel === null ? true : !!rubrosSel[rp]);
  const toggleRubro = (rp: string) => {
    const base: Record<string, boolean> = {};
    rubsDisp.forEach((x) => {
      base[x] = rubrosSel === null ? true : !!rubrosSel[x];
    });
    base[rp] = !base[rp];
    setRubrosSel(base);
  };
  const setTodas = (val: boolean) => {
    const base: Record<string, boolean> = {};
    rubsDisp.forEach((x) => {
      base[x] = val;
    });
    setRubrosSel(base);
  };
  const algunaSel = rubsDisp.some(estaSel);

  const aComprarTexto = (e: {
    pres1: string;
    comp1: number | null;
    pres2: string;
    comp2: number | null;
    conDesp: number;
    unidad: string;
  }): string => {
    if (e.pres1 && e.comp1 !== null) {
      return (
        `${fmtN(e.comp1)} ${e.pres1}` +
        (e.pres2 && e.comp2 ? ` + ${fmtN(e.comp2)} ${e.pres2}` : '')
      );
    }
    return `${fmtN(e.conDesp)} ${e.unidad}`;
  };

  /* ===== Agrupación por división para la vista Completa ===== */
  const gruposDiv = useMemo(() => {
    const g: Record<string, FilaExp[]> = {};
    explosion.forEach((e) => {
      const d = (e.div || 'Sin división').trim() || 'Sin división';
      if (!g[d]) g[d] = [];
      g[d].push(e);
    });
    const divs = Object.keys(g).sort((a, b) =>
      cmpCodigo(g[a][0]?.cod ?? '', g[b][0]?.cod ?? '')
    );
    return divs.map((d) => ({ div: d, filas: g[d] }));
  }, [explosion]);

  const totalCompra = explosion.reduce((s, e) => s + e.totalCompraPesos, 0);
  const totalTeorico = explosion.reduce(
    (s, e) => s + e.conDesp * motor.costoInsumoEnObra('M', e.cod, obra),
    0
  );

  /* Estilos del documento imprimible (siempre tinta sobre blanco) */
  const thDoc = 'py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500';
  const tdDoc = 'py-2 pr-4 border-b border-neutral-200 align-middle text-neutral-800';

  return (
    <div className="space-y-5">
      <header className="no-print">
        <h1 className="font-marca text-3xl tracking-tight">Explosión de insumos</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Materiales totales de la obra: cantidad técnica, desperdicio y conversión a presentación
          comercial.
        </p>
      </header>

      <SubTabs tabs={SUBS} activa={sub} onCambiar={setSub} />

      {sub === 'comparativa' ? (
        <Comparativa {...props} />
      ) : explosion.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Sin materiales para explotar: cargá ítems con APU en el cómputo.
        </Card>
      ) : sub === 'completa' ? (
        /* ══════════ COMPLETA ══════════ */
        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr>
                <th className={`${th} w-16`}>Código</th>
                <th className={th}>Material</th>
                <th className={`${th} w-12`}>Un.</th>
                <th className={`${th} w-24 text-right`}>Cant. necesaria</th>
                <th className={`${th} w-16 text-right`}>Desp. %</th>
                <th className={`${th} w-24 text-right`}>Con desperdicio</th>
                <th className={`${th} w-36 text-right`}>A comprar</th>
                <th className={`${th} w-24 text-right`} title="Precio unitario de la Presentación 1 (palet) c/IVA">
                  Precio P1
                </th>
                <th className={`${th} w-24 text-right`} title="Precio unitario de la Presentación 2 (suelto) c/IVA">
                  Precio P2
                </th>
                <th
                  className={`${th} w-28 text-right`}
                  title="Total a pagar al proveedor = comp1×PrecioP1 + comp2×PrecioP2 (c/IVA)"
                >
                  Total compra $
                </th>
                <th className={`${th} w-32`}>Proveedor</th>
              </tr>
            </thead>
            <tbody>
              {gruposDiv.map((g) => (
                <FilasDivision key={g.div} grupo={g} aComprarTexto={aComprarTexto} />
              ))}
              <tr className="font-semibold">
                <td className={`${td} border-t-2 border-[var(--borde)]`} colSpan={9}>
                  TOTAL COMPRA (presentaciones enteras, c/IVA)
                  <span className="ml-3 text-xs font-normal text-[var(--texto-2)]">
                    costo teórico β: {money(totalTeorico)}
                  </span>
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                  {totalCompra > 0 ? money(totalCompra) : '—'}
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)]`}></td>
              </tr>
            </tbody>
          </table>
        </Card>
      ) : (
        /* ══════════ A COMPRAR ══════════ */
        <div className="space-y-4">
          <Card className="no-print p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--texto-2)]">
                Rubros (tareas) a imprimir
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTodas(true)}
                  className="text-xs text-[var(--texto-2)] underline hover:text-[var(--texto)]"
                >
                  Todos
                </button>
                <button
                  onClick={() => setTodas(false)}
                  className="text-xs text-[var(--texto-2)] underline hover:text-[var(--texto)]"
                >
                  Ninguno
                </button>
                <Btn variante="primario" disabled={!algunaSel} onClick={() => window.print()}>
                  Imprimir selección
                </Btn>
              </div>
            </div>
            <p className="mb-2 text-[11px] text-[var(--texto-2)]">
              Cada rubro redondea a presentación comercial por separado: comprás lo de esa tarea
              sin arrastrar el resto.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {rubsDisp.map((rp) => {
                const g = explosionPorRubro.find((x) => x.rp === rp);
                return (
                  <label key={'chk-' + rp} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={estaSel(rp)}
                      onChange={() => toggleRubro(rp)}
                      className="accent-[var(--color-sud-azul)]"
                    />
                    {g ? `${g.rp} · ${g.nombre}` : rp}
                  </label>
                );
              })}
            </div>
          </Card>

          <div className="documento-print">
            <h2 className="font-marca mb-1 text-xl text-neutral-900">
              Lista de compra por rubro — {obra.nombre || obra.id}
            </h2>
            <p className="mb-4 text-xs text-neutral-500">
              Redondeo a presentación comercial por rubro (compra escalonada).
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thDoc}>Material</th>
                  <th className={`${thDoc} w-32 text-right`}>Cant. física</th>
                  <th className={`${thDoc} w-40`}>Presentación 1</th>
                  <th className={`${thDoc} w-40`}>Presentación 2</th>
                  <th className={`${thDoc} w-40 text-right`}>A comprar</th>
                </tr>
              </thead>
              <tbody>
                {explosionPorRubro
                  .filter((g) => estaSel(g.rp))
                  .map((g) => (
                    <FilasRubroComprar
                      key={'rubc-' + g.rp}
                      grupo={g}
                      tdDoc={tdDoc}
                      aComprarTexto={aComprarTexto}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Filas por división (vista Completa) ===== */
function FilasDivision({
  grupo,
  aComprarTexto
}: {
  grupo: { div: string; filas: FilaExp[] };
  aComprarTexto: (e: FilaExp) => string;
}) {
  return (
    <>
      <tr className="bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]">
        <td className={`${td} text-xs font-semibold uppercase tracking-wide`} colSpan={11}>
          {grupo.div}
        </td>
      </tr>
      {grupo.filas.map((e) => (
        <tr key={e.cod} className="hover:bg-[var(--color-neutro-100)]/40">
          <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{e.cod}</td>
          <td className={td}>{e.desc}</td>
          <td className={`${td} text-[var(--texto-2)]`}>{e.unidad}</td>
          <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(e.nec)}</td>
          <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>{fmtN(e.desp)}</td>
          <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(e.conDesp)}</td>
          <td className={`${td} text-right font-mono tabular-nums`}>
            {e.pres1 && e.comp1 !== null ? (
              aComprarTexto(e)
            ) : (
              <span className="text-xs text-[var(--texto-2)]">cargar presentación en Materiales</span>
            )}
          </td>
          <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
            {e.precioP1 > 0 ? money(e.precioP1) : '—'}
          </td>
          <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
            {e.precioP2 > 0 ? money(e.precioP2) : '—'}
          </td>
          <td className={`${td} text-right font-mono font-semibold tabular-nums`}>
            {e.totalCompraPesos > 0 ? money(e.totalCompraPesos) : '—'}
          </td>
          <td className={`${td} text-xs text-[var(--texto-2)]`}>{e.proveedor || '—'}</td>
        </tr>
      ))}
    </>
  );
}

/* ===== Filas por rubro (vista A comprar, dentro del documento imprimible) ===== */
interface MatComprar {
  cod: string;
  desc: string;
  unidad: string;
  conDesp: number;
  pres1: string;
  comp1: number | null;
  pres2: string;
  comp2: number | null;
  fac1: number;
  fac2: number;
}

function FilasRubroComprar({
  grupo,
  tdDoc,
  aComprarTexto
}: {
  grupo: { rp: string; nombre: string; mats: MatComprar[] };
  tdDoc: string;
  aComprarTexto: (e: MatComprar) => string;
}) {
  return (
    <>
      <tr>
        <td
          className="bg-neutral-900 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
          colSpan={5}
        >
          {grupo.rp} · {grupo.nombre}
        </td>
      </tr>
      {grupo.mats.map((e) => (
        <tr key={'c-' + e.cod}>
          <td className={tdDoc}>{e.desc}</td>
          <td className={`${tdDoc} text-right font-mono tabular-nums`}>
            {fmtN(e.conDesp)} <span className="text-xs text-neutral-400">{e.unidad}</span>
          </td>
          <td className={`${tdDoc} text-xs text-neutral-500`}>
            {e.pres1 ? (
              <span>
                {e.pres1}
                {e.fac1 > 0 ? <span className="text-neutral-400"> × {fmtN(e.fac1)} {e.unidad}</span> : ''}
              </span>
            ) : (
              '—'
            )}
          </td>
          <td className={`${tdDoc} text-xs text-neutral-500`}>
            {e.pres2 ? (
              <span>
                {e.pres2}
                {e.fac2 > 0 ? <span className="text-neutral-400"> × {fmtN(e.fac2)} {e.unidad}</span> : ''}
              </span>
            ) : (
              '—'
            )}
          </td>
          <td className={`${tdDoc} text-right font-mono tabular-nums`}>{aComprarTexto(e)}</td>
        </tr>
      ))}
    </>
  );
}
