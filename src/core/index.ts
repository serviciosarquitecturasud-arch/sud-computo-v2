/**
 * Núcleo de cálculo SUD Cómputo.
 * Port 1:1 del motor legacy validado en producción (R11+).
 * Los tests de paridad en /tests comparan cada función contra la extracción
 * verbatim del legacy (tests/legacy/core-legacy.cjs).
 */
export * from './types';
export { cmpCodigo } from './codigo';
export { fmt, money, fmtN, uid } from './format';
export { expandSeed } from './expandSeed';
export { buildMotor, costoHerramienta, IVA_RATE_MOTOR, type Motor } from './motor';
export { calcCoef, coefDefault } from './coef';
export { buildPlan } from './plan';
export { buildSuministro, materialesTotalObra } from './suministro';

import seedJson from './seed.json';
import type { SeedComprimido } from './types';
/** SEED embebido (idéntico al de producción, extraído del index.html legacy). */
export const SEED = seedJson as unknown as SeedComprimido;
