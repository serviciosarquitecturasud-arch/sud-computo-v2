/**
 * Import Revit — lógica pura (sin React).
 * Port 1:1 del legacy en producción (validateRevitPayload, magnitudParaUnidad,
 * constantes de schema, vinculación obra ↔ archivo y aplicación del import).
 *
 * DIFERENCIA DELIBERADA con el legacy (regla de negocio del proyecto):
 * el ÚNICO campo válido para mapear elemento Revit → código SUD es el campo
 * Comentarios del elemento (nunca el Type name). Las filas sin comentario se
 * reportan ("fila sin comentario, cargar y reintentar") y NO se importan.
 * El mapa manual (clave = texto del comentario → código de rubro) se persiste
 * en localStorage bajo `cmp_revitMap` (via revitMap/setRevitMap del estado).
 */
import { cmpCodigo } from './codigo';
import type { ItemObra, Obra, Rubro } from './types';

/* ============================ CONSTANTES DE SCHEMA ============================ */

export const REVIT_SCHEMA_VERSION = '1.1';
export const REVIT_SCHEMA_ACEPTADAS = ['1.0', '1.1'];
export const REVIT_CATS_MVP = ['Walls', 'Doors', 'Windows', 'Floors'];

/* ============================ TIPOS DEL PAYLOAD ============================ */

export interface RevitMetadata {
  schemaVersion: string;
  fecha: string;
  proyecto: string;
  documentoHost: string;
  /** Requerido en schema 1.1 — identifica unívocamente el archivo .rvt */
  documentoHostRuta?: string;
  documentosLinkeados: unknown[];
  totalElementos?: number;
  categoriasIncluidas?: string[];
  [k: string]: unknown;
}

export interface RevitUbicacion {
  nivel?: string | null;
  fase?: string | null;
  workset?: string | null;
  [k: string]: unknown;
}

