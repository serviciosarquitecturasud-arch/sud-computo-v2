/// <reference types="vite/client" />

/**
 * Tipado de las variables de entorno de Vite usadas por la app.
 * Si VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están definidas en build,
 * la app corre en modo local (localStorage + Drive), sin login.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
