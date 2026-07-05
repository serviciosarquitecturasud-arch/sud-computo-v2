/**
 * Tests del módulo Revit:
 *  1) PARIDAD de validateRevitPayload y magnitudParaUnidad contra la
 *     extracción verbatim del legacy (tests/legacy/revit-legacy.cjs).
 *  2) Regla de negocio propia: mapeo SOLO por campo Comentarios, filas sin
 *     comentario reportadas, diff y aplicación a la obra.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  REVIT_CATS_MVP,
  REVIT_SCHEMA_ACEPTADAS,
  REVIT_SCHEMA_VERSION,
  aplicarRevitAObra,
  comentarioDeElemento,
  diffContraObra,
  estadoVinculo,
  magnitudParaUnidad,
  prepararImport,
  validateRevitPayload,
  type RevitElemento,
  type RevitPayload
} from '../src/core/revit';
import type { Obra, Rubro } from '../src/core';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require('./legacy/revit-legacy.cjs');

/* ============================ helpers de payloads ============================ */

function elemento(over: Partial<RevitElemento> = {}): RevitElemento {
  return {
    uid: 'D:\\ruta\\SD.rvt::348521',
    id: 348521,
    documento: 'SD.rvt',
    categoria: 'Walls',
    familia: 'Muro básico',
    tipo: 'Muro básico HCV12',
    magnitudes: { area_m2: 12.45, longitud_m: 4.2, volumen_m3: 1.494 },
    ubicacion: { nivel: 'Planta Baja', fase: 'Nueva construcción', workset: 'Arquitectura' },
    parametros: {},
    ...over
  };
}

function payload11(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    metadata: {
      schemaVersion: '1.1',
      fecha: '2026-05-20T19:42:00-03:00',
      proyecto: 'Casa Lomas',
      documentoHost: 'SD.rvt',
      documentoHostRuta: 'D:\\Estudios SUD\\2024\\Casa Lomas\\02_Revit\\SD.rvt',
      documentosLinkeados: [],
      totalElementos: 1,
      categoriasIncluidas: ['Walls']
    },
    elementos: [elemento()],
    ...over
  };
}

/** Los 6+ payloads del contrato de paridad */
const casosParidad: [string, unknown][] = [
  ['válido 1.1', payload11()],
  [
    'válido 1.0 (warning de obsoleto)',
    payload11({
      metadata: {
        schemaVersion: '1.0',
        fecha: '2026-05-20T19:42:00-03:00',
        proyecto: 'Casa Lomas',
        documentoHost: 'SD.rvt',
        documentosLinkeados: []
      }
    })
  ],
  ['sin metadata', { elementos: [elemento()] }],
  [
    'schemaVersion inválida',
    payload11({
      metadata: {
        schemaVersion: '2.0',
        fecha: 'x',
        proyecto: 'y',
        documentoHost: 'z',
        documentosLinkeados: []
      }
    })
  ],
  [
    'sin documentoHostRuta en 1.1',
    payload11({
      metadata: {
        schemaVersion: '1.1',
        fecha: '2026-05-20',
        proyecto: 'Casa Lomas',
        documentoHost: 'SD.rvt',
        documentosLinkeados: []
      }
    })
  ],
  [
    'elementos malformados',
    payload11({
      elementos: [
        null,
        ['no', 'es', 'objeto'],
        elemento({ uid: 'a', magnitudes: {} }),
        elemento({ uid: 'a', tipo: '', magnitudes: { area_m2: -3 } }),
        elemento({ uid: 'b', magnitudes: { area_m2: 'doce' } as unknown as Record<string, number> }),
        elemento({ uid: 'c', magnitudes: { area_m2: Infinity } })
      ]
    })
  ],
  ['raíz no-objeto (array)', [1, 2, 3]],
  ['elementos vacío', payload11({ elementos: [] })],
  [
    'cross-checks de metadata (warnings)',
    payload11({
      metadata: {
        schemaVersion: '1.1',
        fecha: 'f',
        proyecto: 'p',
        documentoHost: 'h',
        documentoHostRuta: 'D:\\x\\SD.rvt',
        documentosLinkeados: [],
        totalElementos: 99,
        categoriasIncluidas: ['Doors']
      },
      elementos: [elemento(), elemento({ uid: 'otro', categoria: 'Floors' })]
    })
  ]
];

