/**
 * Adapter de persistencia contra Supabase/Postgres (H7 — modo nube).
 *
 * Tablas (ver supabase/schema.sql):
 *   catalogos  — user_id uuid PK → auth.users, data jsonb, updated_at
 *   obras      — id text PK (usa obra.id existente), user_id uuid, data jsonb, updated_at
 *   revit_maps — user_id uuid PK, data jsonb, updated_at
 *
 * Regla passthrough: el JSON completo va en la columna `data` sin filtrar
 * campos — igual que LocalStorageAdapter. Campos que el núcleo no conoce
 * (cotizacionesPorRubro, revitVinculo, etc.) se preservan intactos.
 *
 * Manejo de errores:
 *   - loads: en fallo (red, RLS, etc.) loguean y devuelven null → la app
 *     arranca con SEED sin romperse.
 *   - saves: propagan un Error con mensaje claro en español, para que el
 *     llamador pueda avisar que el cambio NO quedó en la nube.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Catalogo, Obra } from '../core/types';
import type { StorageAdapter } from '../storage/adapter';

/** Forma del error que devuelven las consultas de supabase-js. */
interface ErrorPg {
  message?: string;
}

function mensajeDe(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as ErrorPg).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e);
}

export class SupabaseAdapter implements StorageAdapter {
  constructor(
    private client: SupabaseClient,
    private userId: string
  ) {}

  /** Error de guardado con contexto claro — nunca lanzamos sin mensaje. */
  private errorGuardado(que: string, e: unknown): Error {
    return new Error(`No se pudo guardar ${que} en la nube: ${mensajeDe(e)}`);
  }

  // --- Catálogo (una fila por usuario) ------------------------------------

  async loadCatalogo(): Promise<Catalogo | null> {
    try {
      const { data, error } = await this.client
        .from('catalogos')
        .select('data')
        .eq('user_id', this.userId)
        .maybeSingle();
      if (error) {
        console.error('No se pudo leer el catálogo de la nube:', mensajeDe(error));
        return null;
      }
      return (data?.data as Catalogo | undefined) ?? null;
    } catch (e) {
      console.error('Sin conexión al leer el catálogo de la nube:', mensajeDe(e));
      return null;
    }
  }

  async saveCatalogo(cat: Catalogo): Promise<void> {
    let error: unknown;
    try {
      ({ error } = await this.client
        .from('catalogos')
        .upsert({ user_id: this.userId, data: cat }));
    } catch (e) {
      throw this.errorGuardado('el catálogo', e);
    }
    if (error) throw this.errorGuardado('el catálogo', error);
  }

  // --- Obras (una fila por obra, PK = obra.id) ----------------------------

  async loadObras(): Promise<Obra[] | null> {
    try {
      const { data, error } = await this.client
        .from('obras')
        .select('id, data')
        .eq('user_id', this.userId);
      if (error) {
        console.error('No se pudieron leer las obras de la nube:', mensajeDe(error));
        return null;
      }
      if (!data) return null;
      return (data as { id: string; data: Obra }[]).map((fila) => fila.data);
    } catch (e) {
      console.error('Sin conexión al leer las obras de la nube:', mensajeDe(e));
      return null;
    }
  }

  async saveObras(obras: Obra[]): Promise<void> {
    try {
      // 1. IDs existentes en la nube, para detectar obras eliminadas.
      const { data: existentes, error: errSel } = await this.client
        .from('obras')
        .select('id')
        .eq('user_id', this.userId);
      if (errSel) throw errSel;

      // 2. Upsert fila por fila (en un solo llamado) de las obras vigentes.
      if (obras.length > 0) {
        const filas = obras.map((o) => ({ id: o.id, user_id: this.userId, data: o }));
        const { error: errUp } = await this.client.from('obras').upsert(filas);
        if (errUp) throw errUp;
      }

      // 3. Borrar de la nube las que ya no están localmente.
      const vigentes = new Set(obras.map((o) => o.id));
      const aBorrar = ((existentes as { id: string }[] | null) ?? [])
        .map((f) => f.id)
        .filter((id) => !vigentes.has(id));
      if (aBorrar.length > 0) {
        const { error: errDel } = await this.client
          .from('obras')
          .delete()
          .in('id', aBorrar)
          .eq('user_id', this.userId);
        if (errDel) throw errDel;
      }
    } catch (e) {
      throw this.errorGuardado('las obras', e);
    }
  }

  // --- Mapa Revit (una fila por usuario) ----------------------------------

  async loadRevitMap(): Promise<Record<string, string> | null> {
    try {
      const { data, error } = await this.client
        .from('revit_maps')
        .select('data')
        .eq('user_id', this.userId)
        .maybeSingle();
      if (error) {
        console.error('No se pudo leer el mapa Revit de la nube:', mensajeDe(error));
        return null;
      }
      return (data?.data as Record<string, string> | undefined) ?? null;
    } catch (e) {
      console.error('Sin conexión al leer el mapa Revit de la nube:', mensajeDe(e));
      return null;
    }
  }

  async saveRevitMap(map: Record<string, string>): Promise<void> {
    let error: unknown;
    try {
      ({ error } = await this.client
        .from('revit_maps')
        .upsert({ user_id: this.userId, data: map }));
    } catch (e) {
      throw this.errorGuardado('el mapa Revit', e);
    }
    if (error) throw this.errorGuardado('el mapa Revit', error);
  }
}
