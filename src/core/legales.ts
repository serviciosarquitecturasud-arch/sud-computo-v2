/**
 * Legajo legal por obra — lógica pura (testeable en node).
 *
 * Registro de contratos, presupuestos aprobados, permisos/trámites,
 * seguridad e higiene, ART/seguros y actas (obra.legales), con catálogo
 * global de categorías editable (cat.categoriasLegal, merge no destructivo
 * con el seed). El estado "Vencido" NO se persiste: se deriva comparando
 * fechaVenc contra hoy y se muestra superpuesto al estado guardado.
 */
import type { DocumentoLegal, EstadoLegal } from './types';

/** Estados persistibles de un documento legal (el "Vencido" se deriva). */
export const ESTADOS_LEGAL: EstadoLegal[] = ['presentado', 'aprobado', 'firmado', 'rechazado'];

/** Categorías seed del legajo legal del estudio. */
export const SEED_CATEGORIAS_LEGAL: string[] = [
  'Presupuesto a cliente',
  'Presupuesto de contratista',
  'Contrato con cliente',
  'Contrato con contratista',
  'Permiso / trámite municipal',
  'Seguridad e higiene',
  'ART / seguros',
  'Acta',
  'Otros'
];

/**
 * Merge NO destructivo con el seed (mismo criterio que divisiones/tiposPlano):
 * las categorías guardadas por el usuario mandan (orden y altas se respetan);
 * las del seed que falten se agregan al final. Descarta vacíos y duplicados
 * (comparación sin distinguir mayúsculas para no repetir "acta"/"Acta").
 */
export function mergeCategoriasLegalConSeed(guardadas: unknown, seed: string[]): string[] {
  if (!Array.isArray(guardadas)) return [...seed];
  const propias: string[] = [];
  const claves = new Set<string>();
  for (const c of guardadas) {
    if (typeof c !== 'string' || !c.trim()) continue;
    const clave = c.trim().toLowerCase();
    if (claves.has(clave)) continue;
    claves.add(clave);
    propias.push(c);
  }
  for (const c of seed) {
    const clave = c.trim().toLowerCase();
    if (!claves.has(clave)) {
      claves.add(clave);
      propias.push(c);
    }
  }
  return propias;
}

/**
 * ¿El documento está vencido a la fecha `hoy` (ISO yyyy-mm-dd)?
 * Solo aplica si tiene fechaVenc; el día del vencimiento todavía NO está
 * vencido (vence al final del día). Comparación lexicográfica de ISO.
 */
export function estaVencido(doc: Pick<DocumentoLegal, 'fechaVenc'>, hoy: string): boolean {
  const v = (doc?.fechaVenc ?? '').trim();
  return !!v && v < hoy;
}

/** ¿La categoría es de presupuestos? (para el KPI de monto aprobado) */
export function esCategoriaPresupuesto(categoria: string): boolean {
  return /presupuesto/i.test(categoria ?? '');
}

/** Abreviatura de una categoría para chips (primera palabra: "ART / seguros" → "ART"). */
export function abrevCategoria(categoria: string): string {
  const primera = (categoria ?? '').trim().split(/\s+/)[0] ?? '';
  return primera.replace(/[/·,;:]+$/, '') || 'Legal';
}

export interface KpisLegales {
  /** Documentos registrados en el legajo */
  total: number;
  /** Aprobados o firmados */
  aprobados: number;
  /** Presentados (a la espera de respuesta) */
  pendientes: number;
  /** Con fechaVenc anterior a hoy (derivado, no persistido) */
  vencidos: number;
  /** Monto total (ARS) de presupuestos aprobados/firmados */
  montoPresupAprobado: number;
}

/** KPIs del legajo legal a la fecha `hoy` (ISO yyyy-mm-dd). */
export function kpisLegales(docs: DocumentoLegal[], hoy: string): KpisLegales {
  const lista = Array.isArray(docs) ? docs : [];
  let aprobados = 0;
  let pendientes = 0;
  let vencidos = 0;
  let monto = 0;
  for (const d of lista) {
    if (!d || typeof d !== 'object') continue;
    const aprobado = d.estado === 'aprobado' || d.estado === 'firmado';
    if (aprobado) aprobados++;
    if (d.estado === 'presentado') pendientes++;
    if (estaVencido(d, hoy)) vencidos++;
    if (aprobado && esCategoriaPresupuesto(d.categoria) && Number.isFinite(Number(d.monto))) {
      monto += Number(d.monto);
    }
  }
  return { total: lista.length, aprobados, pendientes, vencidos, montoPresupAprobado: monto };
}

/** Una categoría del legajo con sus documentos (fechaDoc descendente). */
export interface LegalesPorCategoria {
  categoria: string;
  docs: DocumentoLegal[];
}

/**
 * Agrupa el legajo por categoría respetando el orden del catálogo.
 * Categorías con documentos pero fuera del catálogo van al final (orden
 * alfabético es-AR); dentro de cada grupo, por fechaDoc descendente.
 * Solo devuelve categorías con al menos un documento.
 */
export function agruparLegales(docs: DocumentoLegal[], categorias: string[]): LegalesPorCategoria[] {
  const porCat = new Map<string, DocumentoLegal[]>();
  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d || typeof d !== 'object') continue;
    const c = (d.categoria ?? '').trim() || 'Sin categoría';
    const lista = porCat.get(c);
    if (lista) lista.push(d);
    else porCat.set(c, [d]);
  }
  const ordenar = (lista: DocumentoLegal[]) =>
    [...lista].sort((a, b) => (b.fechaDoc ?? '').localeCompare(a.fechaDoc ?? ''));
  const out: LegalesPorCategoria[] = [];
  const usadas = new Set<string>();
  for (const c of Array.isArray(categorias) ? categorias : []) {
    if (porCat.has(c) && !usadas.has(c)) {
      usadas.add(c);
      out.push({ categoria: c, docs: ordenar(porCat.get(c) as DocumentoLegal[]) });
    }
  }
  const huerfanas = [...porCat.keys()]
    .filter((c) => !usadas.has(c))
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  for (const c of huerfanas) out.push({ categoria: c, docs: ordenar(porCat.get(c) as DocumentoLegal[]) });
  return out;
}
