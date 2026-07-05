/**
 * Autenticación email/contraseña contra Supabase (H7 — modo nube).
 *
 * Registro controlado por invitación: NO hay signup desde la app; los
 * usuarios se crean desde el dashboard de Supabase (ver INSTRUCTIVO).
 *
 * migrarLocalANube(): al primer login de un usuario sin datos en la nube,
 * sube lo que tenga en localStorage (o el SEED expandido si no hay nada).
 * Nunca pisa datos que ya existan en la nube.
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { SEED, expandSeed } from '../core';
import { KEYS } from '../storage/adapter';
import { mergeCatalogoConSeed, migrarObras } from '../state/bootstrap';
import { getSupabase } from './config';
import { SupabaseAdapter } from './supabaseAdapter';

/**
 * Inicia sesión con email/contraseña.
 * Devuelve null si salió bien, o un mensaje de error en español.
 */
export async function signIn(email: string, password: string): Promise<string | null> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (!error) return null;
    if (error.message.includes('Invalid login credentials')) {
      return 'Email o contraseña incorrectos.';
    }
    return `No se pudo iniciar sesión: ${error.message}`;
  } catch (e) {
    return `Sin conexión con el servidor: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Cierra la sesión actual. */
export async function signOut(): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } catch (e) {
    console.error('Error al cerrar sesión:', e);
  }
}

/** Sesión actual (null si no hay). */
export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

/** Suscripción a cambios de sesión. Devuelve la función para desuscribirse. */
export function onAuthStateChange(cb: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_evento, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** Lectura defensiva de localStorage (puede no existir o estar bloqueado). */
function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/**
 * Migración automática local → nube para el primer login de un usuario.
 *
 * Si el usuario YA tiene catálogo en la nube, no hace nada (devuelve false):
 * los datos de la nube mandan y lo local no los pisa. Si no tiene, sube el
 * catálogo local mergeado con el SEED (o el SEED expandido si no hay nada),
 * sus obras y su mapa Revit. Devuelve true si migró.
 *
 * `client` y `userId` son inyectables para poder testear sin red.
 */
export async function migrarLocalANube(client: SupabaseClient, userId: string): Promise<boolean> {
  // ¿Ya hay datos en la nube? Entonces no pisamos nada.
  const { data: existente, error } = await client
    .from('catalogos')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(`No se pudo verificar los datos en la nube: ${error.message ?? error}`);
  }
  if (existente) return false;

  // Primera vez: armar el estado inicial igual que el arranque local.
  const seedFresh = expandSeed(SEED);
  const cat = mergeCatalogoConSeed(leerLocal(KEYS.catalogo), seedFresh);
  const obras = migrarObras(leerLocal(KEYS.obras), cat);
  let revitMap: Record<string, string> = {};
  try {
    revitMap = JSON.parse(leerLocal(KEYS.revitMap) ?? '{}') as Record<string, string>;
  } catch {
    revitMap = {};
  }

  const adapter = new SupabaseAdapter(client, userId);
  await adapter.saveCatalogo(cat);
  await adapter.saveObras(obras);
  await adapter.saveRevitMap(revitMap);
  return true;
}
