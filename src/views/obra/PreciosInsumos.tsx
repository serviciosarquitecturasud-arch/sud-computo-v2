/**
 * Precios y proveedores POR OBRA para mano de obra y equipos — port del legacy
 * `function Precios` (sub-tabs 'mo' y 'herr' con forceSub).
 *
 * Passthrough exacto de campos del legacy (compatibilidad de datos):
 *   obra.precios.manoObra[cod]          → override del valor hora / valor SC
 *   obra.precios.herramientas[cod]      → valor del equipo SIN IVA (alimenta el motor)
 *   obra.precios.herramientasConIVA[cod]→ valor CON IVA (UX; última editada manda, ×/÷ 1.21)
 *   obra.proveedores.manoObra[cod]      → contratista
 *   obra.proveedores.herramientas[cod]  → proveedor
 */
import { useMemo, useState } from 'react';
import { cmpCodigo, costoHerramienta, IVA_RATE_MOTOR, money } from '../../core';
import type { Catalogo, Motor, Obra, PreciosObra } from '../../core';
import { Card, td, th } from '../../ui/base';
import { EditCell } from '../../ui/edit';

type MapaNum = Record<string, number | string>;
type MapaStr = Record<string, string>;

interface ProveedoresObra {
  materiales?: MapaStr;
  manoObra?: MapaStr;
  herramientas?: MapaStr;
  [k: string]: unknown;
}

/** obra.precios con los campos extra que el core no tipa (passthrough). */
type PreciosExt = PreciosObra & { herramientasConIVA?: MapaNum; [k: string]: unknown };

