/**
 * Registro de Documentación por obra — lógica pura (testeable en node).
 *
 * Catálogo global de tipos de plano (cat.tiposPlano) con nomenclatura
 * controlada (cod = prefijo de grupo + número, ej. IE1, H5) y registro de
 * revisiones por obra (obra.documentos). La vigencia NO se persiste: para
 * cada código, la revisión de mayor `rev` es la vigente y el resto quedan
 * superadas (se deriva siempre desde el array).
 */
import tiposPlanoJson from './tiposPlano.json';
import type { DocumentoObra, TipoPlano } from './types';

/** Forma del seed embebido: grupos con sus tipos (sub opcional). */
export interface GrupoTiposPlanoSeed {
  grupo: string;
  tipos: { cod: string; den: string; esc: string; sub?: string }[];
}

/** Aplana el seed agrupado a la lista canónica de tipos (con `grupo` en cada uno). */
export function expandirSeedTiposPlano(seed: GrupoTiposPlanoSeed[]): TipoPlano[] {
  const out: TipoPlano[] = [];
  const vistos = new Set<string>();
  for (const g of seed ?? []) {
    for (const t of g.tipos ?? []) {
      const cod = (t.cod ?? '').trim();
      if (!cod || vistos.has(cod)) continue;
      vistos.add(cod);
      const tipo: TipoPlano = { cod, den: t.den ?? '', esc: t.esc ?? '', grupo: g.grupo ?? '' };
      if (t.sub) tipo.sub = t.sub;
      out.push(tipo);
    }
  }
  return out;
}

/** Catálogo de tipos de plano embebido (seed del estudio, 22 grupos / 190 tipos). */
export const SEED_TIPOS_PLANO: TipoPlano[] = expandirSeedTiposPlano(
  tiposPlanoJson as GrupoTiposPlanoSeed[]
);

/**
 * Merge NO destructivo con el seed (mismo criterio que divisiones/SEED del
 * catálogo): los tipos guardados por el usuario mandan (ediciones y altas se
 * respetan); los tipos del seed que no existan por `cod` se agregan al final.
 */
export function mergeTiposPlanoConSeed(guardados: unknown, seed: TipoPlano[]): TipoPlano[] {
  if (!Array.isArray(guardados)) return seed.map((t) => ({ ...t }));
  const propios: TipoPlano[] = [];
  const cods = new Set<string>();
  for (const t of guardados as TipoPlano[]) {
    if (!t || typeof t !== 'object' || typeof t.cod !== 'string' || !t.cod.trim()) continue;
    if (cods.has(t.cod)) continue;
    cods.add(t.cod);
    propios.push(t);
  }
  for (const t of seed) {
    if (!cods.has(t.cod)) {
      cods.add(t.cod);
      propios.push({ ...t });
    }
  }
  return propios;
}

/** Grupos del catálogo en su orden original (sin repetidos). */
export function ordenGrupos(tipos: TipoPlano[]): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  for (const t of tipos ?? []) {
    const g = t.grupo || 'Sin grupo';
    if (!vistos.has(g)) {
      vistos.add(g);
      out.push(g);
    }
  }
  return out;
}

/** Busca un tipo por código exacto. */
export function tipoPorCod(tipos: TipoPlano[], cod: string): TipoPlano | undefined {
  return (tipos ?? []).find((t) => t.cod === cod);
}

/** ¿El código existe en el catálogo de tipos? (el registro exige cod controlado) */
export function validarCod(cod: unknown, tipos: TipoPlano[]): boolean {
  return typeof cod === 'string' && !!cod.trim() && tipoPorCod(tipos, cod) !== undefined;
}

/**
 * Revisión vigente por código: la de mayor `rev` (ante empate de rev —no
 * debería pasar— gana la registrada más tarde en el array).
 */
export function vigentePorCod(docs: DocumentoObra[]): Map<string, DocumentoObra> {
  const map = new Map<string, DocumentoObra>();
  for (const d of docs ?? []) {
    if (!d || typeof d.cod !== 'string') continue;
    const actual = map.get(d.cod);
    if (!actual || Number(d.rev) >= Number(actual.rev)) map.set(d.cod, d);
  }
  return map;
}

/** ¿Esta revisión es la vigente de su código? */
export function esVigente(doc: DocumentoObra, docs: DocumentoObra[]): boolean {
  return vigentePorCod(docs).get(doc.cod)?.id === doc.id;
}

