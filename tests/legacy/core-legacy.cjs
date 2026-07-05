// EXTRACCIÓN VERBATIM del index.html legacy (producción, R11+, respaldo 11/06/2026).
// NO EDITAR: es la referencia de los tests de paridad.
"use strict";
/* ============================ DATOS / MOTOR ============================ */

/**
 * Comparador de códigos jerárquicos por segmentos numéricos.
 * Funciona con códigos como "1.00", "3.01.01", "10.05", "001", "1001", "SC01".
 * - Parte por puntos / guiones / underscores
 * - Compara cada segmento como número si es numérico
 * - Si un segmento no es numérico, hace comparación alfabética (ej "SC01")
 * - Los códigos con menos segmentos van primero ("4.00" antes que "4.01")
 */
function cmpCodigo(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const sa = String(a).split(/[.\-_]/);
  const sb = String(b).split(/[.\-_]/);
  const max = Math.max(sa.length, sb.length);
  for (let i = 0; i < max; i++) {
    if (sa[i] === undefined) return -1; // a más corto → primero
    if (sb[i] === undefined) return 1;
    const na = Number(sa[i]);
    const nb = Number(sb[i]);
    const naOk = !isNaN(na) && sa[i] !== '';
    const nbOk = !isNaN(nb) && sb[i] !== '';
    if (naOk && nbOk) {
      if (na !== nb) return na - nb;
    } else if (naOk) {
      return -1; // numérico antes que alfanumérico
    } else if (nbOk) {
      return 1;
    } else {
      const cmp = (sa[i] || '').localeCompare(sb[i] || '', 'es', { numeric: true });
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

function expandSeed(s) {
  return {
    materiales: (s.M || []).map(a => ({
      cod: a[0],
      desc: a[1],
      unidad: a[2],
      precio: a[3] || 0,
      div: a[4] || '',
      desp: a[5] || 0,
      pres1: a[6] || '',
      fac1: a[7] || 0,
      pres2: a[8] || '',
      fac2: a[9] || 0
    })).sort((x, y) => cmpCodigo(x.cod, y.cod)),
    manoObra: (s.O || []).map(a => ({
      cod: a[0],
      desc: a[1],
      unidad: a[2],
      valor: a[3] || 0
    })).sort((x, y) => cmpCodigo(x.cod, y.cod)),
    herramientas: (s.H || []).map(a => ({
      cod: a[0],
      desc: a[1],
      grupo: a[2],
      tenencia: a[3],
      valor: a[4] || 0,
      vidautil: a[5] || 0,
      jornada: a[6] || 8,
      combust: a[7] || 0,
      reparac: a[8] || 0
    })).sort((x, y) => cmpCodigo(x.cod, y.cod)),
    rubros: (s.R || []).map(a => ({
      cod: a[0],
      rubro: a[1],
      subrubro: a[2],
      desc: a[3],
      unidad: a[4]
    })).sort((x, y) => cmpCodigo(x.cod, y.cod)),
    biblioteca: (s.B || []).map(a => ({
      apu: a[0],
      tipo: a[1],
      insumo: a[2],
      cant: a[3] || 0,
      nota: a[4]
    })).sort((x, y) => cmpCodigo(x.apu, y.apu) || (x.tipo || '').localeCompare(y.tipo || '') || cmpCodigo(x.insumo, y.insumo)),
    deletedApus: [],
    apusEditados: []
  };
}
const fmt = n => (Number(n) || 0).toLocaleString('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const money = n => '$ ' + fmt(n);
const fmtN = n => (Number(n) || 0).toLocaleString('es-AR', {
  maximumFractionDigits: 3
});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function costoHerramienta(h) {
  if (!h) return 0;
  if (h.tenencia === 'Propia') return (h.vidautil > 0 ? h.valor / h.vidautil : 0) + (h.combust || 0) + (h.reparac || 0);
  if (h.tenencia === 'Alquilada') return h.jornada > 0 ? h.valor / h.jornada : 0;
  return 0;
}
function buildMotor(cat) {
  const matMap = {},
    moMap = {},
    herrMap = {},
    rubMap = {},
    bibMap = {};
  (cat.materiales || []).forEach(m => {
    matMap[m.cod] = m;
  });
  (cat.manoObra || []).forEach(o => {
    moMap[o.cod] = o;
  });
  (cat.herramientas || []).forEach(h => {
    herrMap[h.cod] = h;
  });
  (cat.rubros || []).forEach(r => {
    rubMap[r.cod] = r;
  });
  (cat.biblioteca || []).forEach(b => {
    (bibMap[b.apu] = bibMap[b.apu] || []).push(b);
  });
  // Hito 7: IVA sale del coeficiente y entra al precio del material.
  // Materiales: precio con IVA = precio_catálogo × 1.21 (si no hay override por obra).
  // MO y herramientas: SIN tratamiento IVA (la MO de subcontrato consumidor final
  // ya tiene el IVA implícito; las herramientas son amortización del contratista).
  const IVA_RATE_MOTOR = 0.21;
  const costoInsumo = (tipo, cod) => {
    if (tipo === 'M') return matMap[cod] ? (matMap[cod].precio || 0) * (1 + IVA_RATE_MOTOR) : 0;
    if (tipo === 'MO') return moMap[cod] ? moMap[cod].valor : 0;
    if (tipo === 'E') return costoHerramienta(herrMap[cod]);
    return 0;
  };
  const costoAPU = c => (bibMap[c] || []).reduce((s, b) => s + b.cant * costoInsumo(b.tipo, b.insumo), 0);

  // ====== OVERRIDE POR OBRA ======
  // Si la obra tiene un precio cargado en obra.precios[tipo][cod] usa ese;
  // si no, fallback al precio global del catálogo.
  const tieneOverride = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  const costoInsumoEnObra = (tipo, cod, obra) => {
    const p = (obra && obra.precios) || {};
    if (tipo === 'M') {
      // Hito 8 — Camino γ del INFORME R11:
      // El precio cargado en Lista de materiales es el precio de la presentación 1
      // (balde, palet, lata). El precio teórico β por unidad física = precio_pres1 / fac1.
      // Si fac1 = 0 (sin presentación cargada), el precio se toma por unidad física directa.
      //
      // (1) Resolver precio con IVA de la presentación 1
      let precioPres1ConIVA;
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
      return moMap[cod] ? (moMap[cod].valor || 0) : 0;
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
  const costoAPUEnObra = (c, obra) => (bibMap[c] || []).reduce((s, b) => s + b.cant * costoInsumoEnObra(b.tipo, b.insumo, obra), 0);

  const insumoExiste = (tipo, cod) => tipo === 'M' ? !!matMap[cod] : tipo === 'MO' ? !!moMap[cod] : tipo === 'E' ? !!herrMap[cod] : false;
  const apuTiene = c => !!bibMap[c];
  const apuHuerfanos = c => (bibMap[c] || []).filter(b => !insumoExiste(b.tipo, b.insumo));
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
const calcCoef = c => {
  // Hito 7 R11: IVA salió del coeficiente — ahora va dentro del precio del material.
  // El coeficiente queda como: (1 + ggd+ggi+imp+ben) × (1 + iibb).
  // El campo c.iva se mantiene en el modelo por compatibilidad legacy v2 pero se ignora.
  const gg = (c.ggd || 0) + (c.ggi || 0) + (c.imp || 0) + (c.ben || 0);
  const imp = (c.iib || 0);
  return (1 + gg / 100) * (1 + imp / 100);
};
const coefDefault = () => ({
  ggd: 0,
  ggi: 0,
  imp: 0,
  ben: 0,
  iva: 0,
  iib: 0
});

/* Motor de planificacion: plan encadenado por precedencias + curva + CPM.
   Replica la logica del Excel: se planifica al nivel de rubro principal (x.00). */
function buildPlan(obra, motor) {
  if (!obra || typeof obra !== 'object') {
    return { base: [], plazo: 0, hsSem: 45 };
  }
  const items = obra.items || [];
  const rpDe = c => String(c).split('.')[0];
  const plan = obra.plan || {};
  const planR = plan.rubros || {};
  const hsSem = plan.hsSem || 45;
  const coef = calcCoef(obra.coef || coefDefault());
  const usados = [...new Set(items.map(i => rpDe(i.cod)))].sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  const base = usados.map(rp => {
    const its = items.filter(i => rpDe(i.cod) === rp);
    let cd = 0,
      hsOf = 0,
      hsAy = 0,
      hsEq = 0;
    its.forEach(it => {
      const cu = motor.apuTiene(it.cod) ? motor.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;
      cd += cu * (it.cant || 0);
      (motor.bibMap[it.cod] || []).forEach(b => {
        const hh = b.cant * (it.cant || 0);
        if (b.tipo === 'MO') {
          if (b.insumo === '01' || b.insumo === '02') hsOf += hh;else if (b.insumo === '03' || b.insumo === '04') hsAy += hh;
        } else if (b.tipo === 'E') hsEq += hh;
      });
    });
    const cfg = planR[rp] || {};
    const nombre = (motor.rubMap[rp + '.00'] || {}).desc || (motor.rubMap[its[0].cod] || {}).rubro || 'Rubro ' + rp;
    // Cálculo bidireccional: modo se infiere de los datos.
    // Si hay cuadrilla cargada (ofs > 0 O ayud > 0) → modo='cuadrilla' y se deriva duración.
    // Si no → modo='duracion' (lo actual, retrocompatible).
    const ofsCuad = Number(cfg.ofsCuad) || 0;
    const ayudCuad = Number(cfg.ayudCuad) || 0;
    const modo = (ofsCuad > 0 || ayudCuad > 0) ? 'cuadrilla' : 'duracion';
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
      duracionCalc, // referencia (sin redondeo) para UI
      modo,
      ofsCuad,
      ayudCuad,
      precede: cfg.precede || '',
      inicioManual: Number(cfg.inicioManual) || 0
    };
  });
  const byRp = {};
  base.forEach(b => {
    byRp[b.rp] = b;
  });
  const memoI = {},
    memoF = {};
  const res = (rp, st) => {
    if (rp in memoI) return;
    if (st.includes(rp)) {
      memoI[rp] = null;
      memoF[rp] = null;
      return;
    }
    const b = byRp[rp];
    if (!b) return;
    let ini;
    if (b.precede && byRp[b.precede]) {
      res(b.precede, [...st, rp]);
      ini = memoF[b.precede] != null ? memoF[b.precede] + 1 : null;
    } else {
      ini = b.inicioManual > 0 ? b.inicioManual : null;
    }
    memoI[rp] = ini;
    memoF[rp] = ini != null && b.duracion > 0 ? ini + b.duracion - 1 : null;
  };
  base.forEach(b => res(b.rp, []));
  base.forEach(b => {
    b.inicio = memoI[b.rp];
    b.fin = memoF[b.rp];
    b.oficSem = b.duracion > 0 ? b.hsOf / b.duracion / hsSem : 0;
    b.ayudSem = b.duracion > 0 ? b.hsAy / b.duracion / hsSem : 0;
    b.estado = b.duracion <= 0 ? 'sin duración' : b.inicio == null ? 'sin planificar' : 'ok';
  });
  const plazo = base.reduce((m, b) => Math.max(m, b.fin || 0), 0);

  // Camino critico (backward pass, una precedencia por rubro)
  const succ = {};
  base.forEach(b => {
    if (b.precede) (succ[b.precede] = succ[b.precede] || []).push(b.rp);
  });
  const memoFT = {},
    memoIT = {};
  const back = (rp, st) => {
    if (rp in memoFT) return;
    if (st.includes(rp)) {
      memoFT[rp] = null;
      memoIT[rp] = null;
      return;
    }
    const b = byRp[rp];
    if (!b) return;
    const ss = succ[rp] || [];
    let ft;
    if (ss.length === 0) ft = plazo;else {
      ft = Infinity;
      ss.forEach(s => {
        back(s, [...st, rp]);
        if (memoIT[s] != null) ft = Math.min(ft, memoIT[s] - 1);
      });
      if (ft === Infinity) ft = plazo;
    }
    memoFT[rp] = ft;
    memoIT[rp] = b.duracion > 0 ? ft - b.duracion + 1 : ft;
  };
  base.forEach(b => back(b.rp, []));
  base.forEach(b => {
    b.finTardio = memoFT[b.rp];
    b.inicioTardio = memoIT[b.rp];
    b.holgura = b.fin != null && memoFT[b.rp] != null ? memoFT[b.rp] - b.fin : null;
    b.critico = b.holgura === 0;
  });

  // Curva de inversion mensual (4 semanas por mes)
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
      base.forEach(b => {
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
      pctF: totalF > 0 ? accF / totalF * 100 : 0,
      pctH: totalH > 0 ? accH / totalH * 100 : 0
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

/* ============================ PLAN DE SUMINISTRO ============================ */
/* buildSuministro: cruza el Plan de Trabajo con la biblioteca de APUs para
 * derivar qué materiales necesita cada rubro principal y en qué semana entran.
 * Modelo A: TODO el material de un rubro entra en la semana de inicio del rubro.
 * Devuelve un array plano de entradas {rp, matCod, semanaInicio, cant, costo, ...}
 * que las vistas agruparán según necesidad (por rubro, por semana, totales). */
function buildSuministro(obra, planData, motor) {
  if (!planData || !Array.isArray(planData.base)) return [];
  const items = obra && Array.isArray(obra.items) ? obra.items : [];
  const out = [];
  planData.base.forEach(rp => {
    if (rp.inicio == null || !rp.duracion || rp.duracion <= 0) return; // rubro sin planificar (sin inicio o sin duración)
    const itemsRubro = items.filter(it => String(it.cod || '').split('.')[0] === rp.rp);
    if (itemsRubro.length === 0) return;
    const matAcum = {}; // matCod -> { cant, origen: Set<itemCod> }
    const globales = []; // items sin APU (Globales / precio manual)
    itemsRubro.forEach(item => {
      if (!motor.apuTiene(item.cod)) {
        globales.push({ cod: item.cod, cant: item.cant || 0 });
        return;
      }
      const insumos = motor.bibMap[item.cod] || [];
      insumos.forEach(b => {
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
      globales.forEach(g => {
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

/* materialesTotalObra: total de materiales necesarios para TODA la obra,
 * independientemente del plan. Se usa para calcular saldo (total vs asignado). */
function materialesTotalObra(obra, motor) {
  const items = obra && Array.isArray(obra.items) ? obra.items : [];
  const acum = {}; // matCod -> { cant, origen: Set }
  items.forEach(item => {
    if (!motor.apuTiene(item.cod)) return;
    const insumos = motor.bibMap[item.cod] || [];
    insumos.forEach(b => {
      if (b.tipo !== 'M') return;
      const matCod = b.insumo;
      const cantTotal = (b.cant || 0) * (item.cant || 0);
      if (!acum[matCod]) acum[matCod] = { cant: 0, origen: new Set() };
      acum[matCod].cant += cantTotal;
      acum[matCod].origen.add(item.cod);
    });
  });
  const out = [];
  Object.entries(acum).forEach(([matCod, info]) => {
    const mat = motor.matMap[matCod];
    if (!mat) return;
    const precio = motor.costoInsumoEnObra('M', matCod, obra);
    const desp = Number(mat.desp) || 0;
    const cantConDesp = info.cant * (1 + desp / 100);
    out.push({
      matCod, matDesc: mat.desc, unidad: mat.unidad,
      cantidad: info.cant, cantidadConDesperdicio: cantConDesp,
      desperdicioPct: desp,
      precioUnit: precio, costoTotal: cantConDesp * precio,
      origenItems: Array.from(info.origen).sort(cmpCodigo)
    });
  });
  return out;
}


module.exports={cmpCodigo,expandSeed,fmt,money,fmtN,costoHerramienta,buildMotor,calcCoef,coefDefault,buildPlan,buildSuministro,materialesTotalObra};
