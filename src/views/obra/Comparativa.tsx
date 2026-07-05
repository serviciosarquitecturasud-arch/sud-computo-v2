/**
 * Comparativa de proveedores por CANAL DE COMPRA (= división del catálogo) —
 * port del legacy R11 (Hito 1 de comparativa, post-hitos).
 *
 * Estructura persistida (paridad estricta con el legacy):
 *   obra.cotizacionesPorRubro[div] = { provs: [{nombre, iva}×3], precios: { [cod]: [p0, p1, p2] } }
 *
 * El precio que se carga es el COMERCIAL de la presentación 1 ($/bolsa, $/varilla).
 * "usar" / "Adjudicar rubro" copian ese precio a la Lista de materiales respetando
 * la base IVA del proveedor: 'con' → obra.precios.materialesConIVA[cod];
 * 'sin' → obra.precios.materiales[cod] (el motor lo lleva a c/IVA con ×1.21 al leer).
 */
import { useMemo } from 'react';
import { cmpCodigo, fmtN, materialesTotalObra, money } from '../../core';
import type { Catalogo, Motor, Obra, PreciosObra } from '../../core';
import { Card, td, th } from '../../ui/base';
import { EditCell } from '../../ui/edit';

type IvaBase = 'con' | 'sin';

interface ProvCot {
  nombre: string;
  iva: IvaBase;
  [k: string]: unknown;
}

interface CanalCot {
  provs?: ProvCot[];
  precios?: Record<string, (number | string)[]>;
}

type CotPorRubro = Record<string, CanalCot>;

interface ProveedoresObra {
  materiales?: Record<string, string>;
  [k: string]: unknown;
}

/** Fila de la comparativa: material de la explosión con presentación resuelta (override por obra). */
interface FilaCmp {
  cod: string;
  desc: string;
  unidad: string;
  /** Cantidad con desperdicio en unidad física */
  conDesp: number;
  pres1: string;
  fac1: number;
  /** Cantidad a comprar en presentación 1: ceil(conDesp / fac1); si fac1=0, conDesp directo */
  cant1: number;
  /** Unidad en que se carga el precio ("$/bolsa", "$/varilla", "$/kg") */
  unidadPrecio: string;
}

const SIN_DIV = 'Sin división';
const nuevoProvs = (): ProvCot[] => [
  { nombre: '', iva: 'sin' },
  { nombre: '', iva: 'sin' },
  { nombre: '', iva: 'sin' }
];

