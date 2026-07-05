/**
 * Tests del Registro de Documentación (lógica pura de src/core/documentos.ts):
 * expansión y merge del seed de tipos de plano, validación de códigos,
 * vigencia derivada por código, sugerencia de próxima revisión, agrupación
 * por grupo del catálogo, último autor, KPIs y nombre estándar de archivo.
 */
import { describe, expect, it } from 'vitest';
import {
  SEED_TIPOS_PLANO,
  agruparDocs,
  esVigente,
  expandirSeedTiposPlano,
  kpisDocumentos,
  mergeTiposPlanoConSeed,
  nombreEstandar,
  ordenGrupos,
  proximaRev,
  slugDen,
  tipoPorCod,
  ultimoAutor,
  validarCod,
  vigentePorCod
} from '../src/core/documentos';
import type { DocumentoObra, TipoPlano } from '../src/core/types';

const doc = (p: Partial<DocumentoObra> & { id: string; cod: string; rev: number }): DocumentoObra => ({
  fecha: '2026-07-05',
  autor: '',
  ...p
});

const TIPOS: TipoPlano[] = [
  { cod: 'TP1', den: 'Obrador Y Vallas Provisorias', esc: '1,100', grupo: 'Trabajos Preliminares' },
  { cod: 'TP2', den: 'Cartel De Obra', esc: 'S.E.', grupo: 'Trabajos Preliminares' },
  { cod: 'IE1', den: 'Esquema Unifilar', esc: '1,50', grupo: 'Instalacion Electrica' },
  { cod: 'CAMAD3', den: 'Planilla De Carpinterias', esc: '1,20', grupo: 'Carpinterias', sub: 'De Madera' }
];

describe('seed de tipos de plano', () => {
  it('el seed embebido expande los 22 grupos y 190 tipos, con grupo en cada tipo', () => {
    expect(SEED_TIPOS_PLANO).toHaveLength(190);
    expect(new Set(SEED_TIPOS_PLANO.map((t) => t.grupo)).size).toBe(22);
    expect(SEED_TIPOS_PLANO.every((t) => t.cod && t.den && t.grupo)).toBe(true);
    // sin códigos duplicados
    expect(new Set(SEED_TIPOS_PLANO.map((t) => t.cod)).size).toBe(190);
    // subgrupos preservados (ej. Carpinterías)
    expect(SEED_TIPOS_PLANO.some((t) => t.sub)).toBe(true);
  });

  it('expandirSeedTiposPlano aplana con grupo y descarta cods vacíos o repetidos', () => {
    const flat = expandirSeedTiposPlano([
      { grupo: 'G1', tipos: [{ cod: 'A1', den: 'Uno', esc: '1,50' }, { cod: '', den: 'Sin cod', esc: '' }] },
      { grupo: 'G2', tipos: [{ cod: 'A1', den: 'Duplicado', esc: '' }, { cod: 'B1', den: 'Dos', esc: 'S.E.', sub: 'Sub' }] }
    ]);
    expect(flat).toEqual([
      { cod: 'A1', den: 'Uno', esc: '1,50', grupo: 'G1' },
      { cod: 'B1', den: 'Dos', esc: 'S.E.', grupo: 'G2', sub: 'Sub' }
    ]);
  });

  it('merge no destructivo: respeta ediciones y altas del usuario y agrega tipos nuevos del seed', () => {
    const delUsuario: TipoPlano[] = [
      { cod: 'TP1', den: 'Obrador (editado por el estudio)', esc: '1,200', grupo: 'Trabajos Preliminares' },
      { cod: 'ZZ9', den: 'Tipo propio', esc: 'S.E.', grupo: 'Grupo Propio' }
    ];
    const merged = mergeTiposPlanoConSeed(delUsuario, TIPOS);
    // la edición del usuario manda
    expect(tipoPorCod(merged, 'TP1')?.den).toBe('Obrador (editado por el estudio)');
    // el alta del usuario sobrevive
    expect(tipoPorCod(merged, 'ZZ9')).toBeDefined();
    // los del seed que faltaban se agregan
    expect(merged.map((t) => t.cod)).toEqual(['TP1', 'ZZ9', 'TP2', 'IE1', 'CAMAD3']);
  });

  it('merge con guardado ausente o inválido devuelve el seed completo (copia)', () => {
    const a = mergeTiposPlanoConSeed(undefined, TIPOS);
    expect(a).toEqual(TIPOS);
    expect(a[0]).not.toBe(TIPOS[0]); // copia, no la misma referencia
    expect(mergeTiposPlanoConSeed('basura', TIPOS)).toEqual(TIPOS);
  });
});

describe('validación de código contra el catálogo', () => {
  it('acepta solo códigos existentes en el catálogo (no texto libre)', () => {
    expect(validarCod('IE1', TIPOS)).toBe(true);
    expect(validarCod('CAMAD3', TIPOS)).toBe(true);
    expect(validarCod('IE99', TIPOS)).toBe(false);
    expect(validarCod('', TIPOS)).toBe(false);
    expect(validarCod(undefined, TIPOS)).toBe(false);
  });
});