/** Próxima revisión sugerida para un código: (mayor rev)+1, o 0 si no hay ninguna. */
export function proximaRev(docs: DocumentoObra[], cod: string): number {
  let max = -1;
  for (const d of docs ?? []) {
    if (d.cod === cod && Number.isFinite(Number(d.rev))) max = Math.max(max, Number(d.rev));
  }
  return max + 1;
}

/** Un código del registro, con sus revisiones ordenadas (vigente primero). */
export interface DocsPorCod {
  cod: string;
  tipo?: TipoPlano;
  /** Revisiones ordenadas por rev descendente (la [0] es la vigente). */
  revisiones: DocumentoObra[];
  vigente: DocumentoObra;
}

/** Un grupo del catálogo con los códigos registrados en la obra. */
export interface DocsPorGrupo {
  grupo: string;
  cods: DocsPorCod[];
}

/**
 * Agrupa el registro por grupo del catálogo, respetando el orden del catálogo
 * (grupos y tipos). Códigos que ya no estén en el catálogo van al final bajo
 * "Sin grupo". Solo devuelve grupos con al menos un documento.
 */
export function agruparDocs(docs: DocumentoObra[], tipos: TipoPlano[]): DocsPorGrupo[] {
  const vigentes = vigentePorCod(docs ?? []);
  const porCod = new Map<string, DocumentoObra[]>();
  for (const d of docs ?? []) {
    if (!d || typeof d.cod !== 'string') continue;
    const lista = porCod.get(d.cod);
    if (lista) lista.push(d);
    else porCod.set(d.cod, [d]);
  }
  const entrada = (cod: string): DocsPorCod => {
    const revisiones = [...(porCod.get(cod) ?? [])].sort((a, b) => Number(b.rev) - Number(a.rev));
    const vigente = vigentes.get(cod) as DocumentoObra;
    // La vigente siempre primera (cubre empates de rev).
    const resto = revisiones.filter((r) => r.id !== vigente.id);
    return { cod, tipo: tipoPorCod(tipos, cod), revisiones: [vigente, ...resto], vigente };
  };
  const out: DocsPorGrupo[] = [];
  const usados = new Set<string>();
  for (const grupo of ordenGrupos(tipos ?? [])) {
    const cods: DocsPorCod[] = [];
    for (const t of tipos ?? []) {
      if ((t.grupo || 'Sin grupo') !== grupo) continue;
      if (!porCod.has(t.cod) || usados.has(t.cod)) continue;
      usados.add(t.cod);
      cods.push(entrada(t.cod));
    }
    if (cods.length) out.push({ grupo, cods });
  }
  const huerfanos = [...porCod.keys()].filter((c) => !usados.has(c)).sort();
  if (huerfanos.length) out.push({ grupo: 'Sin grupo', cods: huerfanos.map(entrada) });
  return out;
}

/** Último autor registrado en la obra (el del documento agregado más recientemente). */
export function ultimoAutor(docs: DocumentoObra[]): string {
  for (let i = (docs ?? []).length - 1; i >= 0; i--) {
    const a = (docs[i].autor ?? '').trim();
    if (a) return a;
  }
  return '';
}

/** Slug de la denominación para el nombre estándar de archivo. */
export function slugDen(den: string): string {
  return (den ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Nombre estándar sugerido: {COD}_R{rev}_{denominación-slug}. */
export function nombreEstandar(cod: string, rev: number, den: string): string {
  const slug = slugDen(den);
  return `${cod}_R${rev}${slug ? '_' + slug : ''}`;
}

/** KPIs del registro: revisiones totales, documentos vigentes y grupos cubiertos. */
export function kpisDocumentos(
  docs: DocumentoObra[],
  tipos: TipoPlano[]
): { registrados: number; vigentes: number; gruposCubiertos: number; gruposTotal: number } {
  const vigentes = vigentePorCod(docs ?? []);
  const grupos = new Set<string>();
  for (const cod of vigentes.keys()) {
    const t = tipoPorCod(tipos ?? [], cod);
    if (t) grupos.add(t.grupo || 'Sin grupo');
  }
  return {
    registrados: (docs ?? []).length,
    vigentes: vigentes.size,
    gruposCubiertos: grupos.size,
    gruposTotal: ordenGrupos(tipos ?? []).length
  };
}
