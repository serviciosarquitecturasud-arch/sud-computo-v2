/** Formateo es-AR — port 1:1 del legacy. */

export const fmt = (n: unknown): string =>
  (Number(n) || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

export const money = (n: unknown): string => '$ ' + fmt(n);

export const fmtN = (n: unknown): string =>
  (Number(n) || 0).toLocaleString('es-AR', {
    maximumFractionDigits: 3
  });

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
