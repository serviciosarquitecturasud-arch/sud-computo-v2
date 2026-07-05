/**
 * Tests del Legajo Legal (lógica pura de src/core/legales.ts):
 * seed y merge de categorías, vencimiento derivado, KPIs (incluido el
 * monto de presupuestos aprobados), agrupación por categoría y abreviatura
 * para chips en Archivos.
 */
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_LEGAL,
  SEED_CATEGORIAS_LEGAL,
  abrevCategoria,
  agruparLegales,
  esCategoriaPresupuesto,
  estaVencido,
  kpisLegales,
  mergeCategoriasLegalConSeed
} from '../src/core/legales';
import type { DocumentoLegal } from '../src/core/types';

const HOY = '2026-07-05';

const leg = (
  p: Partial<DocumentoLegal> & { id: string }
): DocumentoLegal => ({
  categoria: 'Acta',
  titulo: 'Doc ' + p.id,
  emisor: 'estudio SUD',
  destinatario: 'Cliente',
  fechaDoc: '2026-07-01',
  estado: 'presentado',
  ...p
});

describe('seed y merge de categorías del legajo', () => {
  it('el seed tiene las 9 categorías del estudio en orden', () => {
    expect(SEED_CATEGORIAS_LEGAL).toEqual([
      'Presupuesto a cliente',
      'Presupuesto de contratista',
      'Contrato con cliente',
      'Contrato con contratista',
      'Permiso / trámite municipal',
      'Seguridad e higiene',
      'ART / seguros',
      'Acta',
      'Otros'
    ]);
    expect(ESTADOS_LEGAL).toEqual(['presentado', 'aprobado', 'firmado', 'rechazado']);
  });

  it('sin datos guardados devuelve una copia del seed (no la misma referencia)', () => {
    const r = mergeCategoriasLegalConSeed(undefined, SEED_CATEGORIAS_LEGAL);
    expect(r).toEqual(SEED_CATEGORIAS_LEGAL);
    expect(r).not.toBe(SEED_CATEGORIAS_LEGAL);
    expect(mergeCategoriasLegalConSeed('corrupto', SEED_CATEGORIAS_LEGAL)).toEqual(
      SEED_CATEGORIAS_LEGAL
    );
  });

  it('las categorías del usuario mandan y las del seed faltantes se agregan al final', () => {
    const r = mergeCategoriasLegalConSeed(
      ['Acta', 'Garantías bancarias'],
      SEED_CATEGORIAS_LEGAL
    );
    // Las propias primero, en su orden
    expect(r.slice(0, 2)).toEqual(['Acta', 'Garantías bancarias']);
    // El seed se completa sin duplicar "Acta"
    expect(r.filter((c) => c === 'Acta')).toHaveLength(1);
    expect(r).toContain('Presupuesto a cliente');
    expect(r).toHaveLength(2 + SEED_CATEGORIAS_LEGAL.length - 1);
  });

  it('descarta vacíos y duplicados (sin distinguir mayúsculas) de lo guardado', () => {
    const r = mergeCategoriasLegalConSeed(
      ['acta', '', '   ', 'ACTA', 42, null, 'Otros'],
      SEED_CATEGORIAS_LEGAL
    );
    expect(r.slice(0, 2)).toEqual(['acta', 'Otros']);
    // "Acta" del seed no se re-inyecta porque "acta" ya está (case-insensitive)
    expect(r.some((c) => c.toLowerCase() === 'acta')).toBe(true);
    expect(r.filter((c) => c.toLowerCase() === 'acta')).toHaveLength(1);
    expect(r.filter((c) => c === 'Otros')).toHaveLength(1);
  });
});

describe('vencimiento derivado (no persistido)', () => {
  it('estaVencido: solo si hay fechaVenc y quedó antes de hoy', () => {
    expect(estaVencido(leg({ id: 'a' }), HOY)).toBe(false); // sin fechaVenc
    expect(estaVencido(leg({ id: 'b', fechaVenc: '2026-07-04' }), HOY)).toBe(true);
    expect(estaVencido(leg({ id: 'c', fechaVenc: HOY }), HOY)).toBe(false); // vence hoy: aún vigente
    expect(estaVencido(leg({ id: 'd', fechaVenc: '2027-01-01' }), HOY)).toBe(false);
  });
});

