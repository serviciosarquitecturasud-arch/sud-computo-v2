/**
 * Modelo de datos SUD Cómputo.
 * PARIDAD ESTRICTA con el formato legacy (localStorage cmp_catalogo / cmp_obras,
 * respaldo JSON v2/v3 y snapshots de Drive). No cambiar nombres de campos.
 */

export type TipoInsumo = 'M' | 'MO' | 'E';

export interface Material {
  cod: string;
  desc: string;
  unidad: string;
  precio: number;
  div: string;
  /** Desperdicio % */
  desp: number;
  /** Presentación comercial 1 (ej. "bolsa", "panel") */
  pres1: string;
  /** Unidades físicas por presentación 1 (β = precio_pres1 / fac1) */
  fac1: number;
  pres2: string;
  fac2: number;
}

export interface ManoObra {
  cod: string;
  desc: string;
  unidad: string;
  /** Costo hora (factura unipersonal consumidor final — costo final, sin cargas) */
  valor: number;
}

export interface Herramienta {
  cod: string;
  desc: string;
  grupo: string;
  tenencia: string; // 'Propia' | 'Alquilada'
  valor: number;
  vidautil: number;
  jornada: number;
  combust: number;
  reparac: number;
}

export interface Rubro {
  cod: string;
  rubro: string;
  subrubro: string;
  desc: string;
  unidad: string;
}

export interface FilaBiblioteca {
  /** Código del ítem (Cómputo Unitario) al que pertenece la fila */
  apu: string;
  tipo: TipoInsumo | string;
  insumo: string;
  cant: number;
  nota: string;
}

export interface Catalogo {
  materiales: Material[];
  manoObra: ManoObra[];
  herramientas: Herramienta[];
  rubros: Rubro[];
  biblioteca: FilaBiblioteca[];
  /** APUs eliminados por el usuario: el SEED no los re-inyecta */
  deletedApus: string[];
  /** APUs editados por el usuario: blindados contra el merge del SEED */
  apusEditados: string[];
  divisiones?: string[];
}

/** SEED comprimido tal como viaja embebido (M/O/H/R/B como arrays posicionales) */
export interface SeedComprimido {
  M: unknown[][];
  O: unknown[][];
  H: unknown[][];
  R: unknown[][];
  B: unknown[][];
}

export interface Coef {
  ggd: number;
  ggi: number;
  imp: number;
  ben: number;
  /** Legacy v2: se conserva en el modelo pero se IGNORA en el cálculo (R11 Hito 7) */
  iva: number;
  iib: number;
}

export interface ItemObra {
  cod: string;
  cant: number;
  precioManual?: number;
  [k: string]: unknown;
}

export interface MaterialConfigObra {
  desp?: number | string;
  pres1?: string;
  fac1?: number | string;
  pres2?: string;
  fac2?: number | string;
  [k: string]: unknown;
}

export interface PreciosObra {
  /** Precio SIN IVA por unidad física (legacy pre-Hito 8) */
  materiales?: Record<string, number | string>;
  /** Precio CON IVA de la presentación 1 (Camino γ, R11 Hito 8) — tiene prioridad */
  materialesConIVA?: Record<string, number | string>;
  manoObra?: Record<string, number | string>;
  herramientas?: Record<string, number | string>;
}

export interface PlanRubroConfig {
  duracion?: number | string;
  precede?: string;
  inicioManual?: number | string;
  ofsCuad?: number | string;
  ayudCuad?: number | string;
  [k: string]: unknown;
}

export interface PlanObra {
  hsSem?: number;
  rubros?: Record<string, PlanRubroConfig>;
  [k: string]: unknown;
}

/**
 * Obra. Solo se tipan los campos que el núcleo usa; el resto (cotizacionesPorRubro,
 * revitVinculo, proveedores, subcontratosManuales, datos de carátula, etc.) se
 * preserva intacto vía index signature — la persistencia es passthrough.
 */
export interface Obra {
  id: string;
  nombre?: string;
  items?: ItemObra[];
  coef?: Coef;
  plan?: PlanObra;
  precios?: PreciosObra;
  materialesConfig?: Record<string, MaterialConfigObra>;
  [k: string]: unknown;
}

/* ===== Resultados del motor de planificación ===== */

export interface PlanRubro {
  rp: string;
  nombre: string;
  monto: number;
  costoDir: number;
  hsOf: number;
  hsAy: number;
  hsEq: number;
  duracion: number;
  duracionCalc: number;
  modo: 'cuadrilla' | 'duracion';
  ofsCuad: number;
  ayudCuad: number;
  precede: string;
  inicioManual: number;
  inicio?: number | null;
  fin?: number | null;
  oficSem?: number;
  ayudSem?: number;
  estado?: string;
  finTardio?: number | null;
  inicioTardio?: number | null;
  holgura?: number | null;
  critico?: boolean;
}

export interface PlanMes {
  mes: number;
  invMes: number;
  invAcum: number;
  hhMes: number;
  hhAcum: number;
  pctF: number;
  pctH: number;
}

export interface PlanData {
  base: PlanRubro[];
  plazo: number;
  nMeses?: number;
  meses?: PlanMes[];
  totalF?: number;
  totalH?: number;
  hsSem: number;
}

export interface EntradaSuministro {
  rp: string;
  rubroNombre: string;
  semanaInicio: number | null | undefined;
  matCod: string | null;
  matDesc: string;
  unidad: string;
  cantidad: number;
  desperdicioPct: number;
  cantidadConDesperdicio: number;
  precioUnit: number;
  costoTotal: number;
  origenItems: string[];
  esGlobal?: boolean;
}

export interface MaterialTotalObra {
  matCod: string;
  matDesc: string;
  unidad: string;
  cantidad: number;
  cantidadConDesperdicio: number;
  desperdicioPct: number;
  precioUnit: number;
  costoTotal: number;
  origenItems: string[];
}
