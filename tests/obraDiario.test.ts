/**
 * Tests de la fase OBRA (H8a) — lógica pura de src/core/obraDiario.ts:
 * semanas lunes–domingo, tarifas de jornal diario (catálogo × 8 y override),
 * costo del día con medios jornales, cierre semanal con adelantos, balance
 * de caja, saldo regresivo de compras (caso Feros), estados por umbral,
 * desvío de precio y resumen por comercio/proveedor.
 */
import { describe, expect, it } from 'vitest';
import { buildMotor } from '../src/core/motor';
import {
  COD_MO_AYUDANTE,
  COD_MO_OFICIAL,
  adelantosDeSemana,
  balanceCaja,
  costoJornalDia,
  desvioPrecioPct,
  enSemana,
  estadoSaldo,
  gastoTotalObra,
  herramientasEnObra,
  idMovimientoCompra,
  jornalesDeSemana,
  lunesDeSemana,
  movimientoDeCompra,
  pendientesDePago,
  proveedorDeMaterial,
  resumenPorComercio,
  resumenSemana,
  saldosCompras,
  sumarDias,
  tarifasDerivadas,
  tarifasDiario
} from '../src/core/obraDiario';
import type {
  Catalogo,
  CompraMaterial,
  DiarioObra,
  MovimientoCaja,
  Obra
} from '../src/core/types';

/* ===== Fixture: catálogo mínimo con MO real del estudio y un material ===== */

const cat: Catalogo = {
  materiales: [
    // precio catálogo SIN IVA 1000 → con IVA 1210; fac1=0 → precio por unidad física
    { cod: 'M1', desc: 'Hierro del 8', unidad: 'kg', precio: 1000, div: 'Corralón', desp: 0, pres1: '', fac1: 0, pres2: '', fac2: 0 }
  ],
  manoObra: [
    // valores HORA: el jornal diario del usuario es valor_hora × 8
    { cod: COD_MO_OFICIAL, desc: 'Oficial', unidad: 'h', valor: 10000 },
    { cod: COD_MO_AYUDANTE, desc: 'Ayudante', unidad: 'h', valor: 8125 }
  ],
  herramientas: [],
  rubros: [],
  biblioteca: [{ apu: 'AP1', tipo: 'M', insumo: 'M1', cant: 5, nota: '' }],
  deletedApus: [],
  apusEditados: []
};
const motor = buildMotor(cat);
// Obra con 100 un del APU → 500 kg de M1 computados (desp 0)
const obraBase: Obra = { id: 'o1', items: [{ cod: 'AP1', cant: 100 }] };

describe('semanas ISO (lunes a domingo)', () => {
  it('lunesDeSemana devuelve el lunes para cualquier día de la semana', () => {
    expect(lunesDeSemana('2026-06-22')).toBe('2026-06-22'); // lunes
    expect(lunesDeSemana('2026-06-23')).toBe('2026-06-22'); // martes
    expect(lunesDeSemana('2026-06-28')).toBe('2026-06-22'); // domingo
    expect(lunesDeSemana('2026-06-29')).toBe('2026-06-29'); // lunes siguiente
  });

  it('sumarDias cruza meses y años sin corrimientos de zona', () => {
    expect(sumarDias('2026-06-30', 1)).toBe('2026-07-01');
    expect(sumarDias('2026-12-29', 5)).toBe('2027-01-03');
    expect(sumarDias('2026-07-05', -7)).toBe('2026-06-28');
  });

  it('enSemana y jornalesDeSemana separan las semanas en el borde dom/lun', () => {
    expect(enSemana('2026-06-28', '2026-06-22')).toBe(true);
    expect(enSemana('2026-06-29', '2026-06-22')).toBe(false);
    const jornales = [
      { id: 'a', fecha: '2026-06-26', of: 2, ay: 1 },
      { id: 'b', fecha: '2026-06-29', of: 1, ay: 0 },
      { id: 'c', fecha: '2026-06-23', of: 1, ay: 1 }
    ];
    const sem = jornalesDeSemana(jornales, '2026-06-22');
    expect(sem.map((j) => j.id)).toEqual(['c', 'a']); // ordenados por fecha, sin el lunes 29
  });
});

