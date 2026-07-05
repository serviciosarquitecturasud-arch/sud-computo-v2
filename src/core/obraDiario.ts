/**
 * Fase OBRA (H8a) — lógica pura del diario de jornales, caja de obra,
 * compras (saldo regresivo de materiales) y herramientas en obra.
 *
 * Modelada sobre las planillas reales del estudio:
 *   - Jornales por día ("2 of + 1 ay"; medio ayudante = 0.5), agrupados por
 *     semana lunes–domingo: el pago se cierra el viernes.
 *   - Fijos semanales por persona ("Jesús 50.000/sem") que se suman al total.
 *   - Adelantos a cuenta durante la semana, que se descuentan del neto.
 *   - Caja: balance = Σ ingresos − Σ egresos; gasto total = Σ egresos.
 *   - Compras: saldo = computado con desperdicio (materialesTotalObra) − pedidos
 *     acumulados, con estados por umbral y desvío de precio real vs presupuestado.
 */
import type { Motor } from './motor';
import { materialesTotalObra } from './suministro';
import type {
  AdelantoPersonal,
  CompraMaterial,
  DiarioObra,
  FijoSemanal,
  JornalDia,
  MovimientoCaja,
  Obra,
  PreciosObra
} from './types';
import { cmpCodigo } from './codigo';

/** Código de MO del catálogo: Oficial. */
export const COD_MO_OFICIAL = '02';
/** Código de MO del catálogo: Ayudante. */
export const COD_MO_AYUDANTE = '04';
/** La MO del catálogo está en $/hora; el usuario anota por DÍA (jornada de 8 hs). */
export const HORAS_JORNADA = 8;
/** Desvío de precio real vs presupuestado (%) a partir del cual se marca en rojo. */
export const UMBRAL_DESVIO_PRECIO = 10;
/** % consumido a partir del cual un material queda "por agotarse". */
export const UMBRAL_POR_AGOTARSE = 80;

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* ===== Semanas (lunes a domingo) ===== */

