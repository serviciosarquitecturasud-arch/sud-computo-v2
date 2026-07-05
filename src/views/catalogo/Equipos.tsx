/** Catálogo · Equipos y herramientas — tabla editable con costo horario calculado. */
import { useMemo } from 'react';
import { cmpCodigo, costoHerramienta, money } from '../../core';
import type { Catalogo, Herramienta, Motor } from '../../core';
import { Btn, Card, td, th } from '../../ui/base';
import { EditCell, EditSelect } from '../../ui/edit';

export function Equipos({
  cat,
  setCat
}: {
  cat: Catalogo;
  setCat: (c: Catalogo) => void;
  motor: Motor;
}) {
  const ordenados = useMemo(
    () => [...cat.herramientas].sort((a, b) => cmpCodigo(a.cod, b.cod)),
    [cat.herramientas]
  );

  const upd = (cod: string, patch: Partial<Herramienta>) =>
    setCat({
      ...cat,
      herramientas: cat.herramientas.map((h) => (h.cod === cod ? { ...h, ...patch } : h))
    });

  const del = (cod: string) => {
    if (confirm('¿Eliminar el equipo / herramienta ' + cod + '?'))
      setCat({ ...cat, herramientas: cat.herramientas.filter((h) => h.cod !== cod) });
  };

  const add = () => {
    const cod = (prompt('Código del nuevo equipo / herramienta:') || '').trim();
    if (!cod) return;
    if (cat.herramientas.some((h) => h.cod === cod)) {
      alert('Ya existe ese código.');
      return;
    }
    setCat({
      ...cat,
      herramientas: [
        { cod, desc: '', grupo: '', tenencia: 'Propia', valor: 0, vidautil: 1000, jornada: 8, combust: 0, reparac: 0 },
        ...cat.herramientas
      ]
    });
  };

  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Equipos y herramientas</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            {cat.herramientas.length} líneas · costo horario calculado: Propia = Valor/Vida útil + Combustible +
            Reparaciones · Alquilada = Valor/Jornada.
          </p>
        </div>
        <Btn variante="primario" onClick={add}>
          + Equipo
        </Btn>
      </header>

      <Card className="overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th + ' w-16'}>Cód.</th>
              <th className={th}>Descripción</th>
              <th className={th + ' w-40'}>Grupo</th>
              <th className={th + ' w-28'}>Tenencia</th>
              <th className={th + ' w-32'}>Valor / Alq. día</th>
              <th className={th + ' w-24'}>Vida útil (h)</th>
              <th className={th + ' w-20'}>Jornada</th>
              <th className={th + ' w-24'}>Combust./h</th>
              <th className={th + ' w-24'}>Reparac./h</th>
              <th className={th + ' w-28 text-right'}>Costo/h</th>
              <th className={th + ' w-10'}></th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((h, i) => (
              <tr key={h.cod + '#' + i}>
                <td className={td + ' font-mono text-xs text-[var(--texto-2)]'}>{h.cod}</td>
                <td className={td}>
                  <EditCell value={h.desc} onCommit={(v) => upd(h.cod, { desc: v })} />
                </td>
                <td className={td}>
                  <EditCell value={h.grupo} onCommit={(v) => upd(h.cod, { grupo: v })} />
                </td>
                <td className={td}>
                  <EditSelect
                    value={h.tenencia}
                    opciones={['Propia', 'Alquilada']}
                    onCommit={(v) => upd(h.cod, { tenencia: v })}
                  />
                </td>
                <td className={td}>
                  <EditCell tipo="number" value={h.valor} onCommit={(v) => upd(h.cod, { valor: Number(v) || 0 })} />
                </td>
                <td className={td}>
                  <EditCell
                    tipo="number"
                    value={h.vidautil}
                    onCommit={(v) => upd(h.cod, { vidautil: Number(v) || 0 })}
                  />
                </td>
                <td className={td}>
                  <EditCell
                    tipo="number"
                    value={h.jornada}
                    onCommit={(v) => upd(h.cod, { jornada: Number(v) || 0 })}
                  />
                </td>
                <td className={td}>
                  <EditCell
                    tipo="number"
                    value={h.combust}
                    onCommit={(v) => upd(h.cod, { combust: Number(v) || 0 })}
                  />
                </td>
                <td className={td}>
                  <EditCell
                    tipo="number"
                    value={h.reparac}
                    onCommit={(v) => upd(h.cod, { reparac: Number(v) || 0 })}
                  />
                </td>
                <td className={td + ' text-right font-mono tabular-nums'}>{money(costoHerramienta(h))}</td>
                <td className={td + ' text-center'}>
                  <button
                    className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                    onClick={() => del(h.cod)}
                    title="Eliminar equipo"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
