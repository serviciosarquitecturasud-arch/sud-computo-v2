/**
 * Motor de costos — port 1:1 del legacy (buildMotor).
 *
 * R11 Hito 7: el IVA salió del coeficiente y entró al precio del material.
 *   - Materiales: precio con IVA = precio_catálogo × 1.21 (si no hay override por obra).
 *   - MO y herramientas: SIN tratamiento IVA (la MO de subcontrato consumidor final
 *     ya tiene el IVA implícito; las herramientas son amortización del contratista).
 * R11 Hito 8 (Camino γ): el precio cargado por obra es el de la presentación 1;
 *   el precio teórico β por unidad física = precio_pres1 / fac1.
 */
import type {
  Catalogo,
  FilaBiblioteca,
  Herramienta,
  ManoObra,
  Material,
  Obra,
  Rubro
} from './types';

export const IVA_RATE_MOTOR = 0.21;

export function costoHerramienta(h: Herramienta | undefined | null): number {
  if (!h) return 0;
  if (h.tenencia === 'Propia')
    return (h.vidautil > 0 ? h.valor / h.vidautil : 0) + (h.combust || 0) + (h.reparac || 0);
  if (h.tenencia === 'Alquilada') return h.jornada > 0 ? h.valor / h.jornada : 0;
  return 0;
}

export interface Motor {
  matMap: Record<string, Material>;
  moMap: Record<string, ManoObra>;
  herrMap: Record<string, Herramienta>;
  rubMap: Record<string, Rubro>;
  bibMap: Record<string, FilaBiblioteca[]>;
  costoInsumo: (tipo: string, cod: string) => number;
  costoAPU: (cod: string) => number;
  costoInsumoEnObra: (tipo: string, cod: string, obra: Obra | null | undefined) => number;
  costoAPUEnObra: (cod: string, obra: Obra | null | undefined) => number;
  insumoExiste: (tipo: string, cod: string) => boolean;
  apuTiene: (cod: string) => boolean;
  apuHuerfanos: (cod: string) => FilaBiblioteca[];
}

export function buildMotor(cat: Catalogo): Motor {
  const matMap: Record<string, Material> = {};
  const moMap: Record<string, ManoObra> = {};
  const herrMap: Record<string, Herramienta> = {};
  const rubMap: Record<string, Rubro> = {};
  const bibMap: Record<string, FilaBiblioteca[]> = {};
  (cat.materiales || []).forEach((m) => {
    matMap[m.cod] = m;
  });
  (cat.manoObra || []).forEach((o) => {
    moMap[o.cod] = o;
  });
  (cat.herramientas || []).forEach((h) => {
    herrMap[h.cod] = h;
  });
  (cat.rubros || []).forEach((r) => {
    rubMap[r.cod] = r;
  });
  (cat.biblioteca || []).forEach((b) => {
    (bibMap[b.apu] = bibMap[b.apu] || []).push(b);
  });

  const costoInsumo = (tipo: string, cod: string): number => {
    if (tipo === 'M') return matMap[cod] ? (matMap[cod].precio || 0) * (1 + IVA_RATE_MOTOR) : 0;
    if (tipo === 'MO') return moMap[cod] ? moMap[cod].valor : 0;
    if (tipo === 'E') return costoHerramienta(herrMap[cod]);
    return 0;
  };
  const costoAPU = (c: string): number =>
    (bibMap[c] || []).reduce((s, b) => s + b.cant * costoInsumo(b.tipo, b.insumo), 0);

  // ====== OVERRIDE POR OBRA ======
  // Si la obra tiene un precio cargado en obra.precios[tipo][cod] usa ese;
  // si no, fallback al precio global del catálogo.
  const tieneOverride = (v: unknown): boolean =>
    v !== '' && v !== null && v !== undefined && !isNaN(Number(v));

  const costoInsumoEnObra = (tipo: string, cod: string, obra: Obra | null | undefined): number => {
    const p = (obra && obra.precios) || {};
    if (tipo === 'M') {
      // (1) Resolver precio con IVA de la presentación 1
      let precioPres1ConIVA: number;
      const pmConIVA = p.materialesConIVA || {};
      if (cod in pmConIVA && tieneOverride(pmConIVA[cod])) {
        precioPres1ConIVA = Number(pmConIVA[cod]) || 0;
      } else {
        const pm = p.materiales || {};
        if (cod in pm && tieneOverride(pm[cod])) {
          precioPres1ConIVA = (Number(pm[cod]) || 0) * (1 + IVA_RATE_MOTOR);
        } else {
          precioPres1ConIVA = matMap[cod] ? (matMap[cod].precio || 0) * (1 + IVA_RATE_MOTOR) : 0;
        }
      }
      // (2) Resolver fac1 con override de obra
      let fac1 = 0;
      const oc = (obra && obra.materialesConfig && obra.materialesConfig[cod]) || {};
      if (tieneOverride(oc.fac1)) {
        fac1 = Number(oc.fac1) || 0;
      } else if (matMap[cod] && tieneOverride(matMap[cod].fac1)) {
        fac1 = Number(matMap[cod].fac1) || 0;
      }
      // (3) Precio teórico β
      return fac1 > 0 ? precioPres1ConIVA / fac1 : precioPres1ConIVA;
    }
    if (tipo === 'MO') {
      const pmo = p.manoObra || {};
      if (cod in pmo && tieneOverride(pmo[cod])) return Number(pmo[cod]) || 0;
      return moMap[cod] ? moMap[cod].valor || 0 : 0;
    }
    if (tipo === 'E') {
      const ph = p.herramientas || {};
      const h = herrMap[cod];
      if (!h) return 0;
      if (cod in ph && tieneOverride(ph[cod])) {
        return costoHerramienta({ ...h, valor: Number(ph[cod]) || 0 });
      }
      return costoHerramienta(h);
    }
    return 0;
  };
  const costoAPUEnObra = (c: string, obra: Obra | null | undefined): number =>
    (bibMap[c] || []).reduce((s, b) => s + b.cant * costoInsumoEnObra(b.tipo, b.insumo, obra), 0);

  const insumoExiste = (tipo: string, cod: string): boolean =>
    tipo === 'M' ? !!matMap[cod] : tipo === 'MO' ? !!moMap[cod] : tipo === 'E' ? !!herrMap[cod] : false;
  const apuTiene = (c: string): boolean => !!bibMap[c];
  const apuHuerfanos = (c: string): FilaBiblioteca[] =>
    (bibMap[c] || []).filter((b) => !insumoExiste(b.tipo, b.insumo));

  return {
    matMap,
    moMap,
    herrMap,
    rubMap,
    bibMap,
    costoInsumo,
    costoAPU,
    costoInsumoEnObra,
    costoAPUEnObra,
    insumoExiste,
    apuTiene,
    apuHuerfanos
  };
}