/* ============================ 1 · Paridad ============================ */

describe('paridad validateRevitPayload (nuevo vs legacy)', () => {
  it('constantes de schema idénticas', () => {
    expect(REVIT_SCHEMA_VERSION).toBe(legacy.REVIT_SCHEMA_VERSION);
    expect(REVIT_SCHEMA_ACEPTADAS).toEqual(legacy.REVIT_SCHEMA_ACEPTADAS);
    expect(REVIT_CATS_MVP).toEqual(legacy.REVIT_CATS_MVP);
  });

  for (const [nombre, p] of casosParidad) {
    it(`errs y warns idénticos — ${nombre}`, () => {
      const nuevo = validateRevitPayload(p);
      const viejo = legacy.validateRevitPayload(p);
      expect(nuevo.errs).toEqual(viejo.errs);
      expect(nuevo.warns).toEqual(viejo.warns);
    });
  }

  it('válido 1.1 pasa sin errores ni warnings', () => {
    expect(validateRevitPayload(payload11())).toEqual({ errs: [], warns: [] });
  });

  it('1.0 acepta con warning de obsoleto', () => {
    const res = validateRevitPayload(casosParidad[1][1]);
    expect(res.errs).toEqual([]);
    expect(res.warns.length).toBe(1);
    expect(res.warns[0]).toMatch(/obsoleto/);
  });

  it('1.1 sin documentoHostRuta es error', () => {
    const res = validateRevitPayload(casosParidad[4][1]);
    expect(res.errs.some((e) => e.includes('documentoHostRuta'))).toBe(true);
  });
});

describe('paridad magnitudParaUnidad (nuevo vs legacy)', () => {
  const unidades = ['m²', 'M2', 'm2', 'm³', 'm3', 'ml', 'm', ' M ', 'un', 'u', 'UN', 'kg', 'KG', 'gl', 'Gl', 'hs', '', null, undefined, 42];
  for (const u of unidades) {
    it(`unidad ${JSON.stringify(u)}`, () => {
      expect(magnitudParaUnidad(u)).toBe(legacy.magnitudParaUnidad(u));
    });
  }
  it('valores esperados puntuales', () => {
    expect(magnitudParaUnidad('m²')).toBe('area_m2');
    expect(magnitudParaUnidad('m3')).toBe('volumen_m3');
    expect(magnitudParaUnidad('ml')).toBe('longitud_m');
    expect(magnitudParaUnidad('un')).toBe('__count__');
    expect(magnitudParaUnidad('gl')).toBe('__count__');
    expect(magnitudParaUnidad('kg')).toBe('peso_kg');
    expect(magnitudParaUnidad('hs')).toBe(null);
  });
});

/* ============================ 2 · Mapeo por Comentarios ============================ */

const rubros: Rubro[] = [
  { cod: '4.00', rubro: 'Mampostería', subrubro: '', desc: 'MAMPOSTERÍA', unidad: '' },
  { cod: '4.02.06', rubro: 'Mampostería', subrubro: '', desc: 'Muro HCV 12', unidad: 'm2' },
  { cod: '7.01', rubro: 'Carpinterías', subrubro: '', desc: 'Puerta placa', unidad: 'un' },
  { cod: '5.01', rubro: 'Contrapisos', subrubro: '', desc: 'Contrapiso', unidad: 'm3' }
];

function payloadObra(): RevitPayload {
  return payload11({
    elementos: [
      elemento({ uid: 'w1', comentario: '4.02.06', magnitudes: { area_m2: 10 } }),
      elemento({ uid: 'w2', comentario: '4.02.06', magnitudes: { area_m2: 5.5 } }),
      // comentario vía parametros.Comentarios
      elemento({ uid: 'd1', categoria: 'Doors', tipo: 'P80', parametros: { Comentarios: '7.01' }, magnitudes: { ancho_m: 0.8 } }),
      // comentario que NO es código: se resuelve con el mapa manual
      elemento({ uid: 'f1', categoria: 'Floors', comentarios: 'contrapiso interior', magnitudes: { volumen_m3: 2.25 } }),
      // fila SIN comentario → reportar, no inventar mapeo (aunque el tipo coincida)
      elemento({ uid: 'w3', tipo: 'Muro básico HCV12', magnitudes: { area_m2: 99 } }),
      // fuera de categorías MVP
      elemento({ uid: 'r1', categoria: 'Roofs', comentario: '4.02.06', magnitudes: { area_m2: 40 } })
    ]
  }) as unknown as RevitPayload;
}

