/** Layout general: barra lateral de navegación + contenido. */
import type { ReactNode } from 'react';
import { Logo } from './Logo';

export interface NavItem {
  id: string;
  label: string;
  grupo?: string;
  deshabilitado?: boolean;
}

export function Shell({
  nav,
  activo,
  onNav,
  dark,
  onToggleDark,
  onBuscar,
  footer,
  children
}: {
  nav: NavItem[];
  activo: string;
  onNav: (id: string) => void;
  dark: boolean;
  onToggleDark: () => void;
  /** Abre la paleta de comandos (H5). Si no se pasa, el botón no se muestra. */
  onBuscar?: () => void;
  /** Contenido extra del pie del sidebar (ej. indicador de autoguardado). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const grupos = [...new Set(nav.map((n) => n.grupo ?? ''))];
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-[var(--borde)] bg-[var(--panel)]">
        <div className="px-5 pb-4 pt-6">
          <Logo className="text-base" />
        </div>
        {onBuscar && (
          <div className="px-3 pb-3">
            <button
              onClick={onBuscar}
              className="flex w-full items-center justify-between rounded-md border border-[var(--borde)] px-2 py-1.5 text-xs text-[var(--texto-2)] transition-colors hover:bg-[var(--color-neutro-100)] hover:text-[var(--texto)] dark:hover:bg-[var(--color-neutro-800)]"
            >
              <span>Buscar</span>
              <span className="rounded border border-[var(--borde)] px-1 py-px text-[10px] tabular-nums">
                ⌘K
              </span>
            </button>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {grupos.map((g) => (
            <div key={g} className="mb-4">
              {g && (
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--texto-2)]">
                  {g}
                </div>
              )}
              {nav
                .filter((n) => (n.grupo ?? '') === g)
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.deshabilitado && onNav(n.id)}
                    className={`mb-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      activo === n.id
                        ? 'bg-[var(--color-neutro-100)] font-medium text-[var(--texto)] dark:bg-[var(--color-neutro-800)]'
                        : n.deshabilitado
                          ? 'cursor-default text-[var(--color-neutro-300)] dark:text-[var(--color-neutro-700)]'
                          : 'text-[var(--texto-2)] hover:bg-[var(--color-neutro-100)] hover:text-[var(--texto)] dark:hover:bg-[var(--color-neutro-800)]'
                    }`}
                  >
                    {n.label}
                    {n.deshabilitado && <span className="ml-1.5 text-[10px]">pronto</span>}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--borde)] p-3">
          {footer}
          <button
            onClick={onToggleDark}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--texto-2)] hover:bg-[var(--color-neutro-100)] dark:hover:bg-[var(--color-neutro-800)]"
          >
            {dark ? '○ Modo claro' : '● Modo oscuro'}
          </button>
        </div>
      </aside>
      <main className="ml-56 flex-1 px-10 py-8">{children}</main>
    </div>
  );
}
