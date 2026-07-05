/**
 * H7 — modo nube: config, SupabaseAdapter y migración local → nube.
 * Corre en node SIN variables de entorno y SIN red: el cliente Supabase se
 * simula con un mock en memoria que replica las cadenas usadas por el código
 * (from().select().eq()[.maybeSingle()], upsert(), delete().in().eq()).
 */
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Catalogo, Obra } from '../src/core/types';
import { cloudHabilitado, getSupabase } from '../src/cloud/config';
import { SupabaseAdapter } from '../src/cloud/supabaseAdapter';
import { migrarLocalANube } from '../src/cloud/auth';

// ---------------------------------------------------------------------------
// Mock del cliente Supabase (Postgres en memoria)
// ---------------------------------------------------------------------------

type Fila = Record<string, unknown>;

/** Clave primaria por tabla (igual que supabase/schema.sql). */
const PK: Record<string, string> = { catalogos: 'user_id', obras: 'id', revit_maps: 'user_id' };

interface Resultado<T> {
  data: T;
  error: null;
}

function crearMock() {
  const tablas: Record<string, Fila[]> = { catalogos: [], obras: [], revit_maps: [] };
  const llamadas: string[] = [];

  function proyectar(fila: Fila, cols: string): Fila {
    if (cols === '*') return fila;
    const out: Fila = {};
    for (const c of cols.split(',').map((s) => s.trim())) out[c] = fila[c];
    return out;
  }

  const client = {
    from(tabla: string) {
      return {
        select(cols: string) {
          llamadas.push(`select:${tabla}`);
          const filtros: [string, unknown][] = [];
          const filas = () =>
            tablas[tabla]
              .filter((f) => filtros.every(([col, val]) => f[col] === val))
              .map((f) => proyectar(f, cols));
          const builder = {
            eq(col: string, val: unknown) {
              filtros.push([col, val]);
              return builder;
            },
            maybeSingle(): Promise<Resultado<Fila | null>> {
              return Promise.resolve({ data: filas()[0] ?? null, error: null });
            },
            then<R>(res: (v: Resultado<Fila[]>) => R) {
              return Promise.resolve({ data: filas(), error: null }).then(res);
            }
          };
          return builder;
        },
        upsert(valores: Fila | Fila[]) {
          llamadas.push(`upsert:${tabla}`);
          const pk = PK[tabla];
          for (const fila of Array.isArray(valores) ? valores : [valores]) {
            const i = tablas[tabla].findIndex((f) => f[pk] === fila[pk]);
            if (i >= 0) tablas[tabla][i] = { ...tablas[tabla][i], ...fila };
            else tablas[tabla].push({ ...fila });
          }
          return Promise.resolve({ data: null, error: null });
        },
        delete() {
          llamadas.push(`delete:${tabla}`);
          const filtros: [string, unknown][] = [];
          const aplicar = () => {
            tablas[tabla] = tablas[tabla].filter(
              (f) =>
                !filtros.every(([col, val]) =>
                  Array.isArray(val) ? (val as unknown[]).includes(f[col]) : f[col] === val
                )
            );
          };
          const builder = {
            in(col: string, vals: unknown[]) {
              filtros.push([col, vals]);
              return builder;
            },
            eq(col: string, val: unknown) {
              filtros.push([col, val]);
              return builder;
            },
            then<R>(res: (v: Resultado<null>) => R) {
              aplicar();
              return Promise.resolve({ data: null, error: null } as Resultado<null>).then(res);
            }
          };
          return builder;
        }
      };
    }
  };

  return { client: client as unknown as SupabaseClient, tablas, llamadas };
}

// ---------------------------------------------------------------------------
// Datos de prueba con campos extra (regla passthrough)
// ---------------------------------------------------------------------------

const USER = 'u-123';

const catDemo = {
  materiales: [{ cod: 'M1', desc: 'Cemento', unidad: 'kg', precio: 10, div: 'X', desp: 5, pres1: 'bolsa', fac1: 50, pres2: '', fac2: 0 }],
  manoObra: [],
  herramientas: [],
  rubros: [],
  biblioteca: [],
  deletedApus: ['R9'],
  apusEditados: [],
  divisiones: ['X'],
  campoFuturo: { inventado: true, n: 42 }
} as unknown as Catalogo;

function obraDemo(id: string, extra: Record<string, unknown> = {}): Obra {
  return {
    id,
    nombre: `Obra ${id}`,
    comitente: 'Cliente',
    direccion: 'Calle 1',
    items: [{ cod: 'R1', cant: 2, notaRara: 'pasa intacta' }],
    coef: { ggd: 1, ggi: 2, imp: 3, ben: 4, iva: 0, iib: 5 },
    creada: '2026-01-01T00:00:00.000Z',
    ...extra
  } as unknown as Obra;
}

