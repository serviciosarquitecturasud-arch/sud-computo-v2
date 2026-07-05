/**
 * Plan de suministro — port 1:1 del legacy (buildSuministro, materialesTotalObra).
 * Modelo A: TODO el material de un rubro entra en la semana de inicio del rubro.
 */
import { cmpCodigo } from './codigo';
import type { Motor } from './motor';
import type { EntradaSuministro, MaterialTotalObra, Obra, PlanData } from './types';

export function buildSuministro(
  obra: Obra | null | undefined,
  planData: PlanData | null | undefined,
  motor: Motor
): EntradaSuministro[] {
  if (!planData || !Array.isArray(planData.base)) return [];
  const items = obra && Array.isArray(obra.items) ? obra.items : [];
  const out: EntradaSuministro[] = [];
  planData.base.forEach((rp) => {
    if (rp.inicio == null || !rp.duracion || rp.duracion <= 0) return; // rubro sin planificar
    const itemsRubro = items.filter((it) => String(it.cod || '').split('.')[0] === rp.rp);
    if (itemsRubro.length === 0) return;
    const matAcum: Record<string, { cant: number; origen: Set<string> }> = {};
    const globales: { cod: string; cant: number }[] = []; // items sin APU (Globales / precio manual)
    itemsRubro.forEach((item) => {
      if (!motor.apuTiene(item.cod)) {
        globales.push({ cod: item.cod, cant: item.cant || 0 });
        return;
      }
      const insumos = motor.bibMap[item.cod] || [];
      insumos.forEach((b) => {
        if (b.tipo !== 'M') return;
        const matCod = b.insumo;
        const cantTotal = (b.cant || 0) * (item.cant || 0);
        if (!matAcum[matCod]) matAcum[matCod] = { cant: 0, origen: new Set() };
        matAcum[matCod].cant += cantTotal;
        matAcum[matCod].origen.add(item.cod);
      });
    });
    Object.entries(matAcum).forEach(([matCod, info]) => {
      const mat = motor.matMap[matCod];
      if (!mat) return; // material no en catálogo
      const precio = motor.costoInsumoEnObra('M', matCod, obra);
      const desp = Number(mat.desp) || 0;
      const cantConDesp = info.cant * (1 + desp / 100);
      out.push({
        rp: rp.rp,
        rubroNombre: rp.nombre,
        semanaInicio: rp.inicio,
        matCod: matCod,
        matDesc: mat.desc,
        unidad: mat.unidad,
        cantidad: info.cant,
        desperdicioPct: desp,
        cantidadConDesperdicio: cantConDesp,
        precioUnit: precio,
        costoTotal: cantConDesp * precio,
        origenItems: Array.from(info.origen).sort(cmpCodigo)
      });
    });
    if (globales.length > 0) {
      // Una entrada por item Global para no perderlo en las vistas
      globales.forEach((g) => {
        out.push({
          rp: rp.rp,
          rubroNombre: rp.nombre,
          semanaInicio: rp.inicio,
          matCod: null,
          matDesc: '(ítem global sin desglose)',
          unidad: '',
          cantidad: g.cant,
          desperdicioPct: 0,
          cantidadConDesperdicio: g.cant,
          precioUnit: 0,
          costoTotal: 0,
          origenItems: [g.cod],
          esGlobal: true
        });
      });
    }
  });
  return out;
}

/** Total de materiales para TODA la obra, independiente del plan (para saldos). */
export function materialesTotalObra(obra: Obra | null | undefined, motor: Motor): MaterialTotalObra[] {
  const items = obra && Array.isArray(obra.items) ? obra.items : [];
  const acum: Record<string, { cant: number; origen: Set<string> }> = {};
  items.forEach((item) => {
    if (!motor.apuTiene(item.cod)) return;
    const insumos = motor.bibMap[item.cod] || [];
    insumos.forEach((b) => {
      if (b.tipo !== 'M') return;
      const matCod = b.insumo;
      const cantTotal = (b.cant || 0) * (item.cant || 0);
      if (!acum[matCod]) acum[matCod] = { cant: 0, origen: new Set() };
      acum[matCod].cant += cantTotal;
      acum[matCod].origen.add(item.cod);
    });
  });
  const out: MaterialTotalObra[] = [];
  Object.entries(acum).forEach(([matCod, info]) => {
    const mat = motor.matMap[matCod];
    if (!mat) return;
    const precio = motor.costoInsumoEnObra('M', matCod, obra);
    const desp = Number(mat.desp) || 0;
    const cantConDesp = info.cant * (1 + desp / 100);
    out.push({
      matCod,
      matDesc: mat.desc,
      unidad: mat.unidad,
      cantidad: info.cant,
      cantidadConDesperdicio: cantConDesp,
      desperdicioPct: desp,
      precioUnit: precio,
      costoTotal: cantConDesp * precio,
      origenItems: Array.from(info.origen).sort(cmpCodigo)
    });
  });
  return out;
}