export function Comparativa({
  obra,
  setObra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}) {
  const cpr = (obra.cotizacionesPorRubro as CotPorRubro | undefined) ?? {};
  const getCanal = (d: string): CanalCot => cpr[d] ?? {};
  const getProvs = (d: string): ProvCot[] => {
    const p = getCanal(d).provs;
    return Array.isArray(p) && p.length === 3
      ? p.map((x) => ({ ...x, iva: x.iva === 'con' ? 'con' : 'sin' }))
      : nuevoProvs();
  };
  const getPrecio = (d: string, cod: string, i: number): number | string => {
    const fila = getCanal(d).precios?.[cod];
    return (fila && fila[i]) || '';
  };

  /* ===== Explosión agrupada por división (canal de compra) ===== */
  const grupos = useMemo(() => {
    const cfgTodos = obra.materialesConfig ?? {};
    const g: Record<string, FilaCmp[]> = {};
    materialesTotalObra(obra, motor).forEach((f) => {
      const mat = motor.matMap[f.matCod];
      const ov = cfgTodos[f.matCod] ?? {};
      const pick = (v: number | string | undefined, def: number | string): number | string =>
        v !== undefined && v !== null && v !== '' ? v : def;
      const desp = Number(pick(ov.desp, mat?.desp ?? 0)) || 0;
      const pres1 = String(pick(ov.pres1, mat?.pres1 ?? ''));
      const fac1 = Number(pick(ov.fac1, mat?.fac1 ?? 0)) || 0;
      const conDesp = f.cantidad * (1 + desp / 100);
      const cant1 = fac1 > 0 ? Math.ceil(conDesp / fac1) : conDesp;
      const div = (mat?.div ?? '').trim() || SIN_DIV;
      if (!g[div]) g[div] = [];
      g[div].push({
        cod: f.matCod,
        desc: f.matDesc,
        unidad: f.unidad,
        conDesp,
        pres1,
        fac1,
        cant1,
        unidadPrecio: fac1 > 0 ? pres1 || 'pres.' : f.unidad || 'un'
      });
    });
    Object.values(g).forEach((arr) => arr.sort((a, b) => cmpCodigo(a.cod, b.cod)));
    return g;
  }, [obra, motor]);

  const divs = Object.keys(grupos).sort((a, b) =>
    cmpCodigo(grupos[a][0]?.cod ?? '', grupos[b][0]?.cod ?? '')
  );

  /* ===== Escrituras inmutables sobre cotizacionesPorRubro ===== */
  const setCanal = (d: string, canal: CanalCot) =>
    setObra({ ...obra, cotizacionesPorRubro: { ...cpr, [d]: canal } });

  const setPrecio = (d: string, cod: string, i: number, val: string) => {
    const canal = getCanal(d);
    const precios = { ...(canal.precios ?? {}) };
    const fila = (precios[cod] ?? ['', '', '']).slice();
    fila[i] = val;
    precios[cod] = fila;
    setCanal(d, { provs: getProvs(d), precios });
  };

  const setProvCampo = (d: string, i: number, campo: 'nombre' | 'iva', val: string) => {
    const provs = getProvs(d).map((p, j) => (j === i ? { ...p, [campo]: val } : p));
    setCanal(d, { provs, precios: getCanal(d).precios ?? {} });
  };

  /* ===== Totales y ganador (compra REAL: Σ cant1 × precio comercial) ===== */
  const totalItem = (f: FilaCmp, precio: number | string): number => {
    const u = Number(precio) || 0;
    return u > 0 ? u * f.cant1 : 0;
  };
  const totalesProvCanal = (d: string): number[] =>
    [0, 1, 2].map((i) => (grupos[d] ?? []).reduce((acc, f) => acc + totalItem(f, getPrecio(d, f.cod, i)), 0));
  const ganadorCanal = (tots: number[]): number => {
    const validos = tots.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
    if (validos.length === 0) return -1;
    return validos.reduce((min, x) => (x.v < min.v ? x : min), validos[0]).i;
  };

  /* ===== Puente con la Lista de materiales (criterio exacto del legacy) =====
     'con' → materialesConIVA[cod] = precio (y se borra materiales[cod]);
     'sin' → materiales[cod] = precio (y se borra materialesConIVA[cod]).
     La conversión ×1.21 la hace el motor al leer materiales (sin IVA). */
  const aplicarPrecios = (pares: { cod: string; u: number }[], iva: IvaBase, nombreProv: string) => {
    const prec: PreciosObra = obra.precios ?? {};
    const mat = { ...(prec.materiales ?? {}) };
    const matIVA = { ...(prec.materialesConIVA ?? {}) };
    const provsObra = (obra.proveedores as ProveedoresObra | undefined) ?? {};
    const reg = { ...(provsObra.materiales ?? {}) };
    pares.forEach(({ cod, u }) => {
      if (iva === 'con') {
        matIVA[cod] = u;
        delete mat[cod];
      } else {
        mat[cod] = u;
        delete matIVA[cod];
      }
      reg[cod] = nombreProv;
    });
    setObra({
      ...obra,
      precios: { ...prec, materiales: mat, materialesConIVA: matIVA },
      proveedores: { ...provsObra, materiales: reg }
    });
  };

  const usarPrecio = (d: string, cod: string, i: number) => {
    const u = Number(getPrecio(d, cod, i)) || 0;
    if (u <= 0) return;
    const prov = getProvs(d)[i];
    aplicarPrecios([{ cod, u }], prov.iva, prov.nombre || `Prov. ${i + 1}`);
  };

  const quitarPrecio = (cod: string) => {
    const prec: PreciosObra = obra.precios ?? {};
    const mat = { ...(prec.materiales ?? {}) };
    const matIVA = { ...(prec.materialesConIVA ?? {}) };
    delete mat[cod];
    delete matIVA[cod];
    const provsObra = (obra.proveedores as ProveedoresObra | undefined) ?? {};
    const reg = { ...(provsObra.materiales ?? {}) };
    delete reg[cod];
    setObra({
      ...obra,
      precios: { ...prec, materiales: mat, materialesConIVA: matIVA },
      proveedores: { ...provsObra, materiales: reg }
    });
  };

  /** Testigo "en uso": el precio de esta celda coincide (±0.005) con el aplicado en la
      Lista de materiales, SOBRE LA MISMA BASE IVA (con → materialesConIVA, sin → materiales). */
  const precioEnUso = (d: string, cod: string, i: number): boolean => {
    const u = Number(getPrecio(d, cod, i)) || 0;
    if (u <= 0) return false;
    const iva = getProvs(d)[i].iva;
    const prec: PreciosObra = obra.precios ?? {};
    const enLista =
      iva === 'con'
        ? Number((prec.materialesConIVA ?? {})[cod])
        : Number((prec.materiales ?? {})[cod]);
    if (!enLista || isNaN(enLista)) return false;
    return Math.abs(enLista - u) < 0.005;
  };

  const adjudicarRubro = (d: string) => {
    const gi = ganadorCanal(totalesProvCanal(d));
    if (gi < 0) {
      alert('No hay precios cargados en este rubro todavía.');
      return;
    }
    const prov = getProvs(d)[gi];
    const nombreProv = prov.nombre || `Prov. ${gi + 1}`;
    const pares = (grupos[d] ?? [])
      .map((f) => ({ cod: f.cod, u: Number(getPrecio(d, f.cod, gi)) || 0 }))
      .filter((p) => p.u > 0);
    if (
      !confirm(
        `Adjudicar "${d}" a ${nombreProv}: se copiarán ${pares.length} precio(s) a la Lista de materiales. ¿Confirmar?`
      )
    )
      return;
    aplicarPrecios(pares, prov.iva, nombreProv);
  };

  const totalGeneral = divs.reduce((acc, d) => {
    const tots = totalesProvCanal(d);
    const gi = ganadorCanal(tots);
    return acc + (gi >= 0 ? tots[gi] : 0);
  }, 0);

  const inputCls =
    'w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-1.5 py-0.5 text-xs ' +
    'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Comparativa de proveedores</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--texto-2)]">
          Cada rubro (canal de compra) tiene su propia terna de proveedores: corralón, sanitarios,
          aberturas… Cargá el precio COMERCIAL de la presentación ($/bolsa, $/varilla). El ganador
          es el proveedor con menor total del rubro completo. «Adjudicar rubro» copia los precios
          del ganador a la Lista de materiales; «usar» copia un precio puntual.
        </p>
      </header>

      {divs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Sin materiales para comparar: cargá ítems con APU en el cómputo para armar la explosión.
        </Card>
      ) : (
        <>
          {divs.map((d) => {
            const filas = grupos[d] ?? [];
            const provs = getProvs(d);
            const tots = totalesProvCanal(d);
            const gi = ganadorCanal(tots);
            const itemsGanador =
              gi >= 0 ? filas.filter((f) => (Number(getPrecio(d, f.cod, gi)) || 0) > 0) : [];
            const itemsAplicados =
              gi >= 0 ? itemsGanador.filter((f) => precioEnUso(d, f.cod, gi)).length : 0;
            const totalAdj = itemsGanador.length > 0 && itemsAplicados === itemsGanador.length;
            const parcialAdj = itemsAplicados > 0 && !totalAdj;
            const nombreDe = (i: number) => provs[i].nombre || `Prov. ${i + 1}`;

            return (
              <Card key={d} className="pb-1">
                {/* Cabecera sticky del canal: nombre + adjudicar + terna de proveedores */}
                <div className="sticky top-0 z-10 rounded-t-[var(--radius-card)] bg-[var(--panel)]">
                  <div className="flex items-center justify-between gap-3 rounded-t-[var(--radius-card)] bg-[var(--color-sud-tinta)] px-3 py-2 text-[var(--color-sud-crema)]">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em]">{d}</span>
                    <button
                      onClick={() => adjudicarRubro(d)}
                      title={
                        totalAdj
                          ? 'Rubro adjudicado al ganador. Cliqueá para re-aplicar.'
                          : 'Aplicar los precios del ganador a la Lista de materiales'
                      }
                      className={
                        'whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors ' +
                        (totalAdj
                          ? 'bg-[var(--color-ok)] text-white hover:opacity-90'
                          : 'bg-[var(--color-sud-crema)] text-[var(--color-sud-tinta)] hover:opacity-85')
                      }
                    >
                      {totalAdj
                        ? `Adjudicado ✓ ${provs[gi].nombre || `Prov. ${gi + 1}`}`
                        : parcialAdj
                          ? `Adjudicar resto (${itemsAplicados}/${itemsGanador.length})`
                          : 'Adjudicar rubro'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-b border-[var(--borde)] bg-[var(--panel)] px-2 py-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={
                          'rounded p-1.5 ' +
                          (i === gi
                            ? 'border border-[var(--color-ok)]/50 bg-[var(--color-ok)]/8'
                            : 'border border-transparent')
                        }
                      >
                        <EditCell
                          value={provs[i].nombre}
                          placeholder={`Proveedor ${i + 1}`}
                          onCommit={(v) => setProvCampo(d, i, 'nombre', v)}
                          className="mb-1 !text-xs"
                        />
                        <select
                          className={`${inputCls} mb-1 text-[var(--texto-2)]`}
                          value={provs[i].iva}
                          onChange={(e) => setProvCampo(d, i, 'iva', e.target.value)}
                        >
                          <option value="sin">Precio sin IVA</option>
                          <option value="con">Precio con IVA</option>
                        </select>
                        <div
                          className={
                            'text-right font-mono text-[11px] tabular-nums ' +
                            (i === gi
                              ? 'font-semibold text-[var(--color-ok)]'
                              : 'text-[var(--texto-2)]')
                          }
                        >
                          {tots[i] > 0 ? `Total ${money(tots[i])}${i === gi ? ' ✓' : ''}` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto px-3 pb-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={`${th} w-20`}>Ítem</th>
                        <th className={th}>Material</th>
                        <th className={`${th} w-28 text-right`}>A comprar</th>
                        {[0, 1, 2].map((i) => (
                          <th
                            key={i}
                            className={`${th} w-40 text-right ${i === gi ? 'text-[var(--color-ok)]' : ''}`}
                          >
                            {nombreDe(i)}
                            {i === gi ? ' ✓' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f) => {
                        const totFila = [0, 1, 2].map((i) => totalItem(f, getPrecio(d, f.cod, i)));
                        const validos = totFila.filter((v) => v > 0);
                        const minFila = validos.length > 0 ? Math.min(...validos) : null;
                        const giFila =
                          minFila !== null ? totFila.findIndex((v) => v === minFila && v > 0) : -1;
                        return (
                          <tr key={f.cod}>
                            <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{f.cod}</td>
                            <td className={td}>
                              {f.desc}
                              <span className="ml-1.5 text-xs text-[var(--texto-2)]">
                                {f.fac1 > 0
                                  ? `(${f.pres1 || 'pres.'} × ${fmtN(f.fac1)} ${f.unidad})`
                                  : ''}
                              </span>
                            </td>
                            <td className={`${td} whitespace-nowrap text-right font-mono text-xs tabular-nums`}>
                              {fmtN(f.cant1)} {f.fac1 > 0 ? f.pres1 || 'pres.' : f.unidad}
                            </td>
                            {[0, 1, 2].map((i) => {
                              const u = Number(getPrecio(d, f.cod, i)) || 0;
                              const enUso = precioEnUso(d, f.cod, i);
                              return (
                                <td
                                  key={i}
                                  className={`${td} ${i === giFila ? 'bg-[var(--color-ok)]/10' : ''}`}
                                >
                                  <EditCell
                                    tipo="number"
                                    value={getPrecio(d, f.cod, i)}
                                    placeholder={`$/${f.unidadPrecio}`}
                                    onCommit={(v) => setPrecio(d, f.cod, i, v)}
                                  />
                                  <div className="mt-0.5 flex items-center justify-end gap-1">
                                    <span className="font-mono text-[10px] tabular-nums text-[var(--texto-2)]">
                                      {totFila[i] > 0 ? `Tot ${money(totFila[i])}` : ''}
                                    </span>
                                    {u > 0 &&
                                      (enUso ? (
                                        <span className="flex items-center gap-0.5">
                                          <span
                                            title="Este precio está aplicado en la Lista de materiales"
                                            className="rounded border border-[var(--color-ok)] bg-[var(--color-ok)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-ok)]"
                                          >
                                            en uso ✓
                                          </span>
                                          <button
                                            onClick={() => quitarPrecio(f.cod)}
                                            title="Quitar este precio de la Lista de materiales"
                                            className="rounded border border-[var(--borde)] px-1 py-0.5 text-[11px] text-[var(--texto-2)] hover:border-[var(--color-alerta)] hover:text-[var(--color-alerta)]"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => usarPrecio(d, f.cod, i)}
                                          title="Aplicar este precio a la Lista de materiales"
                                          className="rounded border border-[var(--color-sud-naranja)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-sud-naranja)] hover:bg-[var(--color-sud-naranja)]/10"
                                        >
                                          usar
                                        </button>
                                      ))}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="text-xs font-semibold">
                        <td className={`${td} border-t-2 border-[var(--borde)]`} colSpan={3}>
                          Total del rubro por proveedor
                        </td>
                        {[0, 1, 2].map((i) => (
                          <td
                            key={i}
                            className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums ${
                              i === gi ? 'text-[var(--color-ok)]' : 'text-[var(--texto-2)]'
                            }`}
                          >
                            {tots[i] > 0 ? money(tots[i]) : '—'}
                          </td>
                        ))}
                      </tr>
                      {gi >= 0 && (
                        <tr>
                          <td
                            className="px-2 py-1.5 text-xs font-medium text-[var(--color-ok)]"
                            colSpan={6}
                          >
                            Ganador del rubro: {nombreDe(gi)} · {money(tots[gi])}
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </Card>
            );
          })}

          <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-[var(--color-sud-tinta)] px-4 py-3 text-[var(--color-sud-crema)]">
            <span className="text-sm">Total general (cada rubro a su proveedor ganador)</span>
            <span className="font-mono font-semibold tabular-nums">{money(totalGeneral)}</span>
          </div>
        </>
      )}
    </div>
  );
}
