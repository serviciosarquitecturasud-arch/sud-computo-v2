/** Utilidades chicas de UI (H5): normalización de búsqueda y tiempo relativo. */

/** Minúsculas y sin acentos, para búsqueda case/acento-insensible. */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Formato relativo del último guardado:
 * <1 min → "recién" · <1 h → "hace Nm" · después → hora "HH:MM".
 */
export function tiempoRelativo(ts: number, ahora: number = Date.now()): string {
  const seg = Math.max(0, Math.floor((ahora - ts) / 1000));
  if (seg < 60) return 'recién';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min}m`;
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