describe('kpisLegales', () => {
  const docs: DocumentoLegal[] = [
    leg({ id: '1', categoria: 'Presupuesto a cliente', estado: 'aprobado', monto: 1000000 }),
    leg({ id: '2', categoria: 'Presupuesto de contratista', estado: 'firmado', monto: 250000.5 }),
    leg({ id: '3', categoria: 'Presupuesto a cliente', estado: 'presentado', monto: 900000 }),
    leg({ id: '4', categoria: 'Presupuesto a cliente', estado: 'rechazado', monto: 400000 }),
    leg({ id: '5', categoria: 'Contrato con cliente', estado: 'firmado', monto: 5000000 }),
    leg({ id: '6', categoria: 'ART / seguros', estado: 'aprobado', fechaVenc: '2026-06-30' }),
    leg({ id: '7', categoria: 'Permiso / trámite municipal', estado: 'presentado', fechaVenc: '2026-12-31' })
  ];

  it('cuenta total, aprobados/firmados, pendientes y vencidos', () => {
    const k = kpisLegales(docs, HOY);
    expect(k.total).toBe(7);
    expect(k.aprobados).toBe(4); // ids 1, 2, 5 y 6
    expect(k.pendientes).toBe(2); // ids 3 y 7
    expect(k.vencidos).toBe(1); // id 6 (venció el 30/06)
  });

  it('suma el monto solo de presupuestos aprobados/firmados', () => {
    const k = kpisLegales(docs, HOY);
    // 1.000.000 (id 1) + 250.000,5 (id 2); excluye el presentado, el rechazado
    // y el contrato firmado (no es categoría de presupuesto)
    expect(k.montoPresupAprobado).toBeCloseTo(1250000.5, 5);
  });

  it('tolera lista vacía, montos ausentes y entradas inválidas', () => {
    expect(kpisLegales([], HOY)).toEqual({
      total: 0,
      aprobados: 0,
      pendientes: 0,
      vencidos: 0,
      montoPresupAprobado: 0
    });
    const k = kpisLegales(
      [leg({ id: 'x', categoria: 'Presupuesto a cliente', estado: 'aprobado' })],
      HOY
    );
    expect(k.montoPresupAprobado).toBe(0); // sin monto no suma NaN
    expect(k.aprobados).toBe(1);
  });

  it('esCategoriaPresupuesto detecta las categorías de presupuesto', () => {
    expect(esCategoriaPresupuesto('Presupuesto a cliente')).toBe(true);
    expect(esCategoriaPresupuesto('Presupuesto de contratista')).toBe(true);
    expect(esCategoriaPresupuesto('presupuesto adicional hierro')).toBe(true);
    expect(esCategoriaPresupuesto('Contrato con cliente')).toBe(false);
    expect(esCategoriaPresupuesto('')).toBe(false);
  });
});

describe('agruparLegales', () => {
  it('agrupa por categoría en el orden del catálogo y solo categorías con documentos', () => {
    const docs = [
      leg({ id: '1', categoria: 'Acta' }),
      leg({ id: '2', categoria: 'Contrato con cliente' }),
      leg({ id: '3', categoria: 'Acta' })
    ];
    const g = agruparLegales(docs, SEED_CATEGORIAS_LEGAL);
    expect(g.map((x) => x.categoria)).toEqual(['Contrato con cliente', 'Acta']);
    expect(g[1].docs).toHaveLength(2);
  });

  it('ordena dentro de cada categoría por fechaDoc descendente', () => {
    const docs = [
      leg({ id: 'viejo', categoria: 'Acta', fechaDoc: '2026-01-10' }),
      leg({ id: 'nuevo', categoria: 'Acta', fechaDoc: '2026-07-01' }),
      leg({ id: 'medio', categoria: 'Acta', fechaDoc: '2026-03-15' })
    ];
    const g = agruparLegales(docs, SEED_CATEGORIAS_LEGAL);
    expect(g[0].docs.map((d) => d.id)).toEqual(['nuevo', 'medio', 'viejo']);
  });

  it('las categorías fuera del catálogo van al final, alfabéticas es-AR', () => {
    const docs = [
      leg({ id: '1', categoria: 'Zona franca' }),
      leg({ id: '2', categoria: 'Garantías' }),
      leg({ id: '3', categoria: 'Otros' }),
      leg({ id: '4', categoria: '   ' }) // sin categoría → "Sin categoría"
    ];
    const g = agruparLegales(docs, SEED_CATEGORIAS_LEGAL);
    expect(g.map((x) => x.categoria)).toEqual(['Otros', 'Garantías', 'Sin categoría', 'Zona franca']);
  });

  it('tolera entradas inválidas y catálogo vacío', () => {
    const docs = [leg({ id: '1', categoria: 'Acta' }), null as unknown as DocumentoLegal];
    const g = agruparLegales(docs, []);
    expect(g).toEqual([{ categoria: 'Acta', docs: [docs[0]] }]);
  });
});

describe('abrevCategoria (chips en Archivos)', () => {
  it('devuelve la primera palabra, limpia de separadores', () => {
    expect(abrevCategoria('ART / seguros')).toBe('ART');
    expect(abrevCategoria('Permiso / trámite municipal')).toBe('Permiso');
    expect(abrevCategoria('Presupuesto a cliente')).toBe('Presupuesto');
    expect(abrevCategoria('Acta')).toBe('Acta');
    expect(abrevCategoria('')).toBe('Legal');
  });
});