// ---------------------------------------------------------------------------

describe('cloud/config — modo local por defecto', () => {
  it('cloudHabilitado() es false sin variables de entorno', () => {
    expect(cloudHabilitado()).toBe(false);
  });

  it('getSupabase() lanza con mensaje claro si no hay configuración', () => {
    expect(() => getSupabase()).toThrowError(/VITE_SUPABASE_URL/);
  });
});

describe('SupabaseAdapter — mapeo filas ↔ Catalogo/Obra[]', () => {
  it('round-trip de catálogo con campos extra intactos', async () => {
    const { client, tablas } = crearMock();
    const adapter = new SupabaseAdapter(client, USER);

    expect(await adapter.loadCatalogo()).toBeNull(); // sin fila todavía
    await adapter.saveCatalogo(catDemo);

    expect(tablas.catalogos).toHaveLength(1);
    expect(tablas.catalogos[0].user_id).toBe(USER);
    expect(await adapter.loadCatalogo()).toEqual(catDemo); // passthrough exacto
  });

  it('round-trip de 2 obras con campos extra intactos', async () => {
    const { client, tablas } = crearMock();
    const adapter = new SupabaseAdapter(client, USER);

    const o1 = obraDemo('ob1', { cotizacionesPorRubro: { R1: [{ prov: 'A', precio: 9 }] } });
    const o2 = obraDemo('ob2', { revitVinculo: { archivo: 'x.rvt' } });
    await adapter.saveObras([o1, o2]);

    expect(tablas.obras.map((f) => f.id).sort()).toEqual(['ob1', 'ob2']);
    expect(tablas.obras.every((f) => f.user_id === USER)).toBe(true);
    expect(await adapter.loadObras()).toEqual([o1, o2]); // passthrough exacto
  });

  it('round-trip de mapa Revit', async () => {
    const { client } = crearMock();
    const adapter = new SupabaseAdapter(client, USER);
    const mapa = { 'Muro básico': 'R12' };
    await adapter.saveRevitMap(mapa);
    expect(await adapter.loadRevitMap()).toEqual(mapa);
  });

  it('saveObras borra de la nube las obras eliminadas', async () => {
    const { client, tablas, llamadas } = crearMock();
    const adapter = new SupabaseAdapter(client, USER);

    const o1 = obraDemo('ob1');
    const o2 = obraDemo('ob2');
    await adapter.saveObras([o1, o2]);
    expect(tablas.obras).toHaveLength(2);

    // Se eliminó ob2 localmente → el próximo save la borra de la nube.
    await adapter.saveObras([o1]);
    expect(tablas.obras.map((f) => f.id)).toEqual(['ob1']);
    expect(await adapter.loadObras()).toEqual([o1]);
    expect(llamadas.filter((l) => l === 'delete:obras')).toHaveLength(1);
  });

  it('saveObras sin cambios no ejecuta deletes', async () => {
    const { client, llamadas } = crearMock();
    const adapter = new SupabaseAdapter(client, USER);
    await adapter.saveObras([obraDemo('ob1')]);
    expect(llamadas.filter((l) => l === 'delete:obras')).toHaveLength(0);
  });
});

describe('migrarLocalANube', () => {
  it('NO pisa datos existentes en la nube (devuelve false y no escribe)', async () => {
    const { client, tablas, llamadas } = crearMock();
    const datosNube = { ...catDemo, marcador: 'datos-de-la-nube' };
    tablas.catalogos.push({ user_id: USER, data: datosNube });
    tablas.obras.push({ id: 'ob-nube', user_id: USER, data: obraDemo('ob-nube') });

    const migro = await migrarLocalANube(client, USER);

    expect(migro).toBe(false);
    expect(tablas.catalogos[0].data).toEqual(datosNube); // intacto
    expect(tablas.obras).toHaveLength(1);
    expect(llamadas.filter((l) => l.startsWith('upsert'))).toHaveLength(0);
  });

  it('primera vez sin datos locales: sube el SEED expandido', async () => {
    // En node no hay localStorage → equivale a un usuario invitado nuevo.
    const { client, tablas } = crearMock();

    const migro = await migrarLocalANube(client, USER);

    expect(migro).toBe(true);
    expect(tablas.catalogos).toHaveLength(1);
    const cat = tablas.catalogos[0].data as Catalogo;
    expect(cat.materiales.length).toBeGreaterThan(0); // SEED expandido
    expect(cat.rubros.length).toBeGreaterThan(0);
    expect(tablas.obras).toHaveLength(0); // sin obras locales
    expect(tablas.revit_maps).toHaveLength(1);
  });
});
