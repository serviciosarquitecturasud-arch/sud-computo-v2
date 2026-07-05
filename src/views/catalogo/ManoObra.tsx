/** Catálogo · Mano de obra — tabla editable (jornalizados y subcontratos). */
import { useMemo } from 'react';
import { cmpCodigo } from '../../core';
import type { Catalogo, ManoObra as ManoObraItem, Motor } from '../../core';
import { Btn, Card, td, th } from '../../ui/base';
import { EditCell, EditSelect } from '../../ui/edit';

const UNIDADES = ['hs', 'Gl', 'U', 'un'];

export function ManoObra({
  cat,
  setCat
}: {
  cat: Catalogo;
  setCat: (c: Catalogo) => void;
  motor: Motor;
}) {
  const ordenados = useMemo(
    () => [...cat.manoObra].sort((a, b) => cmpCodigo(a.cod, b.cod)),
    [cat.manoObra]
  );
  const jornalizados = ordenados.filter((o) => (o.unidad || 'hs') === 'hs');
  const subcontratos = ordenados.filter((o) => (o.unidad || 'hs') !== 'hs');

  const upd = (cod: string, patch: Partial<ManoObraItem>) =>
    setCat({
      ...cat,
      manoObra: cat.manoObra.map((o) => (o.cod === cod ? { ...o, ...patch } : o))
    });

  const del = (cod: string) => {
    if (confirm('¿Eliminar la mano de obra ' + cod + '?'))
      setCat({ ...cat, manoObra: cat.manoObra.filter((o) => o.cod !== cod) });
  };

  const add = () => {
    const cod = (
      prompt('Código de la nueva mano de obra (ej "06" para categoría jornalizada, "SC07" para subcontrato):') || ''
    ).trim();
    if (!cod) return;
    if (cat.manoObra.some((o) => o.cod === cod)) {
      alert('Ya existe ese código.');
      return;
    }
    // Si el código empieza con SC, default unidad Gl; si no, hs.
    const unidadDefault = /^SC/i.test(cod) ? 'Gl' : 'hs';
    setCat({ ...cat, manoObra: [{ cod, desc: '', unidad: unidadDefault, valor: 0 }, ...cat.manoObra] });
  };

  const tabla = (filas: ManoObraItem[], vacio: string) => (
    <Card className="max-w-3xl overflow-hidden p-4">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={th + ' w-20'}>Código</th>
            <th className={th}>Descripción</th>
            <th className={th + ' w-20'}>Unidad</th>
            <th className={th + ' w-40'}>Valor en APU (ARS)</th>
            <th className={th + ' w-10'}></th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td className={td + ' text-xs italic text-[var(--texto-2)]'} colSpan={5}>
                {vacio}
              </td>
            </tr>
          ) : (
            filas.map((o, i) => (
              <tr key={o.cod + '#' + i}>
                <td className={td + ' font-mono text-xs text-[var(--texto-2)]'}>{o.cod}</td>
                <td className={td}>
                  <EditCell value={o.desc} onCommit={(v) => upd(o.cod, { desc: v })} />
                </td>
                <td className={td}>
                  <EditSelect
                    value={o.unidad || 'hs'}
                    opciones={UNIDADES}
                    onCommit={(v) => upd(o.cod, { unidad: v })}
                  />
                </td>
                <td className={td + (o.valor > 0 ? '' : ' bg-[var(--color-alerta)]/10')}>
                  <EditCell
                    tipo="number"
                    value={o.valor}
                    onCommit={(v) => upd(o.cod, { valor: Number(v) || 0 })}
                  />
                </td>
                <td className={td + ' text-center'}>
                  <button
                    className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                    onClick={() => del(o.cod)}
                    title="Eliminar mano de obra"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );

  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Mano de obra</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            {cat.manoObra.length} líneas · {jornalizados.length} jornalizadas + {subcontratos.length} subcontratos.
            El valor se usa en los APU; en subcontratos es el costo final facturado (sin cargas sociales).
          </p>
        </div>
        <Btn variante="primario" onClick={add}>
          + Mano de obra
        </Btn>
      </header>

      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--texto-2)]">
          Jornalizados (por hora)
        </h2>
        {tabla(jornalizados, 'Sin categorías jornalizadas. Agregá con códigos tipo 01, 02, 03…')}
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--texto-2)]">
          Subcontratos (monto global)
        </h2>
        {tabla(subcontratos, 'Sin subcontratos. Agregá con códigos tipo SC01, SC02… y unidad Gl/un.')}
      </div>
    </div>
  );
}