/** Suma n días a una fecha ISO yyyy-mm-dd (aritmética UTC, sin corrimiento de zona). */
export function sumarDias(iso: string, n: number): string {
  const [a, m, d] = (iso || '').split('-').map(Number);
  const t = new Date(Date.UTC(a || 1970, (m || 1) - 1, d || 1));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Lunes de la semana (lun–dom) que contiene la fecha ISO dada. */
export function lunesDeSemana(iso: string): string {
  const [a, m, d] = (iso || '').split('-').map(Number);
  const t = new Date(Date.UTC(a || 1970, (m || 1) - 1, d || 1));
  const offset = (t.getUTCDay() + 6) % 7; // lunes=0 … domingo=6
  return sumarDias(t.toISOString().slice(0, 10), -offset);
}

/** ¿La fecha ISO cae dentro de la semana que arranca en `lunes`? */
export function enSemana(fecha: string, lunes: string): boolean {
  return !!fecha && fecha >= lunes && fecha <= sumarDias(lunes, 6);
}

/* ===== Tarifas de jornal diario ===== */

export interface TarifasDiario {
  /** Jornal diario del oficial (ARS/día) */
  of: number;
  /** Jornal diario del ayudante (ARS/día) */
  ay: number;
}

/** Jornal diario derivado del catálogo/overrides de MO: valor hora × 8. */
export function tarifasDerivadas(obra: Obra | null | undefined, motor: Motor): TarifasDiario {
  return {
    of: motor.costoInsumoEnObra('MO', COD_MO_OFICIAL, obra) * HORAS_JORNADA,
    ay: motor.costoInsumoEnObra('MO', COD_MO_AYUDANTE, obra) * HORAS_JORNADA
  };
}

/** Tarifas efectivas: override persistido en obra.diario.tarifas (si es > 0) o derivadas. */
export function tarifasDiario(obra: Obra | null | undefined, motor: Motor): TarifasDiario {
  const der = tarifasDerivadas(obra, motor);
  const t = obra?.diario?.tarifas;
  return {
    of: t && num(t.of) > 0 ? num(t.of) : der.of,
    ay: t && num(t.ay) > 0 ? num(t.ay) : der.ay
  };
}

/* ===== Jornales, fijos y adelantos por semana ===== */

/** Costo de los jornales de un día: of × tarifaOf + ay × tarifaAy (soporta 0.5). */
export function costoJornalDia(j: Pick<JornalDia, 'of' | 'ay'>, tarifas: TarifasDiario): number {
  return num(j.of) * tarifas.of + num(j.ay) * tarifas.ay;
}

/** Jornales de la semana que arranca en `lunes`, ordenados por fecha. */
export function jornalesDeSemana(jornales: JornalDia[] | undefined, lunes: string): JornalDia[] {
  return (Array.isArray(jornales) ? jornales : [])
    .filter((j) => j && enSemana(j.fecha, lunes))
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

/** Adelantos entregados en la semana que arranca en `lunes`, por fecha. */
export function adelantosDeSemana(
  adelantos: AdelantoPersonal[] | undefined,
  lunes: string
): AdelantoPersonal[] {
  return (Array.isArray(adelantos) ? adelantos : [])
    .filter((a) => a && enSemana(a.fecha, lunes))
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

/** Total de fijos semanales (Σ montoSemanal). */
export function totalFijos(fijos: FijoSemanal[] | undefined): number {
  return (Array.isArray(fijos) ? fijos : []).reduce((s, f) => s + num(f?.montoSemanal), 0);
}

export interface ResumenSemana {
  /** Σ costo de jornales de la semana */
  jornales: number;
  /** Σ fijos semanales */
  fijos: number;
  /** Total de la semana (jornales + fijos): lo que se paga el viernes */
  total: number;
  /** Σ adelantos entregados en la semana */
  adelantos: number;
  /** Neto a pagar = total − adelantos */
  neto: number;
}

/** Cierre de la semana: TOTAL / − adelantos / NETO A PAGAR. */
export function resumenSemana(
  diario: DiarioObra | null | undefined,
  lunes: string,
  tarifas: TarifasDiario
): ResumenSemana {
  const jornales = jornalesDeSemana(diario?.jornales, lunes).reduce(
    (s, j) => s + costoJornalDia(j, tarifas),
    0
  );
  const fijos = totalFijos(diario?.fijos);
  const adelantos = adelantosDeSemana(diario?.adelantos, lunes).reduce(
    (s, a) => s + num(a.monto),
    0
  );
  const total = jornales + fijos;
  return { jornales, fijos, total, adelantos, neto: total - adelantos };
}

/* ===== Caja de obra ===== */

export interface BalanceCaja {
  ingresos: number;
  egresos: number;
  /** ingresos − egresos */
  balance: number;
}

/** Balance de la caja: Σ ingresos − Σ egresos. */
export function balanceCaja(caja: MovimientoCaja[] | undefined): BalanceCaja {
  let ingresos = 0;
  let egresos = 0;
  for (const m of Array.isArray(caja) ? caja : []) {
    if (!m || typeof m !== 'object') continue;
    if (m.tipo === 'ingreso') ingresos += num(m.monto);
    else egresos += num(m.monto);
  }
  return { ingresos, egresos, balance: ingresos - egresos };
}

/** GASTO TOTAL de la obra = Σ egresos de la caja. */
export function gastoTotalObra(caja: MovimientoCaja[] | undefined): number {
  return balanceCaja(caja).egresos;
}

export interface PendientesCaja {
  cantidad: number;
  monto: number;
}

/** Egresos todavía NO pagados (deuda con comercios/proveedores). */
export function pendientesDePago(caja: MovimientoCaja[] | undefined): PendientesCaja {
  let cantidad = 0;
  let monto = 0;
  for (const m of Array.isArray(caja) ? caja : []) {
    if (!m || m.tipo !== 'egreso' || m.pagado) continue;
    cantidad++;
    monto += num(m.monto);
  }
  return { cantidad, monto };
}

export interface ResumenComercio {
  nombre: string;
  /** Movimientos de caja (egresos) del comercio */
  movs: number;
  /** Σ egresos de caja del comercio */
  totalCaja: number;
  /** Pedidos de materiales al proveedor */
  pedidos: number;
  /** Σ compras con precio (cantidad × precioUnit) */
  totalCompras: number;
  total: number;
}

/**
 * Resumen por comercio/proveedor: junta egresos de caja (por `comercio`) y
 * compras de materiales (por `proveedor`). Responde "todas las facturas de Feros".
 * Ordenado por total descendente; clave insensible a mayúsculas.
 */
export function resumenPorComercio(
  caja: MovimientoCaja[] | undefined,
  compras: CompraMaterial[] | undefined
): ResumenComercio[] {
  const acc = new Map<string, ResumenComercio>();
  const entrada = (nombre: string): ResumenComercio => {
    const clave = nombre.trim().toLowerCase();
    let e = acc.get(clave);
    if (!e) {
      e = { nombre: nombre.trim(), movs: 0, totalCaja: 0, pedidos: 0, totalCompras: 0, total: 0 };
      acc.set(clave, e);
    }
    return e;
  };
  for (const m of Array.isArray(caja) ? caja : []) {
    if (!m || m.tipo !== 'egreso' || !(m.comercio ?? '').trim()) continue;
    const e = entrada(m.comercio as string);
    e.movs++;
    e.totalCaja += num(m.monto);
  }
  for (const c of Array.isArray(compras) ? compras : []) {
    if (!c || !(c.proveedor ?? '').trim()) continue;
    const e = entrada(c.proveedor as string);
    e.pedidos++;
    e.totalCompras += num(c.cantidad) * num(c.precioUnit);
  }
  const out = [...acc.values()];
  out.forEach((e) => {
    e.total = e.totalCaja + e.totalCompras;
  });
  return out.sort((a, b) => b.total - a.total);
}

/* ===== Compras: saldo regresivo de materiales ===== */

export type EstadoSaldo = 'ok' | 'por agotarse' | 'excedido';

/** Estado por umbral: 'excedido' > 100 % del computado; 'por agotarse' ≥ 80 %. */
export function estadoSaldo(computado: number, pedido: number): EstadoSaldo {
  if (computado <= 0) return pedido > 0 ? 'excedido' : 'ok';
  const eps = computado * 1e-9;
  if (pedido > computado + eps) return 'excedido';
  if (pedido >= computado * (UMBRAL_POR_AGOTARSE / 100) - eps) return 'por agotarse';
  return 'ok';
}

/** Desvío % del precio real vs el presupuestado (positivo = pagando de más). */
export function desvioPrecioPct(precioReal: number, precioPresupuestado: number): number {
  if (!(precioPresupuestado > 0) || !(precioReal > 0)) return 0;
  return ((precioReal - precioPresupuestado) / precioPresupuestado) * 100;
}

/**
 * Proveedor adjudicado a un material: primero el registro que escribe la
 * Comparativa al adjudicar (obra.proveedores.materiales[cod]); si falta,
 * se busca en obra.cotizacionesPorRubro un precio "en uso" (mismo criterio
 * ±0.005 y misma base IVA que el testigo de Comparativa).
 */
export function proveedorDeMaterial(obra: Obra | null | undefined, matCod: string): string {
  const provsObra = obra?.proveedores as { materiales?: Record<string, string> } | undefined;
  const registrado = provsObra?.materiales?.[matCod];
  if (typeof registrado === 'string' && registrado.trim()) return registrado.trim();

  const cpr = obra?.cotizacionesPorRubro as
    | Record<
        string,
        {
          provs?: { nombre?: string; iva?: string }[];
          precios?: Record<string, (number | string)[]>;
        }
      >
    | undefined;
  if (!cpr || typeof cpr !== 'object') return '';
  const prec: PreciosObra = obra?.precios ?? {};
  for (const canal of Object.values(cpr)) {
    const fila = canal?.precios?.[matCod];
    if (!Array.isArray(fila)) continue;
    for (let i = 0; i < 3; i++) {
      const u = num(fila[i]);
      if (u <= 0) continue;
      const prov = canal.provs?.[i];
      const enLista =
        prov?.iva === 'con'
          ? Number((prec.materialesConIVA ?? {})[matCod])
          : Number((prec.materiales ?? {})[matCod]);
      if (enLista && !isNaN(enLista) && Math.abs(enLista - u) < 0.005) {
        return (prov?.nombre ?? '').trim() || `Prov. ${i + 1}`;
      }
    }
  }
  return '';
}

export interface SaldoMaterial {
  matCod: string;
  matDesc: string;
  unidad: string;
  /** Cantidad computada CON desperdicio (materialesTotalObra) */
  computado: number;
  /** Σ cantidades pedidas */
  pedido: number;
  /** computado − pedido (puede ser negativo si se excedió) */
  saldo: number;
  /** % consumido del computado (0 si computado = 0) */
  pctConsumido: number;
  estado: EstadoSaldo;
  /** Precio unitario presupuestado (motor.costoInsumoEnObra, c/IVA) */
  precioPresupuestado: number;
  /** Precio real medio ponderado de los pedidos CON precio (0 si no hay) */
  precioRealMedio: number;
  /** Desvío % del precio real medio vs presupuestado */
  desvioPct: number;
  /** Costo real acumulado: Σ cant × (precioUnit ?? presupuestado) */
  costoReal: number;
  /** Costo presupuestado de lo pedido: pedido × precioPresupuestado */
  costoPresupuestado: number;
  /** Proveedor adjudicado (Comparativa) o '' */
  proveedor: string;
  compras: CompraMaterial[];
}

/**
 * Saldo regresivo por material: computado (con desperdicio) − pedidos acumulados.
 * Incluye materiales pedidos fuera del cómputo (computado 0 → 'excedido').
 */
export function saldosCompras(obra: Obra | null | undefined, motor: Motor): SaldoMaterial[] {
  const compras = Array.isArray(obra?.compras) ? (obra?.compras as CompraMaterial[]) : [];
  const porMat = new Map<string, CompraMaterial[]>();
  for (const c of compras) {
    if (!c || !c.matCod) continue;
    const lista = porMat.get(c.matCod);
    if (lista) lista.push(c);
    else porMat.set(c.matCod, [c]);
  }
  const armar = (
    matCod: string,
    matDesc: string,
    unidad: string,
    computado: number,
    precioPresupuestado: number
  ): SaldoMaterial => {
    const lista = [...(porMat.get(matCod) ?? [])].sort((a, b) =>
      (a.fecha || '').localeCompare(b.fecha || '')
    );
    const pedido = lista.reduce((s, c) => s + num(c.cantidad), 0);
    let cantConPrecio = 0;
    let costoConPrecio = 0;
    let costoReal = 0;
    for (const c of lista) {
      const cant = num(c.cantidad);
      if (num(c.precioUnit) > 0) {
        cantConPrecio += cant;
        costoConPrecio += cant * num(c.precioUnit);
        costoReal += cant * num(c.precioUnit);
      } else {
        costoReal += cant * precioPresupuestado;
      }
    }
    const precioRealMedio = cantConPrecio > 0 ? costoConPrecio / cantConPrecio : 0;
    return {
      matCod,
      matDesc,
      unidad,
      computado,
      pedido,
      saldo: computado - pedido,
      pctConsumido: computado > 0 ? (pedido / computado) * 100 : 0,
      estado: estadoSaldo(computado, pedido),
      precioPresupuestado,
      precioRealMedio,
      desvioPct: desvioPrecioPct(precioRealMedio, precioPresupuestado),
      costoReal,
      costoPresupuestado: pedido * precioPresupuestado,
      proveedor: proveedorDeMaterial(obra, matCod),
      compras: lista
    };
  };

  const out: SaldoMaterial[] = [];
  const enComputo = new Set<string>();
  for (const t of materialesTotalObra(obra, motor)) {
    enComputo.add(t.matCod);
    out.push(armar(t.matCod, t.matDesc, t.unidad, t.cantidadConDesperdicio, t.precioUnit));
  }
  for (const matCod of porMat.keys()) {
    if (enComputo.has(matCod)) continue;
    const mat = motor.matMap[matCod];
    out.push(
      armar(
        matCod,
        mat?.desc ?? matCod,
        mat?.unidad ?? '',
        0,
        motor.costoInsumoEnObra('M', matCod, obra)
      )
    );
  }
  return out.sort((a, b) => cmpCodigo(a.matCod, b.matCod));
}

/* ===== Puente Compras → Caja ===== */

/** Id determinístico del movimiento de caja vinculado a una compra (no duplica). */
export function idMovimientoCompra(compraId: string): string {
  return 'cmp-' + compraId;
}

/** Movimiento de caja (egreso) generado al cargar un pedido con precio. */
export function movimientoDeCompra(
  compra: CompraMaterial,
  matDesc: string,
  unidad: string
): MovimientoCaja {
  const mov: MovimientoCaja = {
    id: idMovimientoCompra(compra.id),
    fecha: compra.fecha,
    tipo: 'egreso',
    monto: num(compra.cantidad) * num(compra.precioUnit),
    descripcion: `Compra ${matDesc || compra.matCod} (${num(compra.cantidad)} ${unidad || 'un'})`,
    pagado: true,
    categoria: 'compras'
  };
  if ((compra.proveedor ?? '').trim()) mov.comercio = (compra.proveedor as string).trim();
  if (compra.facturaFileId) mov.facturaFileId = compra.facturaFileId;
  if (compra.facturaLink) mov.facturaLink = compra.facturaLink;
  return mov;
}

/* ===== Herramientas en obra ===== */

/** Cantidad de herramientas EN OBRA ahora (no devueltas). */
export function herramientasEnObra(
  herr: { cant: number; devuelta: boolean }[] | undefined
): number {
  return (Array.isArray(herr) ? herr : []).reduce(
    (s, h) => s + (h && !h.devuelta ? num(h.cant) : 0),
    0
  );
}
