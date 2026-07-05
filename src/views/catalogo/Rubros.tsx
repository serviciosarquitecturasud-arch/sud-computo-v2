/** Catálogo · Rubros — estructura maestra de rubros e ítems (solo lectura). */
import { useMemo, useState } from 'react';
import { cmpCodigo } from '../../core';
import type { Catalogo, Motor } from '../../core';
import { Card, td, th } from '../../ui/base';

export function Rubros({
  cat
}: {
  cat: Catalogo;
  setCat: (c: Catalogo) => void;
  motor: Motor;
}) {
  const [q, setQ] = useState('');

  const list = useMemo(
    () =>
      cat.rubros
        .filter(
          (r) => !q || (r.cod + ' ' + r.desc + ' ' + r.rubro).toLowerCase().includes(q.toLowerCase())
        )
        .sort((a, b) => cmpCodigo(a.cod, b.cod)),
    [cat.rubros, q]
  );

  return (
    <div>
      <header className="mb-4">
        <h1 className="font-marca text-3xl tracking-tight">Rubros</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          {cat.rubros.length} líneas · estructura maestra de rubros e ítems. Solo lectura: la edición
          estructural (alta, baja y descripción de ítems) se hace desde Cómputos Unitarios.
        </p>
      </header>

      <div className="mb-3 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar rubro o ítem"
          className="w-72 rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-sud-azul)]"
        />
        <span className="text-xs text-[var(--texto-2)]">{list.length} en pantalla</span>
      </div>

      <Card className="overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th + ' w-24'}>Código</th>
              <th className={th + ' w-48'}>Rubro</th>
              <th className={th + ' w-48'}>Subrubro</th>
              <th className={th}>Descripción</th>
              <th className={th + ' w-16'}>Unidad</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const esRubro = r.cod.endsWith('.00');
              return (
                <tr
                  key={r.cod + '#' + i}
                  className={
                    esRubro ? 'bg-[var(--color-sud-tinta)] text-[var(--color-sud-crema)]' : undefined
                  }
                >
                  <td
                    className={
                      td +
                      (esRubro
                        ? ' font-mono text-xs font-semibold'
                        : ' pl-4 font-mono text-xs text-[var(--texto-2)]')
                    }
                  >
                    {r.cod}
                  </td>
                  <td
                    className={
                      td +
                      (esRubro
                        ? ' text-xs font-semibold uppercase tracking-wide'
                        : ' text-xs text-[var(--texto-2)]')
                    }
                  >
                    {esRubro ? r.desc : r.rubro}
                  </td>
                  <td className={td + ' text-xs' + (esRubro ? '' : ' text-[var(--texto-2)]')}>
                    {esRubro ? '' : r.subrubro}
                  </td>
                  <td className={td}>{esRubro ? '' : r.desc}</td>
                  <td className={td + (esRubro ? '' : ' text-[var(--texto-2)]')}>{r.unidad}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
