/** Componentes base del design system SUD (H1). */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'fantasma' | 'peligro';
};

export function Btn({ variante = 'secundario', className = '', ...props }: BtnProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sud-azul)] ' +
    'disabled:opacity-45 disabled:pointer-events-none';
  const variantes = {
    primario: 'bg-[var(--color-sud-tinta)] text-[var(--color-sud-crema)] hover:opacity-85 dark:bg-[var(--color-sud-crema)] dark:text-[var(--color-sud-tinta)]',
    secundario: 'border border-[var(--borde)] bg-[var(--panel)] hover:bg-[var(--color-neutro-100)] dark:hover:bg-[var(--color-neutro-800)]',
    fantasma: 'text-[var(--texto-2)] hover:bg-[var(--color-neutro-100)] hover:text-[var(--texto)] dark:hover:bg-[var(--color-neutro-800)]',
    peligro: 'border border-[var(--color-alerta)]/30 text-[var(--color-alerta)] hover:bg-[var(--color-alerta)]/10'
  };
  return <button className={`${base} ${variantes[variante]} ${className}`} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-[var(--borde)] bg-[var(--panel)] shadow-[var(--shadow-suave)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tono = 'neutro'
}: {
  children: ReactNode;
  tono?: 'neutro' | 'ok' | 'alerta' | 'info';
}) {
  const tonos = {
    neutro: 'bg-[var(--color-neutro-100)] text-[var(--color-neutro-600)] dark:bg-[var(--color-neutro-800)] dark:text-[var(--color-neutro-400)]',
    ok: 'bg-[var(--color-ok)]/12 text-[var(--color-ok)]',
    alerta: 'bg-[var(--color-alerta)]/12 text-[var(--color-alerta)]',
    info: 'bg-[var(--color-info)]/15 text-[#3E7191]'
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tonos[tono]}`}>
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--texto-2)]">
      {children}
    </h2>
  );
}

/** Encabezado de columna estándar de tablas SUD */
export const th =
  'py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]';
export const td = 'py-2 pr-4 border-b border-[var(--borde)] align-middle';
