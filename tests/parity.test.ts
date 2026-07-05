/**
 * Tests de paridad: núcleo nuevo (TS) vs. extracción VERBATIM del legacy.
 * Si estos tests pasan, el motor nuevo produce números idénticos al de producción.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  SEED,
  buildMotor,
  buildPlan,
  buildSuministro,
  calcCoef,
  cmpCodigo,
  coefDefault,
  costoHerramienta,
  expandSeed,
  materialesTotalObra
} from '../src/core';
import type { Obra } from '../src/core';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require('./legacy/core-legacy.cjs');

/** Obra sintética que ejercita todos los caminos de override del motor. */
function obraSintetica(): Obra {
  return {
    id: 'test-1',
    nombre: 'Obra sintética de paridad',
    coef: { ggd: 8, ggi: 6, imp: 2, ben: 12, iva: 21, iib: 3.5 }, // iva debe ignorarse
    items: [
      { cod: '3.01.01', cant: 12.5 },
      { cod: '3.02.01', cant: 4.2 },
      { cod: '1.01', cant: 1, precioManual: 250000 }, // Global sin APU
      { cod: '4.01', cant: 85 },
      { cod: '5.01', cant: 60.75 },
      { cod: '9.01', cant: 3 }
    ],
    precios: {
      materialesConIVA: { '201': 9800, '101': 32000 }, // override Camino γ
      materiales: { '102': 26000 }, // override legacy sin IVA
      manoObra: { '01': 95000 },
      herramientas: { '101': 15500 }
    },
    materialesConfig: {
      '201': { fac1: 50, pres1: 'bolsa' }, // β = 9800/50
      '101': { fac1: '' } // vacío → fallback a fac1 del catálogo
    },
    plan: {
      hsSem: 44,
      rubros: {
        '1': { duracion: 1, inicioManual: 1 },
        '3': { duracion: 6, precede: '1' },
        '4': { ofsCuad: 2, ayudCuad: 1, precede: '3' }, // modo cuadrilla
        '5': { duracion: 4, precede: '4' },
        '9': { duracion: 2, precede: '3' } // rama paralela → holguras
      }
    }
  };
}

/** Convierte Sets a arrays ya lo hace el código; deep compare directo. */
describe('expandSeed', () => {
  it('produce un catálogo idéntico al legacy', () => {
    const nuevo = expandSeed(SEED);
    const viejo = legacy.expandSeed(SEED);
    expect(nuevo).toEqual(viejo);
  });
});

describe('cmpCodigo', () => {
  it('ordena igual que el legacy en casos representativos', () => {
    const casos = [
      ['1.00', '1.01'], ['4.00', '4.01'], ['10.05', '9.01'], ['001', '007'],
      ['3.01.01', '3.01'], ['SC01', '1.01'], ['2203', '2204'], [null, '1'],
      ['1', null], [null, null], ['1.02', '1.02'], ['1-02', '1.03'], ['a', 'b']
    ];
    for (const [a, b] of casos) {
      expect(Math.sign(cmpCodigo(a, b))).toBe(Math.sign(legacy.cmpCodigo(a, b)));
    }
  });
});

describe('calcCoef', () => {
  it('coincide con el legacy (e ignora IVA)', () => {
    const c = { ggd: 8, ggi: 6, imp: 2, ben: 12, iva: 21, iib: 3.5 };
    expect(calcCoef(c)).toBe(legacy.calcCoef(c));
    expect(calcCoef(coefDefault())).toBe(legacy.calcCoef(legacy.coefDefault()));
    // R11: (1 + ggd+ggi+imp+ben) × (1 + iibb), sin IVA ni cargas sociales
    expect(calcCoef(c)).toBeCloseTo(1.28 * 1.035, 12);
  });
});

describe('costoHerramienta', () => {
  it('coincide en propia, alquilada y bordes', () => {
    const casos = [
      { tenencia: 'Propia', valor: 900000, vidautil: 500, jornada: 8, combust: 120, reparac: 60 },
      { tenencia: 'Propia', valor: 900000, vidautil: 0, jornada: 8, combust: 120, reparac: 60 },
      { tenencia: 'Alquilada', valor: 14000, vidautil: 0, jornada: 8, combust: 0, reparac: 0 },
      { tenencia: 'Alquilada', valor: 14000, vidautil: 0, jornada: 0, combust: 0, reparac: 0 },
      { tenencia: 'Otra', valor: 1, vidautil: 1, jornada: 1, combust: 1, reparac: 1 },
      null
    ];
    for (const h of casos) {
      expect(costoHerramienta(h as never)).toBe(legacy.costoHerramienta(h));
    }
  });
});

