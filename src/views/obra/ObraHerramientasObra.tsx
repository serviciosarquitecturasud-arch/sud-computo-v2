/**
 * HERRAMIENTAS en obra (H8a) — inventario simple de lo que se llevó a la
 * obra: {nombre, cantidad, fecha de ingreso, devuelta}. El contador
 * "en obra ahora" evita perder herramientas al cierre.
 */
import { useState } from 'react';
import { herramientasEnObra, uid } from '../../core';
import type { HerramientaEnObra, Obra } from '../../core';
import { Badge, Btn, Card, SectionTitle, td, th } from '../../ui/base';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1.5 text-sm ' +
  'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

function fmtFechaCorta(iso: string): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a.slice(2)}` : iso;
}

export function ObraHerramientasObra({ obra, setObra }: { obra: Obra; setObra: (o: Obra) => void }) {
  const lista: HerramientaEnObra[] = Array.isArray(obra.herramientasObra) ? obra.herramientasObra : [];
  const setLista = (h: HerramientaEnObra[]) => setObra({ ...obra, herramientasObra: h });

  const [nombre, setNombre] = useState('');
  const [cant, setCant] = useState('1');
  const [fecha, setFecha] = useState(hoyISO());

  const agregar = () => {
    if (!nombre.trim()) return;
    const h: HerramientaEnObra = {
      id: uid(),
      nombre: nombre.trim(),
      cant: Math.max(1, Number(cant) || 1),
      fechaIngreso: fecha || hoyISO(),
      devuelta: false
    };
    setLista([...lista, h]);
    setNombre('');
    setCant('1');
  };

  const enObra = herramientasEnObra(lista);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-md border border-[var(--borde)] px-4 py-2">
          <div className="font-marca text-xl tabular-nums">{enObra}</div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--texto-2)]">En obra ahora</div>
        </div>
        <div className="rounded-md border border-[var(--borde)] px-4 py-2">
          <div className="font-marca text-xl tabular-nums">{lista.length}</div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--texto-2)]">Registradas</div>
        </div>
      </div>

      <Card className="p-4">
        <SectionTitle>Llevar herramienta a la obra</SectionTitle>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-40 flex-1 text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Herramienta</span>
            <input
              className={inputCls}
              value={nombre}
              placeholder="Ej.: amoladora, escalera"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
            />
          </label>
          <label className="block w-20 text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Cant.</span>
            <input
              className={inputCls + ' tabular-nums'}
              type="number"
              inputMode="numeric"
              min={1}
              value={cant}
              onChange={(e) => setCant(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Ingreso</span>
            <input className={inputCls} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <Btn variante="primario" onClick={agregar}>+ Agregar</Btn>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Inventario</SectionTitle>
        {lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--texto-2)]">
            Anotá acá cada herramienta que entra a la obra para no perder nada al cierre.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Herramienta</th>
                <th className={th + ' text-right'}>Cant.</th>
                <th className={th}>Ingreso</th>
                <th className={th}>Estado</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((h) => (
                <tr key={h.id} className={h.devuelta ? 'opacity-60' : ''}>
                  <td className={td}>{h.nombre}</td>
                  <td className={td + ' text-right tabular-nums'}>{h.cant}</td>
                  <td className={td + ' tabular-nums'}>{fmtFechaCorta(h.fechaIngreso)}</td>
                  <td className={td}>
                    <button
                      onClick={() =>
                        setLista(lista.map((x) => (x.id === h.id ? { ...x, devuelta: !x.devuelta } : x)))
                      }
                      title="Cambiar estado"
                    >
                      {h.devuelta ? <Badge tono="neutro">devuelta</Badge> : <Badge tono="ok">en obra</Badge>}
                    </button>
                  </td>
                  <td className={td + ' text-right'}>
                    <button
                      className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                      title="Borrar registro"
                      onClick={() => {
                        if (confirm(`¿Borrar «${h.nombre}» del inventario?`))
                          setLista(lista.filter((x) => x.id !== h.id));
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
