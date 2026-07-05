/**
 * Autenticación con Google Identity Services (GIS), portada del legacy
 * (docs/index.html, HITO 32/36). Flujo implicit (token directo, sin secret),
 * scope drive.file: la app solo ve los archivos que ella misma creó.
 *
 * Diferencias deliberadas con el legacy:
 *  - El script GIS se carga on-demand (inyección de <script>) al conectar,
 *    no en el arranque de la app.
 *  - El token vive SOLO en memoria (el legacy usaba sessionStorage). En la
 *    fase de convivencia de las dos apps preferimos que la v2 arranque
 *    siempre desconectada y el usuario decida cuándo conectar.
 */
import { useEffect, useState } from 'react';

/** CLIENT_ID y scope EXACTOS del legacy (misma app OAuth de Google Cloud). */
export const GOOGLE_CLIENT_ID =
  '160679013419-m98o85bh6c2imhk4qn5eubtnt4fa0vat.apps.googleusercontent.com';
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/* ---- Tipos mínimos de GIS (no agregamos @types de terceros) ---- */
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(cfg?: { prompt?: string }): void;
}
interface GisOauth2 {
  initTokenClient(cfg: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: unknown) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOauth2 } };
  }
}

interface TokenInfo {
  accessToken: string;
  /** epoch ms; ya incluye margen de 60s */
  expiraEn: number;
  email: string;
}

let token: TokenInfo | null = null;
let tokenClient: TokenClient | null = null;
let gisPromise: Promise<GisOauth2> | null = null;
let pendiente: { resolver: () => void; rechazar: (e: Error) => void } | null = null;
const listeners = new Set<() => void>();

function emitir() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener roto: no frena al resto */
    }
  });
}

/** Carga el script GIS on-demand (una sola vez) y espera a que exponga oauth2. */
function cargarGis(): Promise<GisOauth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<GisOauth2>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      // onload puede llegar un tick antes de que google.accounts exista
      let intentos = 0;
      const chequear = () => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (oauth2) return resolve(oauth2);
        if (++intentos > 100) return reject(new Error('GIS cargó pero no expone oauth2'));
        setTimeout(chequear, 100);
      };
      chequear();
    };
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('No se pudo cargar el script de Google (¿sin conexión?)'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

async function alRecibirToken(resp: TokenResponse) {
  if (resp.error || !resp.access_token) {
    const e = new Error('Google rechazó el acceso: ' + (resp.error ?? 'sin token'));
    pendiente?.rechazar(e);
    pendiente = null;
    emitir();
    return;
  }
  // Email del usuario (best-effort, para mostrar en la UI)
  let email = '';
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + resp.access_token }
    });
    if (r.ok) email = ((await r.json()) as { email?: string }).email ?? '';
  } catch {
    /* sin email no pasa nada */
  }
  token = {
    accessToken: resp.access_token,
    expiraEn: Date.now() + ((resp.expires_in ?? 3600) - 60) * 1000, // margen 60s
    email
  };
  pendiente?.resolver();
  pendiente = null;
  emitir();
}

/** Abre el popup de Google y resuelve cuando hay token (o rechaza si falla/cancela). */
export async function conectar(): Promise<void> {
  const oauth2 = await cargarGis();
  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      callback: (resp) => void alRecibirToken(resp),
      error_callback: (err) => {
        pendiente?.rechazar(
          err instanceof Error ? err : new Error('Login cancelado o bloqueado')
        );
        pendiente = null;
        emitir();
      }
    });
  }
  return new Promise<void>((resolver, rechazar) => {
    pendiente = { resolver, rechazar };
    // 'consent' solo la primera vez de la sesión; después renueva en silencio
    tokenClient!.requestAccessToken({ prompt: token ? '' : 'consent' });
  });
}

/** Revoca el token y borra el estado en memoria. */
export function desconectar(): void {
  const t = token;
  token = null;
  if (t) {
    try {
      window.google?.accounts?.oauth2?.revoke(t.accessToken, () => undefined);
    } catch {
      /* revoke best-effort */
    }
  }
  emitir();
}

export function estaAutenticado(): boolean {
  return !!token && token.expiraEn > Date.now();
}

export function getAccessToken(): string | null {
  return estaAutenticado() ? token!.accessToken : null;
}

export function getEmail(): string | null {
  return token?.email || null;
}

/** Token obligatorio para operaciones de Drive; error claro si no hay sesión. */
export function requerirToken(): string {
  const t = getAccessToken();
  if (!t) throw new Error('No hay sesión de Google activa (conectá tu cuenta primero).');
  return t;
}

export function suscribir(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook React: estado de la sesión de Google (se actualiza al conectar/desconectar). */
export function useGoogleAuth(): { autenticado: boolean; email: string | null } {
  const [estado, setEstado] = useState(() => ({
    autenticado: estaAutenticado(),
    email: getEmail()
  }));
  useEffect(
    () => suscribir(() => setEstado({ autenticado: estaAutenticado(), email: getEmail() })),
    []
  );
  return estado;
}