describe('tarifas de jornal diario', () => {
  it('deriva el jornal DIARIO del catálogo: valor hora × 8 (of $80.000, ay $65.000)', () => {
    const t = tarifasDerivadas(obraBase, motor);
    expect(t.of).toBe(80000);
    expect(t.ay).toBe(65000);
    expect(tarifasDiario(obraBase, motor)).toEqual(t); // sin override usa las derivadas
  });

  it('el override por obra (obra.diario.tarifas) manda sobre el catálogo', () => {
    const obra: Obra = {
      ...obraBase,
      diario: { tarifas: { of: 90000, ay: 70000 }, jornales: [], fijos: [], adelantos: [] }
    };
    expect(tarifasDiario(obra, motor)).toEqual({ of: 90000, ay: 70000 });
    // tarifa inválida (0) → cae a la derivada de ese rol
    const obra2: Obra = {
      ...obraBase,
      diario: { tarifas: { of: 90000, ay: 0 }, jornales: [], fijos: [], adelantos: [] }
    };
    expect(tarifasDiario(obra2, motor)).toEqual({ of: 90000, ay: 65000 });
  });

  it('costoJornalDia soporta medio ayudante (0.5): 2 of + 1.5 ay', () => {
    const t = { of: 80000, ay: 65000 };
    expect(costoJornalDia({ of: 2, ay: 1 }, t)).toBe(225000);
    expect(costoJornalDia({ of: 2, ay: 1.5 }, t)).toBe(257500);
    expect(costoJornalDia({ of: 0, ay: 0.5 }, t)).toBe(32500);
  });
});

describe('cierre semanal: total, fijos y neto con adelantos', () => {
  const diario: DiarioObra = {
    tarifas: { of: 80000, ay: 65000 },
    jornales: [
      { id: 'j1', fecha: '2026-06-22', of: 2, ay: 1 }, // 225.000
      { id: 'j2', fecha: '2026-06-23', of: 2, ay: 1 }, // 225.000
      { id: 'j3', fecha: '2026-06-26', of: 1, ay: 0.5 }, // 112.500
      { id: 'j4', fecha: '2026-06-30', of: 3, ay: 3 } // semana siguiente: NO cuenta
    ],
    fijos: [
      { id: 'f1', persona: 'Jesús', montoSemanal: 50000 },
      { id: 'f2', persona: 'Rama', montoSemanal: 90000 }
    ],
    adelantos: [
      { id: 'a1', fecha: '2026-06-24', persona: 'Jesús', monto: 100000 },
      { id: 'a2', fecha: '2026-06-26', persona: 'Rama', monto: 30000 },
      { id: 'a3', fecha: '2026-07-01', persona: 'Jesús', monto: 999999 } // otra semana
    ]
  };
  const t = { of: 80000, ay: 65000 };

  it('TOTAL SEMANA = Σ jornales + fijos; NETO = total − adelantos de ESA semana', () => {
    const r = resumenSemana(diario, '2026-06-22', t);
    expect(r.jornales).toBe(562500);
    expect(r.fijos).toBe(140000);
    expect(r.total).toBe(702500);
    expect(r.adelantos).toBe(130000);
    expect(r.neto).toBe(572500);
  });

  it('replica la planilla real: semana $595.000 − adelanto $130.000 = $465.000', () => {
    const d2: DiarioObra = {
      jornales: [
        { id: 'x1', fecha: '2026-06-22', of: 2, ay: 1 },
        { id: 'x2', fecha: '2026-06-24', of: 2, ay: 1 }
      ],
      fijos: [{ id: 'xf', persona: 'Jesús', montoSemanal: 145000 }],
      adelantos: [{ id: 'xa', fecha: '2026-06-25', persona: 'Jesús', monto: 130000 }]
    };
    const r = resumenSemana(d2, '2026-06-22', t);
    expect(r.total).toBe(595000);
    expect(r.neto).toBe(465000);
    expect(adelantosDeSemana(d2.adelantos, '2026-06-22')).toHaveLength(1);
  });

  it('semana sin jornales ni adelantos → quedan solo los fijos (son recurrentes)', () => {
    const r = resumenSemana(diario, '2026-07-13', t);
    expect(r).toEqual({ jornales: 0, fijos: 140000, total: 140000, adelantos: 0, neto: 140000 });
    expect(resumenSemana(undefined, '2026-07-13', t)).toEqual({
      jornales: 0,
      fijos: 0,
      total: 0,
      adelantos: 0,
      neto: 0
    });
  });
});