export interface RevitElemento {
  uid: string;
  id: number | string;
  documento: string;
  documentoRuta?: string;
  categoria: string;
  familia?: string;
  tipo: string;
  /** Campo Comentarios del elemento — ÚNICA fuente válida de mapeo a código SUD */
  comentario?: string;
  comentarios?: string;
  magnitudes: Record<string, number>;
  ubicacion?: RevitUbicacion;
  parametros?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface RevitPayload {
  metadata: RevitMetadata;
  elementos: RevitElemento[];
}

/** Vinculación obra ↔ archivo Revit (obra.revitVinculo) */
export interface RevitVinculo {
  rutaArchivo: string;
  vinculadoEn: string;
  ultimoImport: string | null;
}

export interface RevitOrigenElemento {
  uid: string;
  id: number | string;
  tipo: string;
  valor: number;
  nivel: string | null;
  fase: string | null;
  workset: string | null;
}

/** Trazabilidad guardada en cada ítem importado (item.revitOrigen) */
export interface RevitOrigen {
  schemaVersion: string;
  fechaImport: string;
  proyecto: string;
  rutaArchivo: string | null;
  magnitudUsada: string;
  elementos: RevitOrigenElemento[];
}

export interface ResultadoValidacion {
  errs: string[];
  warns: string[];
}

type Rec = Record<string, unknown>;

/* ============================ VALIDACIÓN (port 1:1) ============================ */

export function validateRevitPayload(parsed: unknown): ResultadoValidacion {
  const errs: string[] = [];
  const warns: string[] = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { errs: ['El JSON raíz debe ser un objeto con metadata y elementos.'], warns: [] };
  }
  const raiz = parsed as Rec;
  const m = raiz.metadata as Rec | undefined;
  let version: string | null = null;
  if (!m || typeof m !== 'object') {
    errs.push('Falta el bloque "metadata".');
  } else {
    if (REVIT_SCHEMA_ACEPTADAS.indexOf(m.schemaVersion as string) < 0) {
      errs.push(`metadata.schemaVersion debe ser una de: ${REVIT_SCHEMA_ACEPTADAS.join(', ')} (recibido: "${m.schemaVersion}").`);
    } else {
      version = m.schemaVersion as string;
      if (version === '1.0') {
        warns.push('Schema v1.0 obsoleto. Se acepta por compatibilidad pero no permite vinculación robusta obra ↔ archivo (todos los archivos Revit con el mismo nombre quedan indistinguibles). Migrar a v1.1 con documentoHostRuta.');
      }
    }
    ['fecha', 'proyecto', 'documentoHost'].forEach((k) => {
      if (typeof m[k] !== 'string' || !m[k]) errs.push(`Falta metadata.${k} (string).`);
    });
    if (version === '1.1') {
      if (typeof m.documentoHostRuta !== 'string' || !m.documentoHostRuta) {
        errs.push('Falta metadata.documentoHostRuta (string, ruta completa del archivo Revit). Es requerido en schema v1.1.');
      }
    }
    if (!Array.isArray(m.documentosLinkeados)) {
      errs.push('metadata.documentosLinkeados debe ser un array (puede estar vacío).');
    }
  }
  const elementos = raiz.elementos;
  if (!Array.isArray(elementos)) {
    errs.push('Falta el array "elementos".');
    return { errs, warns };
  }
  if (elementos.length === 0) {
    errs.push('El array "elementos" está vacío.');
    return { errs, warns };
  }
  const reqFields = ['uid', 'id', 'documento', 'categoria', 'tipo', 'magnitudes'];
  const uidSet = new Set<string>();
  elementos.forEach((elRaw: unknown, i: number) => {
    if (!elRaw || typeof elRaw !== 'object' || Array.isArray(elRaw)) {
      errs.push(`elementos[${i}] no es un objeto.`);
      return;
    }
    const el = elRaw as Rec;
    reqFields.forEach((f) => {
      const v = el[f];
      if (v === undefined || v === null || v === '') {
        errs.push(`elementos[${i}] no tiene "${f}".`);
      }
    });
    if (typeof el.uid === 'string' && el.uid) {
      if (uidSet.has(el.uid)) errs.push(`elementos[${i}] uid duplicado: "${el.uid}".`);
      uidSet.add(el.uid);
    }
    const mags = el.magnitudes;
    if (mags !== undefined && (typeof mags !== 'object' || Array.isArray(mags))) {
      errs.push(`elementos[${i}].magnitudes debe ser un objeto.`);
    } else if (mags && Object.keys(mags as Rec).length === 0) {
      errs.push(`elementos[${i}].magnitudes no tiene ninguna magnitud.`);
    } else if (mags) {
      Object.keys(mags as Rec).forEach((k) => {
        const v = (mags as Rec)[k];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          errs.push(`elementos[${i}].magnitudes.${k} debe ser un número finito (recibido: ${JSON.stringify(v)}).`);
        } else if (v < 0) {
          errs.push(`elementos[${i}].magnitudes.${k} no puede ser negativo (recibido: ${v}).`);
        }
      });
    }
  });
  // Cross-checks de consistencia entre metadata y contenido real (sólo warnings)
  if (m && typeof m === 'object') {
    if (m.totalElementos !== undefined) {
      if (typeof m.totalElementos !== 'number' || !Number.isFinite(m.totalElementos)) {
        warns.push(`metadata.totalElementos debería ser un número (recibido: ${JSON.stringify(m.totalElementos)}). Se ignora para el cross-check.`);
      } else if (m.totalElementos !== elementos.length) {
        warns.push(`metadata.totalElementos declara ${m.totalElementos} pero el array "elementos" tiene ${elementos.length}. Posible export parcial o corrupción del JSON.`);
      }
    }
    if (m.categoriasIncluidas !== undefined) {
      if (!Array.isArray(m.categoriasIncluidas)) {
        warns.push(`metadata.categoriasIncluidas debería ser un array (recibido: ${typeof m.categoriasIncluidas}). Se ignora para el cross-check.`);
      } else {
        const catsDeclaradas = new Set(m.categoriasIncluidas as unknown[]);
        const catsReales = new Set<string>();
        elementos.forEach((elRaw: unknown) => {
          const el = elRaw as Rec | null;
          if (el && typeof el === 'object' && typeof el.categoria === 'string') catsReales.add(el.categoria);
        });
        const noDeclaradas: string[] = [];
        catsReales.forEach((c) => {
          if (!catsDeclaradas.has(c)) noDeclaradas.push(c);
        });
        if (noDeclaradas.length > 0) {
          warns.push(`Hay categorías en elementos[] que no figuran en metadata.categoriasIncluidas: ${noDeclaradas.join(', ')}. Metadata inconsistente.`);
        }
      }
    }
  }
  return { errs, warns };
}

/* ============================ MAGNITUDES (port 1:1) ============================ */