describe('buildMotor — precios de catálogo (sin obra)', () => {
  const cat = expandSeed(SEED);
  const mNuevo = buildMotor(cat);
  const mViejo = legacy.buildMotor(legacy.expandSeed(SEED));

  it('costoAPU idéntico para TODOS los APUs del SEED', () => {
    const apus = Object.keys(mNuevo.bibMap);
    expect(apus.length).toBeGreaterThan(250);
    for (const a of apus) {
      expect(mNuevo.costoAPU(a), `APU ${a}`).toBe(mViejo.costoAPU(a));
    }
  });

  it('costoInsumo idéntico para todos los insumos', () => {
    for (const cod of Object.keys(mNuevo.matMap)) {
      expect(mNuevo.costoInsumo('M', cod)).toBe(mViejo.costoInsumo('M', cod));
    }
    for (const cod of Object.keys(mNuevo.moMap)) {
      expect(mNuevo.costoInsumo('MO', cod)).toBe(mViejo.costoInsumo('MO', cod));
    }
    for (const cod of Object.keys(mNuevo.herrMap)) {
      expect(mNuevo.costoInsumo('E', cod)).toBe(mViejo.costoInsumo('E', cod));
    }
  });

  it('apuHuerfanos y apuTiene idénticos', () => {
    for (const a of Object.keys(mNuevo.bibMap)) {
      expect(mNuevo.apuTiene(a)).toBe(mViejo.apuTiene(a));
      expect(mNuevo.apuHuerfanos(a)).toEqual(mViejo.apuHuerfanos(a));
    }
  });
});

describe('buildMotor — overrides por obra (Camino γ)', () => {
  const cat = expandSeed(SEED);
  const mNuevo = buildMotor(cat);
  const mViejo = legacy.buildMotor(legacy.expandSeed(SEED));
  const obra = obraSintetica();

  it('costoInsumoEnObra idéntico para todos los materiales (con y sin override)', () => {
    for (const cod of Object.keys(mNuevo.matMap)) {
      expect(mNuevo.costoInsumoEnObra('M', cod, obra), `mat ${cod}`).toBe(
        mViejo.costoInsumoEnObra('M', cod, obra)
      );
    }
  });

  it('costoInsumoEnObra idéntico para MO y equipos', () => {
    for (const cod of Object.keys(mNuevo.moMap)) {
      expect(mNuevo.costoInsumoEnObra('MO', cod, obra)).toBe(mViejo.costoInsumoEnObra('MO', cod, obra));
    }
    for (const cod of Object.keys(mNuevo.herrMap)) {
      expect(mNuevo.costoInsumoEnObra('E', cod, obra)).toBe(mViejo.costoInsumoEnObra('E', cod, obra));
    }
  });

  it('costoAPUEnObra idéntico para TODOS los APUs', () => {
    for (const a of Object.keys(mNuevo.bibMap)) {
      expect(mNuevo.costoAPUEnObra(a, obra), `APU ${a}`).toBe(mViejo.costoAPUEnObra(a, obra));
    }
  });
});

describe('buildPlan / buildSuministro / materialesTotalObra', () => {
  const cat = expandSeed(SEED);
  const mNuevo = buildMotor(cat);
  const mViejo = legacy.buildMotor(legacy.expandSeed(SEED));
  const obra = obraSintetica();

  it('buildPlan idéntico (CPM, curva, cuadrilla, precedencias)', () => {
    const pNuevo = buildPlan(obra, mNuevo);
    const pViejo = legacy.buildPlan(obra, mViejo);
    expect(pNuevo).toEqual(pViejo);
  });

  it('buildPlan con obra vacía / null', () => {
    expect(buildPlan(null, mNuevo)).toEqual(legacy.buildPlan(null, mViejo));
    expect(buildPlan({ id: 'x' }, mNuevo)).toEqual(legacy.buildPlan({ id: 'x' }, mViejo));
  });

  it('buildSuministro idéntico (Modelo A, globales incluidos)', () => {
    const pNuevo = buildPlan(obra, mNuevo);
    const pViejo = legacy.buildPlan(obra, mViejo);
    expect(buildSuministro(obra, pNuevo, mNuevo)).toEqual(legacy.buildSuministro(obra, pViejo, mViejo));
  });

  it('materialesTotalObra idéntico', () => {
    expect(materialesTotalObra(obra, mNuevo)).toEqual(legacy.materialesTotalObra(obra, mViejo));
  });
});