describe('caja de obra', () => {
  const caja: MovimientoCaja[] = [
    { id: 'c1', fecha: '2026-06-22', tipo: 'ingreso', monto: 2000000, descripcion: 'Fondos cliente', pagado: true },
    { id: 'c2', fecha: '2026-06-26', tipo: 'egreso', monto: 1080000, descripcion: 'semana 1 - pago jornales', pagado: true },
    { id: 'c3', fecha: '2026-06-27', tipo: 'egreso', monto: 150000, descripcion: 'Volquete', comercio: 'Volquetes Sur', pagado: false },
    { id: 'c4', fecha: '2026-06-28', tipo: 'egreso', monto: 300000, descripcion: 'Corralón', comercio: 'FEROS', pagado: true }
  ];

  it('balance = Σ ingresos − Σ egresos; gasto total = Σ egresos', () => {
    const b = balanceCaja(caja);
    expect(b.ingresos).toBe(2000000);
    expect(b.egresos).toBe(1530000);
    expect(b.balance).toBe(470000);
    expect(gastoTotalObra(caja)).toBe(1530000);
    expect(balanceCaja(undefined)).toEqual({ ingresos: 0, egresos: 0, balance: 0 });
  });

  it('pendientes de pago: solo egresos con pagado=false', () => {
    expect(pendientesDePago(caja)).toEqual({ cantidad: 1, monto: 150000 });
  });

  it('resumen por comercio junta caja y compras (todas las facturas de Feros)', () => {
    const compras: CompraMaterial[] = [
      { id: 'p1', fecha: '2026-06-23', matCod: 'M1', cantidad: 30, precioUnit: 1200, proveedor: 'feros' },
      { id: 'p2', fecha: '2026-06-24', matCod: 'M1', cantidad: 30, proveedor: 'FEROS' } // sin precio: no suma $
    ];
    const r = resumenPorComercio(caja, compras);
    const feros = r.find((x) => x.nombre.toLowerCase() === 'feros');
    expect(feros).toBeDefined();
    expect(feros?.movs).toBe(1);
    expect(feros?.totalCaja).toBe(300000);
    expect(feros?.pedidos).toBe(2);
    expect(feros?.totalCompras).toBe(36000);
    expect(feros?.total).toBe(336000);
    // ordenado por total desc: Feros (336.000) antes que Volquetes Sur (150.000)
    expect(r.map((x) => x.nombre.toLowerCase())).toEqual(['feros', 'volquetes sur']);
  });
});