export function magnitudParaUnidad(unidad: unknown): string | null {
  const u = (unidad || '').toString().toLowerCase().trim();
  if (u === 'm²' || u === 'm2') return 'area_m2';
  if (u === 'm³' || u === 'm3') return 'volumen_m3';
  if (u === 'ml' || u === 'm') return 'longitud_m';
  if (u === 'un' || u === 'u') return '__count__';
  if (u === 'kg') return 'peso_kg';
  if (u === 'gl') return '__count__';
  return null;
}

/* ============================ MAPEO POR COMENTARIOS ============================ */

/**
 * Extrae el campo Comentarios del elemento. Acepta las variantes con las que
 * exporta NonicaTab: `comentario`, `comentarios`, o dentro de `parametros`
 * ("Comentarios" / "comentarios" / "Comments").
 */
export function comentarioDeElemento(el: RevitElemento): string {
  const p = (el.parametros || {}) as Rec;
  const candidatos: unknown[] = [el.comentario, el.comentarios, p['Comentarios'], p['comentarios'], p['Comments']];
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

export type FuenteMapeo = 'comentario' | 'mapaManual';

/** Grupo de elementos que comparten el mismo texto de Comentarios */
export interface GrupoComentario {
  /** Texto del campo Comentarios (clave de mapeo y del mapa manual) */
  comentario: string;
  count: number;
  categorias: string[];
  tipos: string[];
  /** Código de rubro resultante (comentario directo u override del mapa manual) */
  codFinal: string;
  fuente: FuenteMapeo;
  rubroValido: boolean;
  rubroDesc: string | null;
  rubroUnidad: string | null;
}

export interface FilaSinComentario {
  uid: string;
  id: number | string;
  categoria: string;
  tipo: string;
  nivel: string | null;
}

export interface RubroPreview {
  cod: string;
  desc: string;
  unidad: string;
  magnitudKey: string | null;
  cantidad: number;
  count: number;
  comentarios: string[];
}

export interface ElementoSinMagnitud {
  uid: string;
  tipo: string;
  unidadRubro: string;
  magnitudEsperada: string | null;
}

export interface PreparacionImport {
  grupos: GrupoComentario[];
  /** Filas sin Comentarios cargado: reportar "fila sin comentario, cargar y reintentar" */
  sinComentario: FilaSinComentario[];
  rubros: RubroPreview[];
  sinMagnitud: ElementoSinMagnitud[];
  excluidos: { fueraMvp: number; sinComentario: number; invalido: number };
}

function rubrosValidosSet(rubros: Rubro[]): Set<string> {
  const s = new Set<string>();
  rubros.forEach((r) => {
    if (r.unidad && !r.cod.endsWith('.00')) s.add(r.cod);
  });
  return s;
}

function indexarRubros(rubros: Rubro[]): Record<string, Rubro> {
  const m: Record<string, Rubro> = {};
  rubros.forEach((r) => {
    m[r.cod] = r;
  });
  return m;
}

/**
 * Agrupa los elementos del payload por campo Comentarios, resuelve el código
 * de rubro (comentario directo o mapa manual) y arma la vista previa de
 * cantidades por rubro. NUNCA usa el Type name para mapear.
 */
export function prepararImport(
  payload: RevitPayload,
  rubros: Rubro[],
  mapaManual: Record<string, string>
): PreparacionImport {
  const setMvp = new Set(REVIT_CATS_MVP);
  const validos = rubrosValidosSet(rubros);
  const rubrosMap = indexarRubros(rubros);

  const grupos: Record<string, GrupoComentario & { _cats: Set<string>; _tipos: Set<string> }> = {};
  const sinComentario: FilaSinComentario[] = [];
  let fueraMvp = 0;

  payload.elementos.forEach((el) => {
    if (!setMvp.has(el.categoria)) {
      fueraMvp++;
      return;
    }
    const com = comentarioDeElemento(el);
    if (!com) {
      sinComentario.push({
        uid: el.uid,
        id: el.id,
        categoria: el.categoria,
        tipo: el.tipo,
        nivel: (el.ubicacion && el.ubicacion.nivel) || null
      });
      return;
    }
    if (!grupos[com]) {
      grupos[com] = {
        comentario: com,
        count: 0,
        categorias: [],
        tipos: [],
        codFinal: com,
        fuente: 'comentario',
        rubroValido: false,
        rubroDesc: null,
        rubroUnidad: null,
        _cats: new Set<string>(),
        _tipos: new Set<string>()
      };
    }
    const g = grupos[com];
    g.count++;
    g._cats.add(el.categoria);
    g._tipos.add(el.tipo);
  });

  const listaGrupos: GrupoComentario[] = Object.values(grupos)
    .map((g) => {
      const manual = mapaManual[g.comentario];
      const codFinal = manual || g.comentario;
      const fuente: FuenteMapeo = manual ? 'mapaManual' : 'comentario';
      const rubroValido = validos.has(codFinal);
      const r = rubrosMap[codFinal];
      return {
        comentario: g.comentario,
        count: g.count,
        categorias: Array.from(g._cats).sort(),
        tipos: Array.from(g._tipos).sort(),
        codFinal,
        fuente,
        rubroValido,
        rubroDesc: r ? r.desc : null,
        rubroUnidad: r ? r.unidad : null
      };
    })
    .sort((a, b) => a.comentario.localeCompare(b.comentario, 'es'));

  const gruposPorComentario: Record<string, GrupoComentario> = {};
  listaGrupos.forEach((g) => {
    gruposPorComentario[g.comentario] = g;
  });

  // Vista previa de cantidades por rubro
  const buckets: Record<string, RubroPreview & { _coms: Set<string> }> = {};
  const sinMagnitud: ElementoSinMagnitud[] = [];
  let exclInvalido = 0;

  payload.elementos.forEach((el) => {
    if (!setMvp.has(el.categoria)) return;
    const com = comentarioDeElemento(el);
    if (!com) return;
    const g = gruposPorComentario[com];
    if (!g || !g.rubroValido) {
      exclInvalido++;
      return;
    }
    const r = rubrosMap[g.codFinal];
    if (!r) {
      exclInvalido++;
      return;
    }
    const magKey = magnitudParaUnidad(r.unidad);
    if (!buckets[g.codFinal]) {
      buckets[g.codFinal] = {
        cod: g.codFinal,
        desc: r.desc,
        unidad: r.unidad,
        magnitudKey: magKey,
        cantidad: 0,
        count: 0,
        comentarios: [],
        _coms: new Set<string>()
      };
    }
    const b = buckets[g.codFinal];
    b.count++;
    b._coms.add(com);
    if (magKey === '__count__') {
      b.cantidad += 1;
    } else if (magKey && el.magnitudes && typeof el.magnitudes[magKey] === 'number') {
      b.cantidad += el.magnitudes[magKey];
    } else {
      sinMagnitud.push({ uid: el.uid, tipo: el.tipo, unidadRubro: r.unidad, magnitudEsperada: magKey });
    }
  });

  const listaRubros: RubroPreview[] = Object.values(buckets)
    .map((b) => ({
      cod: b.cod,
      desc: b.desc,
      unidad: b.unidad,
      magnitudKey: b.magnitudKey,
      cantidad: b.cantidad,
      count: b.count,
      comentarios: Array.from(b._coms).sort()
    }))
    .sort((a, b) => cmpCodigo(a.cod, b.cod));

  return {
    grupos: listaGrupos,
    sinComentario,
    rubros: listaRubros,
    sinMagnitud,
    excluidos: { fueraMvp, sinComentario: sinComentario.length, invalido: exclInvalido }
  };
}

/* ============================ VINCULACIÓN OBRA ↔ ARCHIVO ============================ */

export type EstadoVinculo =
  | { tipo: 'noVinculada' }
  | { tipo: 'sinRuta' }
  | { tipo: 'sinRutaJson'; rutaObra: string }
  | { tipo: 'match'; ruta: string }
  | { tipo: 'mismatch'; rutaObra: string; rutaJson: string };

/** Port 1:1 del vinculoStatus del legacy (schema 1.1: metadata.documentoHostRuta). */
export function estadoVinculo(payload: RevitPayload, obra: Obra): EstadoVinculo {
  const rutaJson = payload.metadata.documentoHostRuta || null;
  const v = obra.revitVinculo as RevitVinculo | undefined;
  if (!v || !v.rutaArchivo) {
    return { tipo: rutaJson ? 'noVinculada' : 'sinRuta' };
  }
  if (!rutaJson) return { tipo: 'sinRutaJson', rutaObra: v.rutaArchivo };
  if (v.rutaArchivo === rutaJson) return { tipo: 'match', ruta: v.rutaArchivo };
  return { tipo: 'mismatch', rutaObra: v.rutaArchivo, rutaJson };
}

/* ============================ DIFF CONTRA LA OBRA ============================ */

export type EstadoFilaDiff = 'nuevo' | 'cambia' | 'igual';

export interface DiffElementos {
  nuevos: RevitOrigenElemento[];
  modificados: (RevitOrigenElemento & { valorPrev: number })[];
  eliminados: RevitOrigenElemento[];
  sinCambios: RevitOrigenElemento[];
}

export interface FilaDiff {
  cod: string;
  desc: string;
  unidad: string;
  estado: EstadoFilaDiff;
  cantAnterior: number | null;
  cantNueva: number;
  esReimport: boolean;
  /** El ítem existía en la obra cargado a mano (sin revitOrigen): el import lo pisa */
  conflictoManual: boolean;
  elementos: DiffElementos;
}

export interface DiffImport {
  filas: FilaDiff[];
  total: { nuevos: number; modificados: number; eliminados: number; sinCambios: number };
  hayReimport: boolean;
}

function elementosPorCod(payload: RevitPayload, prep: PreparacionImport): Record<string, RevitOrigenElemento[]> {
  const setMvp = new Set(REVIT_CATS_MVP);
  const porComentario: Record<string, GrupoComentario> = {};
  prep.grupos.forEach((g) => {
    porComentario[g.comentario] = g;
  });
  const rubroPorCod: Record<string, RubroPreview> = {};
  prep.rubros.forEach((b) => {
    rubroPorCod[b.cod] = b;
  });
  const acc: Record<string, RevitOrigenElemento[]> = {};
  payload.elementos.forEach((el) => {
    if (!setMvp.has(el.categoria)) return;
    const com = comentarioDeElemento(el);
    if (!com) return;
    const g = porComentario[com];
    if (!g || !g.rubroValido) return;
    const b = rubroPorCod[g.codFinal];
    if (!b) return;
    const magKey = b.magnitudKey;
    const valor =
      magKey === '__count__'
        ? 1
        : magKey && el.magnitudes && typeof el.magnitudes[magKey] === 'number'
          ? el.magnitudes[magKey]
          : null;
    if (valor === null) return;
    if (!acc[g.codFinal]) acc[g.codFinal] = [];
    acc[g.codFinal].push({
      uid: el.uid,
      id: el.id,
      tipo: el.tipo,
      valor,
      nivel: (el.ubicacion && el.ubicacion.nivel) || null,
      fase: (el.ubicacion && el.ubicacion.fase) || null,
      workset: (el.ubicacion && el.ubicacion.workset) || null
    });
  });
  return acc;
}

/** Diff por rubro y por elemento (uid) contra los items actuales de la obra. */
export function diffContraObra(payload: RevitPayload, prep: PreparacionImport, obra: Obra): DiffImport {
  const itemsByCod: Record<string, ItemObra> = {};
  (obra.items || []).forEach((it) => {
    itemsByCod[it.cod] = it;
  });
  const nuevosPorCod = elementosPorCod(payload, prep);

  const filas: FilaDiff[] = [];
  let totNuevos = 0,
    totModificados = 0,
    totEliminados = 0,
    totSinCambios = 0;
  let hayReimport = false;

  prep.rubros.forEach((b) => {
    const ex = itemsByCod[b.cod];
    const origen = ex ? (ex.revitOrigen as RevitOrigen | undefined) : undefined;
    const previos = origen && Array.isArray(origen.elementos) ? origen.elementos : [];
    if (previos.length > 0) hayReimport = true;
    const nuevos = nuevosPorCod[b.cod] || [];

    const prevByUid: Record<string, RevitOrigenElemento> = {};
    previos.forEach((p) => {
      prevByUid[p.uid] = p;
    });
    const nuevByUid: Record<string, RevitOrigenElemento> = {};
    nuevos.forEach((n) => {
      nuevByUid[n.uid] = n;
    });

    const nv: RevitOrigenElemento[] = [];
    const mod: (RevitOrigenElemento & { valorPrev: number })[] = [];
    const elim: RevitOrigenElemento[] = [];
    const sc: RevitOrigenElemento[] = [];
    nuevos.forEach((n) => {
      const p = prevByUid[n.uid];
      if (!p) {
        nv.push(n);
      } else if (Math.abs((Number(p.valor) || 0) - (Number(n.valor) || 0)) > 0.001) {
        mod.push({ ...n, valorPrev: Number(p.valor) || 0 });
      } else {
        sc.push(n);
      }
    });
    previos.forEach((p) => {
      if (!nuevByUid[p.uid]) elim.push(p);
    });

    const cantAnterior = ex ? Number(ex.cant) || 0 : null;
    const estado: EstadoFilaDiff = !ex
      ? 'nuevo'
      : Math.abs((cantAnterior || 0) - b.cantidad) > 0.001
        ? 'cambia'
        : 'igual';

    filas.push({
      cod: b.cod,
      desc: b.desc,
      unidad: b.unidad,
      estado,
      cantAnterior,
      cantNueva: b.cantidad,
      esReimport: previos.length > 0,
      conflictoManual: !!ex && !ex.revitOrigen,
      elementos: { nuevos: nv, modificados: mod, eliminados: elim, sinCambios: sc }
    });
    totNuevos += nv.length;
    totModificados += mod.length;
    totEliminados += elim.length;
    totSinCambios += sc.length;
  });

  return {
    filas,
    total: { nuevos: totNuevos, modificados: totModificados, eliminados: totEliminados, sinCambios: totSinCambios },
    hayReimport
  };
}

/* ============================ APLICAR IMPORT ============================ */

export interface ResultadoAplicar {
  obra: Obra;
  diff: DiffImport;
  sinComentario: FilaSinComentario[];
  nuevos: number;
  reimportados: number;
  conflictosResueltos: number;
  autoVinculo: boolean;
  rutaArchivo: string | null;
}

/**
 * Aplica un payload YA VALIDADO a la obra: crea/actualiza items por rubro,
 * respeta el mapa manual (clave = comentario), guarda revitOrigen para
 * trazabilidad y actualiza la vinculación obra ↔ archivo (schema 1.1).
 * Devuelve la obra nueva (inmutable) + diff + filas sin comentario.
 */
export function aplicarRevitAObra(
  obra: Obra,
  payload: RevitPayload,
  rubros: Rubro[],
  mapaManual: Record<string, string>,
  fechaImport: string = new Date().toISOString()
): ResultadoAplicar {
  const prep = prepararImport(payload, rubros, mapaManual);
  const diff = diffContraObra(payload, prep, obra);
  const rutaJson = payload.metadata.documentoHostRuta || null;
  const porCod = elementosPorCod(payload, prep);

  const items: ItemObra[] = [...(obra.items || [])];
  const idxByCod: Record<string, number> = {};
  items.forEach((it, i) => {
    idxByCod[it.cod] = i;
  });
  let nuevos = 0,
    reimportados = 0,
    conflictosResueltos = 0;

  prep.rubros.forEach((b) => {
    const revitOrigen: RevitOrigen = {
      schemaVersion: payload.metadata.schemaVersion,
      fechaImport,
      proyecto: payload.metadata.proyecto,
      rutaArchivo: rutaJson,
      magnitudUsada: b.magnitudKey === '__count__' ? 'count' : b.magnitudKey || '',
      elementos: porCod[b.cod] || []
    };
    const idx = idxByCod[b.cod];
    if (idx === undefined) {
      items.push({ cod: b.cod, cant: b.cantidad, precioManual: 0, revitOrigen });
      nuevos++;
    } else {
      const ex = items[idx];
      const eraDeRevit = !!ex.revitOrigen;
      items[idx] = { ...ex, cant: b.cantidad, revitOrigen };
      if (eraDeRevit) reimportados++;
      else conflictosResueltos++;
    }
  });

  let revitVinculo = obra.revitVinculo as RevitVinculo | undefined;
  let autoVinculo = false;
  if ((!revitVinculo || !revitVinculo.rutaArchivo) && rutaJson) {
    revitVinculo = { rutaArchivo: rutaJson, vinculadoEn: fechaImport, ultimoImport: fechaImport };
    autoVinculo = true;
  } else if (revitVinculo) {
    revitVinculo = { ...revitVinculo, ultimoImport: fechaImport };
  }

  const obraActualizada: Obra = { ...obra, items };
  if (revitVinculo) obraActualizada.revitVinculo = revitVinculo;

  return {
    obra: obraActualizada,
    diff,
    sinComentario: prep.sinComentario,
    nuevos,
    reimportados,
    conflictosResueltos,
    autoVinculo,
    rutaArchivo: rutaJson
  };
}