interface Props {
  tipo: 'mo' | 'herr';
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

const r2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

const limpio = (v: string): boolean => v === null || v === undefined || v.trim() === '';

export function PreciosInsumos({ tipo, obra, setObra, cat }: Props) {
  const [q, setQ] = useState('');

  const oPrec = (obra.precios ?? {}) as PreciosExt;
  const oProv = (obra.proveedores as ProveedoresObra | undefined) ?? {};

  /* ===== Escrituras (idénticas al legacy) ===== */
  const setOverride = (cod: string, val: string) => {
    const prec = { ...oPrec };
    const seccion = { ...(prec.manoObra ?? {}) };
    if (limpio(val)) delete seccion[cod];
    else seccion[cod] = Number(val) || 0;
    prec.manoObra = seccion;
    setObra({ ...obra, precios: prec });
  };

  const setPrecioSinIVA = (cod: string, val: string) => {
    const prec = { ...oPrec };
    const sinMap = { ...(prec.herramientas ?? {}) };
    const conMap = { ...(prec.herramientasConIVA ?? {}) };
    if (limpio(val)) {
      delete sinMap[cod];
      delete conMap[cod];
    } else {
      const sinIva = Number(val) || 0;
      sinMap[cod] = sinIva;
      conMap[cod] = r2(sinIva * (1 + IVA_RATE_MOTOR));
    }
    prec.herramientas = sinMap;
    prec.herramientasConIVA = conMap;
    setObra({ ...obra, precios: prec });
  };

  const setPrecioConIVA = (cod: string, val: string) => {
    const prec = { ...oPrec };
    const sinMap = { ...(prec.herramientas ?? {}) };
    const conMap = { ...(prec.herramientasConIVA ?? {}) };
    if (limpio(val)) {
      delete sinMap[cod];
      delete conMap[cod];
    } else {
      const conIva = Number(val) || 0;
      conMap[cod] = conIva;
      sinMap[cod] = r2(conIva / (1 + IVA_RATE_MOTOR));
    }
    prec.herramientas = sinMap;
    prec.herramientasConIVA = conMap;
    setObra({ ...obra, precios: prec });
  };

  const setProveedor = (tipoKey: 'manoObra' | 'herramientas', cod: string, val: string) => {
    const prov = { ...oProv };
    const seccion = { ...(prov[tipoKey] ?? {}) };
    const v = (val || '').trim();
    if (v === '') delete seccion[cod];
    else seccion[cod] = v;
    prov[tipoKey] = seccion;
    setObra({ ...obra, proveedores: prov });
  };

  const getValorConIVA = (cod: string): number | string => {
    const conMap = oPrec.herramientasConIVA ?? {};
    if (cod in conMap && conMap[cod] !== '' && conMap[cod] !== null && conMap[cod] !== undefined)
      return conMap[cod];
    const sinMap = oPrec.herramientas ?? {};
    if (cod in sinMap && sinMap[cod] !== '' && sinMap[cod] !== null && sinMap[cod] !== undefined)
      return r2((Number(sinMap[cod]) || 0) * (1 + IVA_RATE_MOTOR));
    return '';
  };

  /* ===== Insumos EN USO (APUs de ítems con cant > 0) ===== */
  const insumosEnUso = useMemo(() => {
    const MO = new Set<string>();
    const EQ = new Set<string>();
    const apusComputados = new Set(
      (obra.items ?? []).filter((it) => Number(it.cant) > 0).map((it) => it.cod)
    );
    (cat.biblioteca ?? []).forEach((b) => {
      if (!apusComputados.has(b.apu)) return;
      if (b.tipo === 'MO') MO.add(b.insumo);
      else if (b.tipo === 'E') EQ.add(b.insumo);
    });
    return { MO, EQ };
  }, [obra.items, cat.biblioteca]);

  const hayItemsComputados = (obra.items ?? []).some((it) => Number(it.cant) > 0);

  const coincide = (cod: string, desc: string): boolean => {
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return (cod + ' ' + desc).toLowerCase().includes(qq);
  };

  const encabezado = (titulo: string, n: number, total: number, enUso?: boolean) => (
    <div
      className={`mb-1 mt-4 flex items-center gap-2 rounded-md border-l-4 px-3 py-2 ${
        enUso
          ? 'border-[var(--color-sud-azul)] bg-[var(--color-sud-azul)]/10'
          : 'border-[var(--borde)] bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]'
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.08em]">{titulo}</span>
      <span className="text-xs text-[var(--texto-2)]">
        · {n} de {total}
        {n !== total ? ' (filtrados)' : ''}
      </span>
    </div>
  );

  /* ===== Tabla mano de obra ===== */
  const tablaMO = (lista: typeof cat.manoObra) => {
    const overrideMap = oPrec.manoObra ?? {};
    const provMap = oProv.manoObra ?? {};
    return (
      <Card className="overflow-x-auto p-4">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className={`${th} w-16`}>Ítem</th>
              <th className={th}>Descripción</th>
              <th className={`${th} w-16`}>Un.</th>
              <th className={`${th} w-28 text-right`}>Valor genérico</th>
              <th className={`${th} w-32 text-right`}>Valor en esta obra</th>
              <th className={`${th} w-44`}>Contratista</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((mo) => {
              const valorGen = Number(mo.valor) || 0;
              const tieneOv = mo.cod in overrideMap;
              const efectivo = tieneOv ? Number(overrideMap[mo.cod]) || 0 : valorGen;
              return (
                <tr key={mo.cod} className="hover:bg-[var(--color-neutro-100)]/40">
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{mo.cod}</td>
                  <td className={td}>{mo.desc}</td>
                  <td className={`${td} text-[var(--texto-2)]`}>{mo.unidad || 'hs'}</td>
                  <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
                    {valorGen > 0 ? money(valorGen) : '—'}
                  </td>
                  <td className={`${td} ${efectivo > 0 ? '' : 'bg-[var(--color-alerta)]/8'}`}>
                    <EditCell
                      tipo="number"
                      value={tieneOv ? String(overrideMap[mo.cod]) : ''}
                      placeholder={valorGen > 0 ? String(valorGen) : 'genérico'}
                      onCommit={(v) => setOverride(mo.cod, v)}
                    />
                  </td>
                  <td className={td}>
                    <EditCell
                      value={provMap[mo.cod] ?? ''}
                      placeholder="genérico"
                      onCommit={(v) => setProveedor('manoObra', mo.cod, v)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    );
  };

  /* ===== Tabla equipos ===== */
  const tablaHerr = (lista: typeof cat.herramientas) => {
    const overrideMap = oPrec.herramientas ?? {};
    const provMap = oProv.herramientas ?? {};
    return (
      <Card className="overflow-x-auto p-4">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              <th className={`${th} w-16`}>Ítem</th>
              <th className={th}>Descripción</th>
              <th className={`${th} w-20`}>Tenencia</th>
              <th className={`${th} w-28 text-right`}>Valor genérico</th>
              <th className={`${th} w-32 text-right`}>Valor sin IVA</th>
              <th className={`${th} w-32 text-right`}>Valor con IVA (21%)</th>
              <th className={`${th} w-24 text-right`}>Costo/h</th>
              <th className={`${th} w-44`}>Proveedor</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((h) => {
              const valorGen = Number(h.valor) || 0;
              const tieneOv = h.cod in overrideMap;
              const hCalc = tieneOv ? { ...h, valor: Number(overrideMap[h.cod]) || 0 } : h;
              const costoH = costoHerramienta(hCalc);
              return (
                <tr key={h.cod} className="hover:bg-[var(--color-neutro-100)]/40">
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{h.cod}</td>
                  <td className={td}>{h.desc}</td>
                  <td className={`${td} text-xs text-[var(--texto-2)]`}>{h.tenencia || '—'}</td>
                  <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
                    {valorGen > 0 ? money(valorGen) : '—'}
                  </td>
                  <td className={td}>
                    <EditCell
                      tipo="number"
                      value={tieneOv ? String(overrideMap[h.cod]) : ''}
                      placeholder={valorGen > 0 ? String(valorGen) : 'genérico'}
                      onCommit={(v) => setPrecioSinIVA(h.cod, v)}
                    />
                  </td>
                  <td className={td}>
                    <EditCell
                      tipo="number"
                      value={String(getValorConIVA(h.cod))}
                      placeholder="c/IVA"
                      onCommit={(v) => setPrecioConIVA(h.cod, v)}
                    />
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>
                    {costoH > 0 ? money(costoH) : '—'}
                  </td>
                  <td className={td}>
                    <EditCell
                      value={provMap[h.cod] ?? ''}
                      placeholder="genérico"
                      onCommit={(v) => setProveedor('herramientas', h.cod, v)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    );
  };

  /* ===== Render por tipo ===== */
  const esMO = tipo === 'mo';
  const catalogoFull = esMO ? (cat.manoObra ?? []) : (cat.herramientas ?? []);
  const setEnUso = esMO ? insumosEnUso.MO : insumosEnUso.EQ;
  const filtrados = catalogoFull
    .filter((x) => coincide(x.cod, x.desc))
    .sort((a, b) => cmpCodigo(a.cod, b.cod));
  const enUso = filtrados.filter((x) => setEnUso.has(x.cod));

  return (
    <div className="space-y-3">
      <Card className="p-3 text-sm">
        <div className="font-medium">Precios y {esMO ? 'contratistas' : 'proveedores'} por obra</div>
        <p className="mt-1 text-xs text-[var(--texto-2)]">
          Cargá el precio y el nombre del {esMO ? 'contratista' : 'proveedor'} que trabaja en{' '}
          <span className="italic">esta obra</span>. Si dejás el precio vacío, se usa el precio
          genérico del catálogo. Si dejás el {esMO ? 'contratista' : 'proveedor'} vacío, queda como
          «genérico».
          {!esMO &&
            ' Se sobrescribe solo el valor del equipo (precio de compra si es propio, tarifa por jornada si es alquilado); vida útil, combustible y reparaciones siguen siendo genéricos.'}
        </p>
      </Card>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por código o descripción…"
        className="w-full max-w-md rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-sud-azul)]"
      />

      {catalogoFull.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          No hay {esMO ? 'mano de obra' : 'equipos'} en el catálogo.
        </Card>
      ) : (
        <>
          {!hayItemsComputados && (
            <Card className="p-3 text-sm text-[var(--texto-2)]">
              Esta obra todavía no tiene ítems con cómputo. Cargá cantidades en el cómputo para que
              aparezcan los insumos en uso acá arriba.
            </Card>
          )}
          {hayItemsComputados && setEnUso.size > 0 && (
            <>
              {encabezado('EN USO en esta obra', enUso.length, setEnUso.size, true)}
              {enUso.length > 0 ? (
                esMO ? (
                  tablaMO(enUso as typeof cat.manoObra)
                ) : (
                  tablaHerr(enUso as typeof cat.herramientas)
                )
              ) : (
                <p className="px-2 text-xs italic text-[var(--texto-2)]">
                  Ningún insumo en uso coincide con la búsqueda.
                </p>
              )}
            </>
          )}
          {encabezado('Listado completo del catálogo', filtrados.length, catalogoFull.length)}
          {filtrados.length > 0 ? (
            esMO ? (
              tablaMO(filtrados as typeof cat.manoObra)
            ) : (
              tablaHerr(filtrados as typeof cat.herramientas)
            )
          ) : (
            <p className="px-2 text-xs italic text-[var(--texto-2)]">
              Nada coincide con la búsqueda.
            </p>
          )}
        </>
      )}
    </div>
  );
}
