/**
 * Motor de planificación — port 1:1 del legacy (buildPlan).
 * Plan encadenado por precedencias + curva de inversión + CPM.
 * Replica la lógica del Excel: se planifica al nivel de rubro principal (x.00).
 */
import { calcCoef, coefDefault } from './coef';
import type { Motor } from './motor';
import type { Obra, PlanData, PlanRubro } from './types';

export function buildPlan(obra: Obra | null | undefined, motor: Motor): PlanData {
  if (!obra || typeof obra !== 'object') {
    return { base: [], plazo: 0, hsSem: 45 };
  }
  const items = obra.items || [];
  const rpDe = (c: unknown) => String(c).split('.')[0];
  const plan = obra.plan || {};
  const planR = plan.rubros || {};
  const hsSem = plan.hsSem || 45;
  const coef = calcCoef(obra.coef || coefDefault());
  const usados = [...new Set(items.map((i) => rpDe(i.cod)))].sort(
    (a, b) => (Number(a) || 0) - (Number(b) || 0)
  );
  const base: PlanRubro[] = usados.map((rp) => {
    const its = items.filter((i) => rpDe(i.cod) === rp);
    let cd = 0,
      hsOf = 0,
      hsAy = 0,
      hsEq = 0;
    its.forEach((it) => {
      const cu = motor.apuTiene(it.cod)
        ? motor.costoAPUEnObra(it.cod, obra)
        : it.precioManual || 0;
      cd += cu * (it.cant || 0);
      (motor.bibMap[it.cod] || []).forEach((b) => {
        const hh = b.cant * (it.cant || 0);
        if (b.tipo === 'MO') {
          if (b.insumo === '01' || b.insumo === '02') hsOf += hh;
          else if (b.insumo === '03' || b.insumo === '04') hsAy += hh;
        } else if (b.tipo === 'E') hsEq += hh;
      });
    });
    const cfg = planR[rp] || {};
    const nombre =
      (motor.rubMap[rp + '.00'] || ({} as { desc?: string })).desc ||
      (motor.rubMap[its[0].cod] || ({} as { rubro?: string })).rubro ||
      'Rubro ' + rp;
    // Cálculo bidireccional: modo se infiere de los datos.
    // Si hay cuadrilla cargada (ofs > 0 O ayud > 0) → modo='cuadrilla' y se deriva duración.
    // Si no → modo='duracion' (retrocompatible).
    const ofsCuad = Number(cfg.ofsCuad) || 0;
    const ayudCuad = Number(cfg.ayudCuad) || 0;
    const modo: 'cuadrilla' | 'duracion' = ofsCuad > 0 || ayudCuad > 0 ? 'cuadrilla' : 'duracion';
    let duracion = Number(cfg.duracion) || 0;
    let duracionCalc = 0; // siempre se calcula para mostrar como referencia en UI
    if (ofsCuad > 0 || ayudCuad > 0) {
      const durOf = ofsCuad > 0 && hsOf > 0 ? hsOf / (ofsCuad * hsSem) : 0;
      const durAy = ayudCuad > 0 && hsAy > 0 ? hsAy / (ayudCuad * hsSem) : 0;
      duracionCalc = Math.max(durOf, durAy);
      if (modo === 'cuadrilla') {
        duracion = duracionCalc > 0 ? Math.ceil(duracionCalc) : 0;
      }
    }
    return {
      rp,
      nombre,
      monto: cd * coef,
      costoDir: cd,
      hsOf,
      hsAy,
      hsEq,
      duracion,
      duracionCalc,
      modo,
      ofsCuad,
      ayudCuad,
      precede: (cfg.precede as string) || '',
      inicioManual: Number(cfg.inicioManual) || 0
    };
  });
  const byRp: Record<string, PlanRubro> = {};
  base.forEach((b) => {
    byRp[b.rp] = b;
  });
  const memoI: Record<string, number | null> = {};
  const memoF: Record<string, number | null> = {};
  const res = (rp: string, st: string[]): void => {
    if (rp in memoI) return;
    if (st.includes(rp)) {
      memoI[rp] = null;
      memoF[rp] = null;
      return;
    }
    const b = byRp[rp];
    if (!b) return;
    let ini: number | null;
    if (b.precede && byRp[b.precede]) {
      res(b.precede, [...st, rp]);
      ini = memoF[b.precede] != null ? (memoF[b.precede] as number) + 1 : null;
    } else {
      ini = b.inicioManual > 0 ? b.inicioManual : null;
    }
    memoI[rp] = ini;
    memoF[rp] = ini != null && b.duracion > 0 ? ini + b.duracion - 1 : null;
  };
  base.forEach((b) => res(b.rp, []));
  base.forEach((b) => {
    b.inicio = memoI[b.rp];
    b.fin = memoF[b.rp];
    b.oficSem = b.duracion > 0 ? b.hsOf / b.duracion / hsSem : 0;
    b.ayudSem = b.duracion > 0 ? b.hsAy / b.duracion / hsSem : 0;
    b.estado = b.duracion <= 0 ? 'sin duración' : b.inicio == null ? 'sin planificar' : 'ok';
  });
  const plazo = base.reduce((m, b) => Math.max(m, b.fin || 0), 0);

  // Camino crítico (backward pass, una precedencia por rubro)
  const succ: Record<string, string[]> = {};
  base.forEach((b) => {
    if (b.precede) (succ[b.precede] = succ[b.precede] || []).push(b.rp);
  });
  const memoFT: Record<string, number | null> = {};
  const memoIT: Record<string, number | null> = {};
  const back = (rp: string, st: string[]): void => {
    if (rp in memoFT) return;
    if (st.includes(rp)) {
      memoFT[rp] = null;
      memoIT[rp] = null;
      return;
    }
    const b = byRp[rp];
    if (!b) return;
    const ss = succ[rp] || [];
    let ft: number;
    if (ss.length === 0) ft = plazo;
    else {
      ft = Infinity;
      ss.forEach((s) => {
        back(s, [...st, rp]);
        if (memoIT[s] != null) ft = Math.min(ft, (memoIT[s] as number) - 1);
      });
      if (ft === Infinity) ft = plazo;
    }
    memoFT[rp] = ft;
    memoIT[rp] = b.duracion > 0 ? ft - b.duracion + 1 : ft;
  };
  base.forEach((b) => back(b.rp, []));
  base.forEach((b) => {
    b.finTardio = memoFT[b.rp];
    b.inicioTardio = memoIT[b.rp];
    b.holgura = b.fin != null && memoFT[b.rp] != null ? (memoFT[b.rp] as number) - (b.fin as number) : null;
    b.critico = b.holgura === 0;
  });

  // Curva de inversión mensual (4 semanas por mes)
  const nMeses = Math.max(1, Math.ceil(plazo / 4));
  const totalF = base.reduce((s, b) => s + (b.monto || 0), 0);
  const totalH = base.reduce((s, b) => s + b.hsOf + b.hsAy, 0);
  const meses = [];
  let accF = 0,
    accH = 0;
  for (let m = 1; m <= nMeses; m++) {
    let invMes = 0,
      hhMes = 0;
    for (let w = (m - 1) * 4 + 1; w <= m * 4; w++) {
      base.forEach((b) => {
        if (b.inicio != null && b.fin != null && b.duracion > 0 && w >= b.inicio && w <= b.fin) {
          invMes += b.monto / b.duracion;
          hhMes += (b.hsOf + b.hsAy) / b.duracion;
        }
      });
    }
    accF += invMes;
    accH += hhMes;
    meses.push({
      mes: m,
      invMes,
      invAcum: accF,
      hhMes,
      hhAcum: accH,
      pctF: totalF > 0 ? (accF / totalF) * 100 : 0,
      pctH: totalH > 0 ? (accH / totalH) * 100 : 0
    });
  }
  return {
    base,
    plazo,
    nMeses,
    meses,
    totalF,
    totalH,
    hsSem
  };
}
