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

/** Tipo de plano del catálogo de documentación (nomenclatura controlada). */
export interface TipoPlano {
  /** Código controlado: prefijo de grupo + número (ej. IE1, H5, CAMAD3) */
  cod: string;
  /** Denominación del plano */
  den: string;
  /** Escala sugerida (ej. "1,50", "S.E.") */
  esc: string;
  /** Grupo del catálogo (ej. "Instalacion Electrica") */
  grupo: string;
  /** Subgrupo opcional (ej. tipo de carpintería) */
  sub?: string;
}

/** Revisión de un documento (plano) registrada en una obra. */
export interface DocumentoObra {
  id: string;
  /** Código del tipo de plano (obligatorio, del catálogo cat.tiposPlano) */
  cod: string;
  /** Número de revisión entero ≥ 0 (se muestra "R0", "R1"…) */
  rev: number;
  /** Fecha de emisión ISO yyyy-mm-dd */
  fecha: string;
  autor: string;
  driveFileId?: string;
  driveLink?: string;
  notas?: string;
}

/** Estado persistido de un documento del legajo legal ("Vencido" se deriva de fechaVenc). */
export type EstadoLegal = 'presentado' | 'aprobado' | 'firmado' | 'rechazado';

/** Documento del legajo legal de una obra (contratos, presupuestos, permisos, seguros, actas). */
export interface DocumentoLegal {
  id: string;
  /** Categoría del catálogo cat.categoriasLegal (editable; seed con merge) */
  categoria: string;
  titulo: string;
  /** Quién lo emite (ej. "estudio SUD", "Contratista Jesus") */
  emisor: string;
  /** A quién va dirigido (ej. "Cliente", "estudio SUD") */
  destinatario: string;
  /** Monto en ARS (presupuestos/contratos) */
  monto?: number;
  /** Fecha del documento ISO yyyy-mm-dd */
  fechaDoc: string;
  /** Vencimiento ISO yyyy-mm-dd (permisos/ART/seguros); "Vencido" se deriva, no se persiste */
  fechaVenc?: string;
  estado: EstadoLegal;
  driveFileId?: string;
  driveLink?: string;
  notas?: string;
}


/* ===== Fase OBRA (H8a): diario de jornales, caja, compras y herramientas ===== */

/** Jornales de un día de obra: cantidad de oficiales y ayudantes (soporta 0.5). */
export interface JornalDia {
  id: string;
  /** Fecha ISO yyyy-mm-dd */
  fecha: string;
  /** Cantidad de oficiales del día (ej. 2, 1.5) */
  of: number;
  /** Cantidad de ayudantes del día (medio ayudante = 0.5) */
  ay: number;
  nota?: string;
}

/** Pago fijo semanal a una persona (ej. "Jesús 50.000/sem"). */
export interface FijoSemanal {
  id: string;
  persona: string;
  montoSemanal: number;
}

/** Adelanto a cuenta entregado durante la semana (se descuenta del pago del viernes). */
export interface AdelantoPersonal {
  id: string;
  /** Fecha ISO yyyy-mm-dd */
  fecha: string;
  persona: string;
  monto: number;
}

/** Diario de obra: jornales por día, fijos semanales y adelantos. */
export interface DiarioObra {
  /** Jornal DIARIO por obra (override); default = valor hora del catálogo × 8 */
  tarifas?: { of: number; ay: number };
  jornales: JornalDia[];
  fijos: FijoSemanal[];
  adelantos: AdelantoPersonal[];
}

/** Tipo de factura de un movimiento de caja ('sin' = sin factura). */
export type FacturaTipo = 'A' | 'B' | 'C' | 'sin';

/** Movimiento de la caja de obra (ingreso o egreso). */
export interface MovimientoCaja {
  id: string;
  /** Fecha ISO yyyy-mm-dd */
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  /** Comercio o proveedor (ej. "FEROS", "volquetes") */
  comercio?: string;
  facturaTipo?: FacturaTipo;
  /** Factura adjunta: archivo de la carpeta de Drive de la obra */
  facturaFileId?: string;
  facturaLink?: string;
  /** Quién puso la plata: 'obra' | 'cliente' | contratista (nombre libre) */
  pagadoPor?: string;
  pagado: boolean;
  categoria?: string;
}

/** Pedido/compra de material contra el cómputo (saldo regresivo). */
export interface CompraMaterial {
  id: string;
  /** Fecha ISO yyyy-mm-dd */
  fecha: string;
  /** Código del material del catálogo */
  matCod: string;
  /** Cantidad pedida en unidad física del material */
  cantidad: number;
  /** Precio unitario REAL pagado (c/IVA, por unidad física) */
  precioUnit?: number;
  proveedor?: string;
  remito?: string;
  facturaFileId?: string;
  facturaLink?: string;
  nota?: string;
}

/** Herramienta llevada a la obra (para no perder nada al cierre). */
export interface HerramientaEnObra {
  id: string;
  nombre: string;
  cant: number;
  /** Fecha ISO yyyy-mm-dd */
  fechaIngreso: string;
  devuelta: boolean;
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
  /** Catálogo de tipos de plano para el registro de documentación (merge con seed) */
  tiposPlano?: TipoPlano[];
  /** Catálogo de categorías del legajo legal por obra (merge con seed) */
  categoriasLegal?: string[];
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
  /** Registro de documentación: revisiones de planos (vigencia derivada, no persistida) */
  documentos?: DocumentoObra[];
  /** Legajo legal: contratos, presupuestos, permisos, seguros, actas ("Vencido" derivado) */
  legales?: DocumentoLegal[];
  /** Fase OBRA (H8a): diario de jornales, fijos semanales y adelantos */
  diario?: DiarioObra;
  /** Fase OBRA (H8a): caja de obra (ingresos/egresos, balance derivado) */
  caja?: MovimientoCaja[];
  /** Fase OBRA (H8a): pedidos de materiales contra el cómputo (saldo regresivo) */
  compras?: CompraMaterial[];
  /** Fase OBRA (H8a): herramientas llevadas a la obra */
  herramientasObra?: HerramientaEnObra[];
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
