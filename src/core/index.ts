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
export {
  SEED_TIPOS_PLANO,
  agruparDocs,
  esVigente,
  expandirSeedTiposPlano,
  kpisDocumentos,
  mergeTiposPlanoConSeed,
  nombreEstandar,
  ordenGrupos,
  proximaRev,
  slugDen,
  tipoPorCod,
  ultimoAutor,
  validarCod,
  vigentePorCod,
  type DocsPorCod,
  type DocsPorGrupo
} from './documentos';
export {
  ESTADOS_LEGAL,
  SEED_CATEGORIAS_LEGAL,
  abrevCategoria,
  agruparLegales,
  esCategoriaPresupuesto,
  estaVencido,
  kpisLegales,
  mergeCategoriasLegalConSeed,
  type KpisLegales,
  type LegalesPorCategoria
} from './legales';

export {
  COD_MO_AYUDANTE,
  COD_MO_OFICIAL,
  HORAS_JORNADA,
  UMBRAL_DESVIO_PRECIO,
  UMBRAL_POR_AGOTARSE,
  adelantosDeSemana,
  balanceCaja,
  costoJornalDia,
  desvioPrecioPct,
  enSemana,
  estadoSaldo,
  gastoTotalObra,
  herramientasEnObra,
  idMovimientoCompra,
  jornalesDeSemana,
  lunesDeSemana,
  movimientoDeCompra,
  pendientesDePago,
  proveedorDeMaterial,
  resumenPorComercio,
  resumenSemana,
  saldosCompras,
  sumarDias,
  tarifasDerivadas,
  tarifasDiario,
  totalFijos,
  type BalanceCaja,
  type EstadoSaldo,
  type PendientesCaja,
  type ResumenComercio,
  type ResumenSemana,
  type SaldoMaterial,
  type TarifasDiario
} from './obraDiario';

import seedJson from './seed.json';
import type { SeedComprimido } from './types';
/** SEED embebido (idéntico al de producción, extraído del index.html legacy). */
export const SEED = seedJson as unknown as SeedComprimido;
