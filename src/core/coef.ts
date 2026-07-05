import type { Coef } from './types';

/**
 * Coeficiente de pase — port 1:1 del legacy.
 * R11 Hito 7: el IVA salió del coeficiente (va dentro del precio del material).
 * Fórmula: (1 + ggd+ggi+imp+ben) × (1 + iibb).
 * El campo c.iva se mantiene en el modelo por compatibilidad legacy v2 pero se ignora.
 * NO incluye cargas sociales (MO = unipersonales, costo final).
 */
export const calcCoef = (c: Coef): number => {
  const gg = (c.ggd || 0) + (c.ggi || 0) + (c.imp || 0) + (c.ben || 0);
  const imp = c.iib || 0;
  return (1 + gg / 100) * (1 + imp / 100);
};

export const coefDefault = (): Coef => ({
  ggd: 0,
  ggi: 0,
  imp: 0,
  ben: 0,
  iva: 0,
  iib: 0
});
