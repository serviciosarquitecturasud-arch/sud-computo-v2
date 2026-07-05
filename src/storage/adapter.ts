/**
 * Capa de persistencia abstraída.
 *
 * H0: LocalStorageAdapter (mismas claves y formato que la app legacy —
 *     cmp_catalogo, cmp_obras, cmp_revitMap — para compatibilidad total).
 * H3: DriveAdapter (sync con Google Drive, mismo formato de respaldo).
 * H7: CloudAdapter (Supabase: auth + Postgres multiusuario).
 *
 * Regla: los adapters son PASSTHROUGH — guardan y devuelven el JSON completo
 * sin filtrar campos. Campos que el núcleo no conoce (cotizacionesPorRubro,
 * revitVinculo, etc.) se preservan intactos.
 */
import type { Catalogo, Obra } from '../core/types';

export interface StorageAdapter {
  loadCatalogo(): Promise<Catalogo | null>;
  saveCatalogo(cat: Catalogo): Promise<void>;
  loadObras(): Promise<Obra[] | null>;
  saveObras(obras: Obra[]): Promise<void>;
  loadRevitMap(): Promise<Record<string, string> | null>;
  saveRevitMap(map: Record<string, string>): Promise<void>;
}

/** Claves legacy — NO CAMBIAR: comparten datos con la app en producción. */
export const KEYS = {
  catalogo: 'cmp_catalogo',
  obras: 'cmp_obras',
  revitMap: 'cmp_revitMap'
} as const;
