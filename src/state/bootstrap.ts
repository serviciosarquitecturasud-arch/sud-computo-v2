/**
 * Bootstrap de datos — port 1:1 de la lógica de arranque del legacy.
 * - Merge NO destructivo con el SEED (los ítems del usuario mandan).
 * - deletedApus: APUs eliminados no se re-inyectan.
 * - apusEditados: APUs editados quedan blindados (el SEED no los toca).
 * - Migraciones silenciosas: divisiones canónicas, materialesConfig,
 *   coef.iva=0 (R11 H7), cotizaciones → cotizacionesPorRubro (H1 comparativa).
 */
import {
  SEED_CATEGORIAS_LEGAL,
  SEED_TIPOS_PLANO,
  mergeCategoriasLegalConSeed,
  mergeTiposPlanoConSeed
} from '../core';
import type { Catalogo, Obra } from '../core';

export function mergeCatalogoConSeed(guardadoRaw: string | null, seedFresh: Catalogo): Catalogo {
  let catFinal: Catalogo;
  if (guardadoRaw) {
    try {
      const parsed = JSON.parse(guardadoRaw);
      catFinal = {
        materiales: Array.isArray(parsed.materiales) ? parsed.materiales : seedFresh.materiales,
        manoObra: Array.isArray(parsed.manoObra) ? parsed.manoObra : seedFresh.manoObra,
        herramientas: Array.isArray(parsed.herramientas) ? parsed.herramientas : seedFresh.herramientas,
        rubros: Array.isArray(parsed.rubros) ? parsed.rubros : seedFresh.rubros,
        biblioteca: Array.isArray(parsed.biblioteca) ? parsed.biblioteca : seedFresh.biblioteca,
        deletedApus: Array.isArray(parsed.deletedApus) ? parsed.deletedApus : [],
        apusEditados: Array.isArray(parsed.apusEditados) ? parsed.apusEditados : [],
        divisiones: Array.isArray(parsed.divisiones) ? parsed.divisiones : undefined,
        tiposPlano: Array.isArray(parsed.tiposPlano) ? parsed.tiposPlano : undefined,
        categoriasLegal: Array.isArray(parsed.categoriasLegal) ? parsed.categoriasLegal : undefined
      };
      const deletedApusSet = new Set(catFinal.deletedApus);
      const editadosSet = new Set(catFinal.apusEditados);
      const matCods = new Set(catFinal.materiales.map((m) => m.cod));
      seedFresh.materiales.forEach((m) => {
        if (!matCods.has(m.cod)) catFinal.materiales.push(m);
      });
      const moCods = new Set(catFinal.manoObra.map((x) => x.cod));
      seedFresh.manoObra.forEach((x) => {
        if (!moCods.has(x.cod)) catFinal.manoObra.push(x);
      });
      const eqCods = new Set(catFinal.herramientas.map((h) => h.cod));
      seedFresh.herramientas.forEach((h) => {
        if (!eqCods.has(h.cod)) catFinal.herramientas.push(h);
      });
      const rubCods = new Set(catFinal.rubros.map((r) => r.cod));
      seedFresh.rubros.forEach((r) => {
        if (deletedApusSet.has(r.cod)) return;
        if (editadosSet.has(r.cod)) return;
        if (!rubCods.has(r.cod)) catFinal.rubros.push(r);
      });
      const bibKey = (b: { apu: string; tipo: string; insumo: string }) =>
        b.apu + '|' + b.tipo + '|' + b.insumo;
      const bibKeys = new Set(catFinal.biblioteca.map(bibKey));
      seedFresh.biblioteca.forEach((b) => {
        if (deletedApusSet.has(b.apu)) return;
        if (editadosSet.has(b.apu)) return;
        if (!bibKeys.has(bibKey(b))) catFinal.biblioteca.push(b);
      });
    } catch (err) {
      console.warn('Catálogo guardado corrupto, usando seed:', err);
      catFinal = seedFresh;
    }
  } else {
    catFinal = seedFresh;
  }
  // Divisiones canónicas: si no existen, sembrar con las usadas en materiales
  if (!Array.isArray(catFinal.divisiones)) {
    const usadas = [
      ...new Set((catFinal.materiales || []).map((m) => (m.div || '').trim()).filter(Boolean))
    ];
    catFinal.divisiones = usadas.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }
  // Tipos de plano: merge no destructivo con el seed embebido (los del usuario
  // mandan; los nuevos del seed se agregan por cod). Mismo criterio que arriba.
  catFinal.tiposPlano = mergeTiposPlanoConSeed(catFinal.tiposPlano, SEED_TIPOS_PLANO);
  // Categorías del legajo legal: mismo merge no destructivo con el seed.
  catFinal.categoriasLegal = mergeCategoriasLegalConSeed(
    catFinal.categoriasLegal,
    SEED_CATEGORIAS_LEGAL
  );
  return catFinal;
}

export function migrarObras(obrasRaw: string | null, cat: Catalogo): Obra[] {
  let obrasFinal: Obra[] = [];
  if (obrasRaw) {
    try {
      const parsedO = JSON.parse(obrasRaw);
      obrasFinal = Array.isArray(parsedO) ? parsedO : [];
    } catch (err) {
      console.warn('Obras guardadas corruptas, arrancando vacío:', err);
      obrasFinal = [];
    }
  }
  const divDe: Record<string, string> = {};
  (cat.materiales || []).forEach((m) => {
    divDe[m.cod] = (m.div || '').trim() || 'Sin división';
  });
  return obrasFinal.map((o) => {
    if (!o || typeof o !== 'object') return o;
    const next: Obra = { ...o };
    if (!next.materialesConfig) next.materialesConfig = {};
    if (next.coef && next.coef.iva !== 0) {
      next.coef = { ...next.coef, iva: 0 };
    }
    if (!next.cotizacionesPorRubro) {
      const porRubro: Record<string, unknown> = {};
      const cotViejas = (next.cotizaciones || {}) as Record<
        string,
        { p?: { nombre?: string; iva?: string; precio?: unknown }[] }
      >;
      const nombreGlobal = [0, 1, 2].map((i) => {
        for (const k in cotViejas) {
          const v = cotViejas[k] && cotViejas[k].p && cotViejas[k].p![i] && cotViejas[k].p![i].nombre;
          if (v) return v;
        }
        return '';
      });
      const ivaGlobal = [0, 1, 2].map((i) => {
        for (const k in cotViejas) {
          const v = cotViejas[k] && cotViejas[k].p && cotViejas[k].p![i] && cotViejas[k].p![i].iva;
          if (v) return v;
        }
        return 'sin';
      });
      const ensureCanal = (d: string) => {
        if (!porRubro[d])
          porRubro[d] = {
            provs: [0, 1, 2].map((i) => ({ nombre: nombreGlobal[i] || '', iva: ivaGlobal[i] || 'sin' })),
            precios: {}
          };
        return porRubro[d] as { provs: unknown[]; precios: Record<string, unknown[]> };
      };
      Object.keys(cotViejas).forEach((cod) => {
        const d = divDe[cod] || 'Sin división';
        const canal = ensureCanal(d);
        const ps = (cotViejas[cod] && cotViejas[cod].p) || [];
        canal.precios[cod] = [0, 1, 2].map((i) => (ps[i] && ps[i].precio) || '');
      });
      next.cotizacionesPorRubro = porRubro;
    }
    return next;
  });
}
