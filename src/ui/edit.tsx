/** Componentes de edición inline — equivalentes a EditCell/EditMoney/EditSelect del legacy. */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const inputCls =
  'w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-1.5 py-0.5 text-sm ' +
  'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

export function EditCell({
  value,
  onCommit,
  tipo = 'text',
  className = '',
  placeholder = ''
}: {
  value: string | number;
  onCommit: (v: string) => void;
  tipo?: 'text' | 'number';
  className?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(String(value ?? ''));
  useEffect(() => setV(String(value ?? '')), [value]);
  return (
    <input
      className={`${inputCls} ${tipo === 'number' ? 'text-right tabular-nums' : ''} ${className}`}
      type={tipo}
      step="any"
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== String(value ?? '') && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setV(String(value ?? ''));
      }}
    />
  );
}

export function EditSelect({
  value,
  onCommit,
  opciones,
  className = ''
}: {
  value: string;
  onCommit: (v: string) => void;
  opciones: string[];
  className?: string;
}) {
  const lista = opciones.includes(value) || !value ? opciones : [value, ...opciones];
  return (
    <select className={`${inputCls} ${className}`} value={value} onChange={(e) => onCommit(e.target.value)}>
      <option value=""></option>
      {lista.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function EditArea({
  value,
  onCommit,
  rows = 3,
  placeholder = ''
}: {
  value: string;
  onCommit: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  return (
    <textarea
      className={inputCls}
      rows={rows}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (value ?? '') && onCommit(v)}
    />
  );
}

export function Modal({
  titulo,
  onCerrar,
  children,
  ancho = 'max-w-2xl'
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 pt-16" onClick={onCerrar}>
      <div
        className={`w-full ${ancho} max-h-[80vh] overflow-y-auto rounded-[var(--radius-card)] bg-[var(--panel)] p-5 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-marca text-lg">{titulo}</h3>
          <button className="text-[var(--texto-2)] hover:text-[var(--texto)]" onClick={onCerrar}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Combo filtrable para elegir insumos/ítems (equivalente a ComboInsumo legacy). */
export function ComboBuscar({
  opciones,
  onElegir,
  placeholder = 'Buscar…',
  format
}: {
  opciones: { clave: string; texto: string }[];
  onElegir: (clave: string) => void;
  placeholder?: string;
  format?: (o: { clave: string; texto: string }) => ReactNode;
}) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtradas = q
    ? opciones.filter((o) => norm(o.texto + ' ' + o.clave).includes(norm(q))).slice(0, 40)
    : opciones.slice(0, 40);
  return (
    <div ref={ref} className="relative">
      <input
        className={inputCls}
        value={q}
        placeholder={placeholder}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && filtradas.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-[var(--borde)] bg-[var(--panel)] shadow-lg">
          {filtradas.map((o) => (
            <button
              key={o.clave}
              className="block w-full px-2 py-1.5 text-left text-sm hover:bg-[var(--color-neutro-100)] dark:hover:bg-[var(--color-neutro-800)]"
              onClick={() => {
                onElegir(o.clave);
                setQ('');
                setAbierto(false);
              }}
            >
              {format ? format(o) : o.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
