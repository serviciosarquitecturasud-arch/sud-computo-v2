/**
 * Paleta de comandos (H5): búsqueda global sobre obras, materiales,
 * rubros/CUs y acciones. Ctrl/Cmd+K. Navegación con ↑/↓/Enter.
 */
import { useMemo, useState } from 'react';
import type { Catalogo, Obra } from '../core';
import { Badge } from './base';
import { Modal } from './edit';
import { normalizar } from './util';

export interface AccionPaleta {
  id: string;
  label: string;
  run: () => void;
}

type Grupo = 'Obra' | 'Material' | 'Rubro / CU' | 'Acción';

interface Resultado {
  grupo: Grupo;
  clave: string;
  titulo: string;
  detalle?: string;
  run: () => void;
}

const PLURAL: Record<Grupo, string> = {
  Obra: 'Obras',
  Material: 'Materiales',
  'Rubro / CU': 'Rubros / CUs',
  Acción: 'Acciones'
};

const TONO: Record<Grupo, 'neutro' | 'ok' | 'alerta' | 'info'> = {
  Obra: 'info',
  Material: 'neutro',
  'Rubro / CU': 'ok',
  Acción: 'neutro'
};

const MAX_TOTAL = 12;
const MAX_GRUPO = 5;

export function CommandPalette({
  cat,
  obras,
  acciones,
  onAbrirObra,
  onNav,
  onCerrar
}: {
  cat: Catalogo;
  obras: Obra[];
  acciones: AccionPaleta[];
  onAbrirObra: (id: string) => void;
  onNav: (vista: string) => void;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);

  const resultados = useMemo<Resultado[]>(() => {
    const nq = normalizar(q.trim());
    const out: Resultado[] = [];
    if (!nq) {
      // Sin consulta: mostramos las acciones disponibles
      for (const a of acciones.slice(0, MAX_TOTAL)) {
        out.push({ grupo: 'Acción', clave: `acc-${a.id}`, titulo: a.label, run: a.run });
      }
      return out;
    }
    const coincide = (s: string) => normalizar(s).includes(nq);
    let n = 0;
    for (const o of obras) {
      if (n >= MAX_GRUPO) break;
      const nombre = o.nombre ?? '';
      const comitente = typeof o.comitente === 'string' ? o.comitente : '';
      if (nombre && coincide(nombre)) {
        out.push({
          grupo: 'Obra',
          clave: `obra-${o.id}`,
          titulo: nombre,
          detalle: comitente || undefined,
          run: () => onAbrirObra(o.id)
        });
        n++;
      }
    }
    n = 0;
    for (const m of cat.materiales) {
      if (n >= MAX_GRUPO) break;
      if (coincide(`${m.cod} ${m.desc}`)) {
        out.push({
          grupo: 'Material',
          clave: `mat-${m.cod}`,
          titulo: m.desc,
          detalle: m.cod,
          run: () => onNav('materiales')
        });
        n++;
      }
    }
    n = 0;
    for (const r of cat.rubros) {
      if (n >= MAX_GRUPO) break;
      if (coincide(`${r.cod} ${r.desc} ${r.rubro} ${r.subrubro}`)) {
        out.push({
          grupo: 'Rubro / CU',
          clave: `ru-${r.cod}`,
          titulo: r.desc || r.subrubro || r.rubro,
          detalle: r.cod,
          run: () => onNav('cus')
        });
        n++;
      }
    }
    for (const a of acciones) {
      if (coincide(a.label)) {
        out.push({ grupo: 'Acción', clave: `acc-${a.id}`, titulo: a.label, run: a.run });
      }
    }
    return out.slice(0, MAX_TOTAL);
  }, [q, obras, cat, acciones, onAbrirObra, onNav]);

  const selIdx = resultados.length ? Math.min(sel, resultados.length - 1) : -1;

  const ejecutar = (r: Resultado) => {
    r.run();
    onCerrar();
  };

  return (
    <Modal titulo="Buscar" onCerrar={onCerrar} ancho="max-w-xl">
      <input
        autoFocus
        className="mb-3 w-full rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-2 text-sm focus:outline-2 focus:outline-[var(--color-sud-azul)]"
        placeholder="Obras, materiales, rubros, acciones…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, resultados.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selIdx >= 0) ejecutar(resultados[selIdx]);
          }
        }}
      />
      {resultados.length === 0 ? (
        <div className="px-2 py-6 text-center text-sm text-[var(--texto-2)]">
          Sin resultados para «{q}»
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {resultados.map((r, i) => (
            <div key={r.clave}>
              {(i === 0 || resultados[i - 1].grupo !== r.grupo) && (
                <div className="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--texto-2)] first:mt-0">
                  {PLURAL[r.grupo]}
                </div>
              )}
              <button
                ref={(el) => {
                  if (i === selIdx) el?.scrollIntoView({ block: 'nearest' });
                }}
                onClick={() => ejecutar(r)}
                onMouseMove={() => setSel(i)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                  i === selIdx
                    ? 'bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]'
                    : ''
                }`}
              >
                <Badge tono={TONO[r.grupo]}>{r.grupo}</Badge>
                <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
                {r.detalle && (
                  <span className="shrink-0 text-xs tabular-nums text-[var(--texto-2)]">{r.detalle}</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 border-t border-[var(--borde)] pt-2 text-[11px] text-[var(--texto-2)]">
        ↑↓ navegar · Enter abrir · Esc cerrar
      </div>
    </Modal>
  );
}