describe('compras: saldo regresivo por material', () => {
  it('caso Feros: computado 500, pedidos 30×3 → saldo 410, 18 % consumido, estado ok', () => {
    const obra: Obra = {
      ...obraBase,
      compras: [
        { id: 'p1', fecha: '2026-06-22', matCod: 'M1', cantidad: 30 },
        { id: 'p2', fecha: '2026-06-24', matCod: 'M1', cantidad: 30 },
        { id: 'p3', fecha: '2026-06-26', matCod: 'M1', cantidad: 30 }
      ]
    };
    const [s] = saldosCompras(obra, motor);
    expect(s.matCod).toBe('M1');
    expect(s.computado).toBe(500);
    expect(s.pedido).toBe(90);
    expect(s.saldo).toBe(410);
    expect(s.pctConsumido).toBeCloseTo(18, 5);
    expect(s.estado).toBe('ok');
    expect(s.compras).toHaveLength(3);
  });

  it('estados por umbral: ≥80 % por agotarse, >100 % excedido (100 % NO excede)', () => {
    expect(estadoSaldo(500, 90)).toBe('ok');
    expect(estadoSaldo(500, 399)).toBe('ok');
    expect(estadoSaldo(500, 400)).toBe('por agotarse'); // exactamente 80 %
    expect(estadoSaldo(500, 500)).toBe('por agotarse'); // 100 % justo no está excedido
    expect(estadoSaldo(500, 500.01)).toBe('excedido');
    expect(estadoSaldo(0, 10)).toBe('excedido'); // pedido sin cómputo
    expect(estadoSaldo(0, 0)).toBe('ok');
  });

  it('desvío de precio real vs presupuestado (motor: $1.000 + IVA = $1.210/kg)', () => {
    expect(desvioPrecioPct(1331, 1210)).toBeCloseTo(10, 5);
    expect(desvioPrecioPct(1210, 1210)).toBe(0);
    expect(desvioPrecioPct(0, 1210)).toBe(0); // sin precio real no hay desvío
    const obra: Obra = {
      ...obraBase,
      compras: [
        { id: 'p1', fecha: '2026-06-22', matCod: 'M1', cantidad: 30, precioUnit: 1452 }, // +20 %
        { id: 'p2', fecha: '2026-06-24', matCod: 'M1', cantidad: 30 } // sin precio → usa presup.
      ]
    };
    const [s] = saldosCompras(obra, motor);
    expect(s.precioPresupuestado).toBeCloseTo(1210, 5);
    expect(s.precioRealMedio).toBeCloseTo(1452, 5);
    expect(s.desvioPct).toBeCloseTo(20, 5);
    expect(s.costoReal).toBeCloseTo(30 * 1452 + 30 * 1210, 5);
    expect(s.costoPresupuestado).toBeCloseTo(60 * 1210, 5);
  });

  it('material pedido fuera del cómputo aparece con computado 0 y excedido', () => {
    const obra: Obra = {
      ...obraBase,
      compras: [{ id: 'p1', fecha: '2026-06-22', matCod: 'ZZ9', cantidad: 4, precioUnit: 500 }]
    };
    const saldos = saldosCompras(obra, motor);
    expect(saldos).toHaveLength(2); // M1 del cómputo + ZZ9 suelto
    const zz = saldos.find((s) => s.matCod === 'ZZ9');
    expect(zz?.computado).toBe(0);
    expect(zz?.saldo).toBe(-4);
    expect(zz?.estado).toBe('excedido');
  });

  it('proveedor adjudicado: registro de Comparativa y fallback por precio "en uso"', () => {
    const conRegistro: Obra = { ...obraBase, proveedores: { materiales: { M1: 'FEROS' } } };
    expect(proveedorDeMaterial(conRegistro, 'M1')).toBe('FEROS');
    // Fallback legacy: precio de la terna coincidente con la Lista (base sin IVA)
    const conCotiz: Obra = {
      ...obraBase,
      precios: { materiales: { M1: 950 } },
      cotizacionesPorRubro: {
        'Corralón': {
          provs: [
            { nombre: 'Feros', iva: 'sin' },
            { nombre: 'Otro', iva: 'sin' },
            { nombre: '', iva: 'sin' }
          ],
          precios: { M1: [950, 990, ''] }
        }
      }
    };
    expect(proveedorDeMaterial(conCotiz, 'M1')).toBe('Feros');
    expect(proveedorDeMaterial(obraBase, 'M1')).toBe('');
    const [s] = saldosCompras(conRegistro, motor);
    expect(s.proveedor).toBe('FEROS');
  });

  it('movimientoDeCompra genera el egreso vinculado con id determinístico (no duplica)', () => {
    const compra: CompraMaterial = {
      id: 'abc12',
      fecha: '2026-06-24',
      matCod: 'M1',
      cantidad: 30,
      precioUnit: 1200,
      proveedor: 'FEROS',
      facturaLink: 'https://drive.google.com/x'
    };
    const mov = movimientoDeCompra(compra, 'Hierro del 8', 'kg');
    expect(mov.id).toBe(idMovimientoCompra('abc12'));
    expect(mov.tipo).toBe('egreso');
    expect(mov.monto).toBe(36000);
    expect(mov.comercio).toBe('FEROS');
    expect(mov.facturaLink).toBe('https://drive.google.com/x');
    expect(mov.pagado).toBe(true);
    expect(mov.categoria).toBe('compras');
    expect(mov.descripcion).toContain('Hierro del 8');
    // mismo id para la misma compra → borrar/re-crear no duplica
    expect(movimientoDeCompra(compra, 'Hierro del 8', 'kg').id).toBe(mov.id);
  });
});

describe('herramientas en obra', () => {
  it('cuenta lo que sigue en obra (no devuelto), sumando cantidades', () => {
    expect(
      herramientasEnObra([
        { cant: 2, devuelta: false },
        { cant: 1, devuelta: true },
        { cant: 3, devuelta: false }
      ])
    ).toBe(5);
    expect(herramientasEnObra([])).toBe(0);
    expect(herramientasEnObra(undefined)).toBe(0);
  });
});