describe('vigencia derivada por código', () => {
  const docs: DocumentoObra[] = [
    doc({ id: 'a', cod: 'IE1', rev: 0, fecha: '2026-01-10', autor: 'MB' }),
    doc({ id: 'b', cod: 'IE1', rev: 2, fecha: '2026-03-01', autor: 'MB' }),
    doc({ id: 'c', cod: 'IE1', rev: 1, fecha: '2026-02-01', autor: 'JP' }),
    doc({ id: 'd', cod: 'TP1', rev: 0, fecha: '2026-01-05', autor: 'JP' })
  ];

  it('la mayor rev de cada cod es la vigente; el resto quedan superadas', () => {
    const vig = vigentePorCod(docs);
    expect(vig.get('IE1')?.id).toBe('b');
    expect(vig.get('TP1')?.id).toBe('d');
    expect(esVigente(docs[1], docs)).toBe(true);
    expect(esVigente(docs[0], docs)).toBe(false);
    expect(esVigente(docs[2], docs)).toBe(false);
  });

  it('al eliminar la vigente, la anterior pasa a ser vigente (estado 100% derivado)', () => {
    const sinB = docs.filter((d) => d.id !== 'b');
    expect(vigentePorCod(sinB).get('IE1')?.id).toBe('c');
  });

  it('proximaRev sugiere (mayor rev)+1, y 0 para el primer documento del cod', () => {
    expect(proximaRev(docs, 'IE1')).toBe(3);
    expect(proximaRev(docs, 'TP1')).toBe(1);
    expect(proximaRev(docs, 'CAMAD3')).toBe(0);
    expect(proximaRev([], 'IE1')).toBe(0);
  });
});

describe('agrupación por grupo del catálogo', () => {
  it('agrupa en el orden del catálogo, vigente primero, y manda cods huérfanos a "Sin grupo"', () => {
    const docs: DocumentoObra[] = [
      doc({ id: '1', cod: 'IE1', rev: 0 }),
      doc({ id: '2', cod: 'IE1', rev: 1 }),
      doc({ id: '3', cod: 'TP2', rev: 0 }),
      doc({ id: '4', cod: 'XX1', rev: 0 }) // ya no está en el catálogo
    ];
    const g = agruparDocs(docs, TIPOS);
    expect(g.map((x) => x.grupo)).toEqual(['Trabajos Preliminares', 'Instalacion Electrica', 'Sin grupo']);
    const ie = g[1].cods[0];
    expect(ie.cod).toBe('IE1');
    expect(ie.tipo?.den).toBe('Esquema Unifilar');
    expect(ie.vigente.id).toBe('2');
    expect(ie.revisiones.map((r) => r.id)).toEqual(['2', '1']); // vigente primero
    expect(g[2].cods[0].tipo).toBeUndefined();
  });

  it('ordenGrupos devuelve los grupos del catálogo sin repetir y en orden', () => {
    expect(ordenGrupos(TIPOS)).toEqual(['Trabajos Preliminares', 'Instalacion Electrica', 'Carpinterias']);
    expect(ordenGrupos([])).toEqual([]);
  });
});

describe('autor, KPIs y nombre estándar', () => {
  it('ultimoAutor devuelve el del documento registrado más recientemente (ignora vacíos)', () => {
    const docs = [
      doc({ id: '1', cod: 'IE1', rev: 0, autor: 'MB' }),
      doc({ id: '2', cod: 'TP1', rev: 0, autor: 'JP' }),
      doc({ id: '3', cod: 'TP2', rev: 0, autor: '  ' })
    ];
    expect(ultimoAutor(docs)).toBe('JP');
    expect(ultimoAutor([])).toBe('');
  });

  it('kpisDocumentos: revisiones totales, vigentes por cod y grupos cubiertos', () => {
    const docs = [
      doc({ id: '1', cod: 'IE1', rev: 0 }),
      doc({ id: '2', cod: 'IE1', rev: 1 }),
      doc({ id: '3', cod: 'TP1', rev: 0 }),
      doc({ id: '4', cod: 'TP2', rev: 0 })
    ];
    expect(kpisDocumentos(docs, TIPOS)).toEqual({
      registrados: 4,
      vigentes: 3,
      gruposCubiertos: 2, // Trabajos Preliminares + Instalacion Electrica
      gruposTotal: 3
    });
    expect(kpisDocumentos([], TIPOS)).toEqual({
      registrados: 0,
      vigentes: 0,
      gruposCubiertos: 0,
      gruposTotal: 3
    });
  });

  it('nombreEstandar arma {COD}_R{rev}_{denominación-slug} (sin acentos ni símbolos)', () => {
    expect(nombreEstandar('IE1', 2, 'Esquema Unifilar')).toBe('IE1_R2_esquema-unifilar');
    expect(nombreEstandar('MT4', 0, 'Excavación De Bases Y/O Cimientos')).toBe(
      'MT4_R0_excavacion-de-bases-y-o-cimientos'
    );
    expect(slugDen('  HºAº — Losas / Vigas  ')).toBe('h-a-losas-vigas');
    expect(nombreEstandar('ZZ1', 1, '')).toBe('ZZ1_R1');
  });
});
