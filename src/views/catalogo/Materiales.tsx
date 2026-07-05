/** Catálogo · Materiales — tabla editable + administración de divisiones canónicas. */
import { useMemo, useState } from 'react';
import { cmpCodigo } from '../../core';
import type { Catalogo, Material, Motor } from '../../core';
import { Btn, Card, td, th } from '../../ui/base';
import { EditCell, EditSelect } from '../../ui/edit';

const inputCls =
  'rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-sud-azul)]';

export function Materiales({
  cat,
  setCat
}: {
  cat: Catalogo;
  setCat: (c: Catalogo) => void;
  motor: Motor;
}) {
  const [q, setQ] = useState('');
  const [div, setDiv] = useState('');
  const [subTab, setSubTab] = useState<'materiales' | 'divisiones'>('materiales');

  // Lista canónica de divisiones. Fallback a las usadas si aún no migró.
  const divisionesCanon = useMemo(
    () =>
      Array.isArray(cat.divisiones) && cat.divisiones.length
        ? [...cat.divisiones].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
        : [...new Set(cat.materiales.map((m) => m.div).filter(Boolean))].sort(),
    [cat.divisiones, cat.materiales]
  );

  // Divisiones "huérfanas": usadas por algún material pero ausentes de la lista canónica.
  const huerfanas = useMemo(() => {
    const canon = new Set(divisionesCanon);
    return [...new Set(cat.materiales.map((m) => (m.div || '').trim()).filter(Boolean))]
      .filter((d) => !canon.has(d))
      .sort();
  }, [cat.materiales, divisionesCanon]);

  const conteoPorDiv = useMemo(() => {
    const c: Record<string, number> = {};
    cat.materiales.forEach((m) => {
      const d = (m.div || '').trim();
      if (d) c[d] = (c[d] || 0) + 1;
    });
    return c;
  }, [cat.materiales]);

  const list = useMemo(
    () =>
      cat.materiales
        .filter(
          (m) =>
            (!div || m.div === div) &&
            (!q || (m.cod + ' ' + m.desc).toLowerCase().includes(q.toLowerCase()))
        )
        .sort((a, b) => cmpCodigo(a.cod, b.cod)),
    [cat.materiales, q, div]
  );

  const upd = (cod: string, patch: Partial<Material>) =>
    setCat({
      ...cat,
      materiales: cat.materiales.map((m) => (m.cod === cod ? { ...m, ...patch } : m))
    });

  const del = (cod: string) => {
    if (confirm('¿Eliminar el material ' + cod + '?'))
      setCat({ ...cat, materiales: cat.materiales.filter((m) => m.cod !== cod) });
  };

  /** Código sugerido: siguiente número libre entre los códigos numéricos. */
  const codigoSugerido = () => {
    const nums = cat.materiales.map((m) => parseInt(m.cod, 10)).filter((n) => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1).padStart(3, '0');
  };

  const add = () => {
    const cod = (prompt('Código del nuevo material:', codigoSugerido()) || '').trim();
    if (!cod) return;
    if (cat.materiales.some((m) => m.cod === cod)) {
      alert('Ya existe ese código.');
      return;
    }
    setCat({
      ...cat,
      materiales: [
        { cod, desc: '', unidad: '', precio: 0, div: div || '', desp: 0, pres1: '', fac1: 0, pres2: '', fac2: 0 },
        ...cat.materiales
      ]
    });
  };

  /* ===== Divisiones canónicas ===== */
  const baseDiv = Array.isArray(cat.divisiones) ? cat.divisiones : divisionesCanon;

  const addDivision = () => {
    const nombre = (prompt('Nombre de la nueva división:') || '').trim();
    if (!nombre) return;
    if (divisionesCanon.some((d) => d.toLowerCase() === nombre.toLowerCase())) {
      alert('Ya existe una división con ese nombre.');
      return;
    }
    setCat({ ...cat, divisiones: [...baseDiv, nombre] });
  };

  // Renombrar NO toca los materiales existentes: los que usaban el nombre viejo
  // quedan "sin clasificar" hasta reasignarlos (o adoptar la división vieja).
  const renameDivision = (viejo: string) => {
    const nuevo = (prompt('Nuevo nombre para la división "' + viejo + '":', viejo) || '').trim();
    if (!nuevo || nuevo === viejo) return;
    if (divisionesCanon.some((d) => d.toLowerCase() === nuevo.toLowerCase() && d !== viejo)) {
      alert('Ya existe una división con ese nombre.');
      return;
    }
    setCat({ ...cat, divisiones: baseDiv.map((d) => (d === viejo ? nuevo : d)) });
  };

  const delDivision = (nombre: string) => {
    const enUso = conteoPorDiv[nombre] || 0;
    if (enUso > 0) {
      alert(
        'No se puede eliminar "' + nombre + '": hay ' + enUso + ' material(es) usándola. Reasignalos primero.'
      );
      return;
    }
    if (!confirm('¿Eliminar la división "' + nombre + '"?')) return;
    setCat({ ...cat, divisiones: baseDiv.filter((d) => d !== nombre) });
  };

  const adoptarHuerfana = (nombre: string) => setCat({ ...cat, divisiones: [...baseDiv, nombre] });

  return (
    <div>
      <header className="mb-4">
        <h1 className="font-marca text-3xl tracking-tight">Materiales</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          {cat.materiales.length} materiales · catálogo central. El precio es por unidad física, puesto en obra.
        </p>
      </header>

      <div className="mb-4 flex gap-1 border-b border-[var(--borde)]">
        {(
          [
            ['materiales', 'Materiales'],
            ['divisiones', 'Divisiones']
          ] as const
        ).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setSubTab(k)}
            className={
              '-mb-px border-b-2 px-3 py-2 text-sm ' +
              (subTab === k
                ? 'border-[var(--color-sud-azul)] font-medium text-[var(--texto)]'
                : 'border-transparent text-[var(--texto-2)] hover:text-[var(--texto)]')
            }
          >
            {lbl + (k === 'divisiones' && huerfanas.length ? ` (${huerfanas.length} sin clasificar)` : '')}
          </button>
        ))}
      </div>

      {subTab === 'divisiones' && (
        <div className="max-w-3xl">
          <div className="mb-3 flex items-start justify-between gap-4">
            <p className="max-w-2xl text-xs text-[var(--texto-2)]">
              Definí acá las divisiones del catálogo. Luego, en la pestaña Materiales, asigná cada material a
              una división desde el desplegable. Renombrar una división no modifica los materiales existentes:
              quedan “sin clasificar” hasta que los reasignes.
            </p>
            <Btn variante="primario" onClick={addDivision}>
              + División
            </Btn>
          </div>

          {huerfanas.length > 0 && (
            <div className="mb-3 rounded-md border border-[var(--color-alerta)]/40 bg-[var(--color-alerta)]/10 p-3">
              <div className="mb-2 text-xs font-medium">
                Divisiones sin clasificar (usadas por materiales pero fuera de la lista canónica). Adoptalas o
                reasigná esos materiales.
              </div>
              <div className="flex flex-wrap gap-2">
                {huerfanas.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1.5 rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1 text-xs"
                  >
                    {h} <span className="text-[var(--texto-2)]">({conteoPorDiv[h] || 0})</span>
                    <button className="underline hover:opacity-70" onClick={() => adoptarHuerfana(h)}>
                      adoptar
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Card className="overflow-hidden p-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>División</th>
                  <th className={th + ' w-32 text-right'}>Materiales</th>
                  <th className={th + ' w-40 text-center'}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {divisionesCanon.length === 0 ? (
                  <tr>
                    <td className={td + ' italic text-[var(--texto-2)]'} colSpan={3}>
                      No hay divisiones cargadas. Creá la primera con el botón “División”.
                    </td>
                  </tr>
                ) : (
                  divisionesCanon.map((d) => (
                    <tr key={d}>
                      <td className={td + ' font-medium'}>{d}</td>
                      <td className={td + ' text-right font-mono tabular-nums text-[var(--texto-2)]'}>
                        {conteoPorDiv[d] || 0}
                      </td>
                      <td className={td + ' text-center'}>
                        <button className="mr-3 text-xs underline hover:opacity-70" onClick={() => renameDivision(d)}>
                          renombrar
                        </button>
                        <button
                          className="text-xs text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                          onClick={() => delDivision(d)}
                        >
                          eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {subTab === 'materiales' && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar código o descripción"
              className={inputCls + ' w-72'}
            />
            <select value={div} onChange={(e) => setDiv(e.target.value)} className={inputCls}>
              <option value="">Todas las divisiones</option>
              {[...divisionesCanon, ...huerfanas].map((d) => (
                <option key={d} value={d}>
                  {d + (huerfanas.includes(d) ? ' (sin clasificar)' : '')}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--texto-2)]">{list.length} en pantalla</span>
            <div className="ml-auto">
              <Btn variante="primario" onClick={add}>
                + Material
              </Btn>
            </div>
          </div>

          <Card className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th + ' w-20'}>Ítem</th>
                  <th className={th}>Descripción</th>
                  <th className={th + ' w-16'}>Unidad</th>
                  <th className={th + ' w-32'}>Precio unit. (ARS)</th>
                  <th className={th + ' w-40'}>División</th>
                  <th className={th + ' w-20'}>Desperd. %</th>
                  <th className={th + ' w-32'}>Present. compra</th>
                  <th className={th + ' w-20'}>Factor</th>
                  <th className={th + ' w-28'}>Present. 2</th>
                  <th className={th + ' w-20'}>Factor 2</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {list.map((m, i) => (
                  <tr key={m.cod + '#' + i}>
                    <td className={td + ' font-mono text-xs text-[var(--texto-2)]'}>{m.cod}</td>
                    <td className={td}>
                      <EditCell value={m.desc} onCommit={(v) => upd(m.cod, { desc: v })} />
                    </td>
                    <td className={td}>
                      <EditCell value={m.unidad} onCommit={(v) => upd(m.cod, { unidad: v })} />
                    </td>
                    <td className={td + (m.precio > 0 ? '' : ' bg-[var(--color-alerta)]/10')}>
                      <EditCell
                        tipo="number"
                        value={m.precio}
                        onCommit={(v) => upd(m.cod, { precio: Number(v) || 0 })}
                      />
                    </td>
                    <td className={td}>
                      <EditSelect
                        value={m.div}
                        opciones={divisionesCanon}
                        onCommit={(v) => upd(m.cod, { div: v })}
                      />
                    </td>
                    <td className={td}>
                      <EditCell
                        tipo="number"
                        value={m.desp}
                        onCommit={(v) => upd(m.cod, { desp: Number(v) || 0 })}
                      />
                    </td>
                    <td className={td}>
                      <EditCell value={m.pres1} placeholder="—" onCommit={(v) => upd(m.cod, { pres1: v })} />
                    </td>
                    <td className={td}>
                      <EditCell
                        tipo="number"
                        value={m.fac1}
                        onCommit={(v) => upd(m.cod, { fac1: Number(v) || 0 })}
                      />
                    </td>
                    <td className={td}>
                      <EditCell value={m.pres2} placeholder="—" onCommit={(v) => upd(m.cod, { pres2: v })} />
                    </td>
                    <td className={td}>
                      <EditCell
                        tipo="number"
                        value={m.fac2}
                        onCommit={(v) => upd(m.cod, { fac2: Number(v) || 0 })}
                      />
                    </td>
                    <td className={td + ' text-center'}>
                      <button
                        className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                        onClick={() => del(m.cod)}
                        title="Eliminar material"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 text-xs text-[var(--texto-2)]">
            Las celdas de precio resaltadas están sin cargar.
          </p>
        </>
      )}
    </div>
  );
}