describe('prepararImport — mapeo SOLO por campo Comentarios', () => {
  it('el payload de trabajo valida limpio de errores', () => {
    const res = validateRevitPayload(payloadObra());
    expect(res.errs).toEqual([]);
  });

  it('comentarioDeElemento lee comentario/comentarios/parametros.Comentarios', () => {
    expect(comentarioDeElemento(elemento({ comentario: ' 4.02.06 ' }))).toBe('4.02.06');
    expect(comentarioDeElemento(elemento({ comentarios: 'x' }))).toBe('x');
    expect(comentarioDeElemento(elemento({ parametros: { Comentarios: 'y' } }))).toBe('y');
    expect(comentarioDeElemento(elemento())).toBe('');
  });

  it('nunca mapea por Type name: fila sin comentario queda reportada', () => {
    const prep = prepararImport(payloadObra(), rubros, {});
    expect(prep.sinComentario.map((f) => f.uid)).toEqual(['w3']);
    // w3 no aparece en ningún rubro pese a que su tipo coincide con w1/w2
    const total = prep.rubros.find((b) => b.cod === '4.02.06');
    expect(total?.cantidad).toBeCloseTo(15.5, 10);
  });

  it('comentario con código válido mapea directo; sin mapa queda inválido', () => {
    const prep = prepararImport(payloadObra(), rubros, {});
    const g = prep.grupos.find((x) => x.comentario === '4.02.06');
    expect(g?.fuente).toBe('comentario');
    expect(g?.rubroValido).toBe(true);
    const libre = prep.grupos.find((x) => x.comentario === 'contrapiso interior');
    expect(libre?.rubroValido).toBe(false);
    expect(prep.rubros.find((b) => b.cod === '5.01')).toBeUndefined();
  });

  it('el mapa manual (cmp_revitMap) resuelve comentarios no-código', () => {
    const prep = prepararImport(payloadObra(), rubros, { 'contrapiso interior': '5.01' });
    const libre = prep.grupos.find((x) => x.comentario === 'contrapiso interior');
    expect(libre?.fuente).toBe('mapaManual');
    expect(libre?.codFinal).toBe('5.01');
    expect(prep.rubros.find((b) => b.cod === '5.01')?.cantidad).toBeCloseTo(2.25, 10);
  });

  it('rubros .00 o sin unidad no son destinos válidos', () => {
    const prep = prepararImport(
      payload11({ elementos: [elemento({ uid: 'x', comentario: '4.00' })] }) as unknown as RevitPayload,
      rubros,
      {}
    );
    expect(prep.grupos[0].rubroValido).toBe(false);
    expect(prep.rubros).toEqual([]);
  });

  it('unidad "un" cuenta elementos; magnitud faltante se excluye y reporta', () => {
    const p = payload11({
      elementos: [
        elemento({ uid: 'd1', categoria: 'Doors', comentario: '7.01', magnitudes: { ancho_m: 0.8 } }),
        elemento({ uid: 'd2', categoria: 'Doors', comentario: '7.01', magnitudes: { ancho_m: 0.9 } }),
        elemento({ uid: 'm1', comentario: '4.02.06', magnitudes: { longitud_m: 3 } }) // sin area_m2
      ]
    }) as unknown as RevitPayload;
    const prep = prepararImport(p, rubros, {});
    expect(prep.rubros.find((b) => b.cod === '7.01')?.cantidad).toBe(2);
    expect(prep.sinMagnitud).toEqual([
      { uid: 'm1', tipo: 'Muro básico HCV12', unidadRubro: 'm2', magnitudEsperada: 'area_m2' }
    ]);
  });

  it('categorías fuera del MVP quedan excluidas y contadas', () => {
    const prep = prepararImport(payloadObra(), rubros, {});
    expect(prep.excluidos.fueraMvp).toBe(1);
  });
});

/* ============================ 3 · Diff y aplicación ============================ */

