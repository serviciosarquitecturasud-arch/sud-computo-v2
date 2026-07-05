/**
 * Configuración del modo nube (H7 — Supabase).
 *
 * PRINCIPIO RECTOR: si VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están
 * definidas en build, la app corre en modo local EXACTAMENTE como siempre
 * (localStorage + Drive), sin login. Este módulo es el único que decide eso.
 *
 * La anon key es pública por diseño (viaja en el bundle): la seguridad real
 * la dan las políticas RLS de Postgres (ver supabase/schema.sql).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_NUBE: string | undefined = import.meta.env?.VITE_SUPABASE_URL;
const ANON_KEY: string | undefined = import.meta.env?.VITE_SUPABASE_ANON_KEY;

/** true solo si AMBAS variables están definidas y no vacías en build. */
export function cloudHabilitado(): boolean {
  return Boolean(URL_NUBE && ANON_KEY);
}

let cliente: SupabaseClient | null = null;

/**
 * Cliente Supabase (singleton, creación perezosa).
 * Llamar SOLO cuando cloudHabilitado() es true; si no, lanza con mensaje claro.
 */
export function getSupabase(): SupabaseClient {
  if (!URL_NUBE || !ANON_KEY) {
    throw new Error(
      'Modo nube no configurado: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
    );
  }
  if (!cliente) {
    cliente = createClient(URL_NUBE, ANON_KEY);
  }
  return cliente;
}
