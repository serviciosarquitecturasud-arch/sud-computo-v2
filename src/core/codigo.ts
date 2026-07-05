/**
 * Comparador de códigos jerárquicos por segmentos numéricos.
 * Port 1:1 del legacy (cmpCodigo). Funciona con "1.00", "3.01.01", "10.05",
 * "001", "1001", "SC01".
 */
export function cmpCodigo(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const sa = String(a).split(/[.\-_]/);
  const sb = String(b).split(/[.\-_]/);
  const max = Math.max(sa.length, sb.length);
  for (let i = 0; i < max; i++) {
    if (sa[i] === undefined) return -1; // a más corto → primero
    if (sb[i] === undefined) return 1;
    const na = Number(sa[i]);
    const nb = Number(sb[i]);
    const naOk = !isNaN(na) && sa[i] !== '';
    const nbOk = !isNaN(nb) && sb[i] !== '';
    if (naOk && nbOk) {
      if (na !== nb) return na - nb;
    } else if (naOk) {
      return -1; // numérico antes que alfanumérico
    } else if (nbOk) {
      return 1;
    } else {
      const cmp = (sa[i] || '').localeCompare(sb[i] || '', 'es', { numeric: true });
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}