describe('diffContraObra + aplicarRevitAObra', () => {
  const mapa = { 'contrapiso interior': '5.01' };

  it('diff: nuevo / cambia / igual + conflicto con carga manual', () => {
    const obra: Obra = {
      id: 'o1',
      nombre: 'Obra test',
      items: [
        { cod: '4.02.06', cant: 15.5, revitOrigen: { schemaVersion: '1.1', fechaImport: 'x', proyecto: 'p', rutaArchivo: null, magnitudUsada: 'area_m2', elementos: [{ uid: 'w1', id: 1, tipo: 't', valor: 10, nivel: null, fase: null, workset: null }, { uid: 'w2', id: 2, tipo: 't', valor: 5.5, nivel: null, fase: null, workset: null }] } },
        { cod: '7.01', cant: 5 } // carga manual, sin revitOrigen
      ]
    };
    const p = payloadObra();
    const prep = prepararImport(p, rubros, mapa);
    const diff = diffContraObra(p, prep, obra);
    const porCod = Object.fromEntries(diff.filas.map((f) => [f.cod, f]));
    expect(porCod['4.02.06'].estado).toBe('igual');
    expect(porCod['4.02.06'].esReimport).toBe(true);
    expect(porCod['7.01'].estado).toBe('cambia');
    expect(porCod['7.01'].conflictoManual).toBe(true);
    expect(porCod['5.01'].estado).toBe('nuevo');
    expect(diff.total.sinCambios).toBe(2); // w1, w2 idénticos
    expect(diff.hayReimport).toBe(true);
  });

  it('aplicar crea/actualiza items, guarda revitOrigen y auto-vincula (schema 1.1)', () => {
    const obra: Obra = { id: 'o1', nombre: 'Obra test', items: [{ cod: '7.01', cant: 5 }] };
    const p = payloadObra();
    const res = aplicarRevitAObra(obra, p, rubros, mapa, '2026-07-05T12:00:00.000Z');
    expect(res.nuevos).toBe(2); // 4.02.06 y 5.01
    expect(res.reimportados).toBe(0);
    expect(res.conflictosResueltos).toBe(1); // 7.01 manual pisado
    expect(res.sinComentario.map((f) => f.uid)).toEqual(['w3']);

    const items = res.obra.items || [];
    const muro = items.find((i) => i.cod === '4.02.06');
    expect(muro?.cant).toBeCloseTo(15.5, 10);
    expect((muro?.revitOrigen as { magnitudUsada: string }).magnitudUsada).toBe('area_m2');
    const puerta = items.find((i) => i.cod === '7.01');
    expect(puerta?.cant).toBe(1);
    expect((puerta?.revitOrigen as { magnitudUsada: string }).magnitudUsada).toBe('count');

    // auto-vinculación 1.1 con documentoHostRuta
    const v = res.obra.revitVinculo as { rutaArchivo: string; vinculadoEn: string; ultimoImport: string };
    expect(res.autoVinculo).toBe(true);
    expect(v.rutaArchivo).toBe('D:\\Estudios SUD\\2024\\Casa Lomas\\02_Revit\\SD.rvt');
    expect(v.ultimoImport).toBe('2026-07-05T12:00:00.000Z');
    // la obra original no se muta
    expect(obra.items?.length).toBe(1);
    expect(obra.revitVinculo).toBeUndefined();
  });

  it('estadoVinculo: match / mismatch / noVinculada / sinRuta', () => {
    const p = payloadObra();
    const ruta = p.metadata.documentoHostRuta as string;
    expect(estadoVinculo(p, { id: 'a' }).tipo).toBe('noVinculada');
    expect(estadoVinculo(p, { id: 'a', revitVinculo: { rutaArchivo: ruta, vinculadoEn: 'x', ultimoImport: null } }).tipo).toBe('match');
    const mm = estadoVinculo(p, { id: 'a', revitVinculo: { rutaArchivo: 'C:\\otro\\SD.rvt', vinculadoEn: 'x', ultimoImport: null } });
    expect(mm.tipo).toBe('mismatch');
    const p10 = { ...p, metadata: { ...p.metadata, documentoHostRuta: undefined } } as unknown as RevitPayload;
    expect(estadoVinculo(p10, { id: 'a' }).tipo).toBe('sinRuta');
    expect(estadoVinculo(p10, { id: 'a', revitVinculo: { rutaArchivo: ruta, vinculadoEn: 'x', ultimoImport: null } }).tipo).toBe('sinRutaJson');
  });
});
