/**
 * Cliente Google Drive v3 — helpers compartidos por driveSync (respaldos) y
 * driveArchivos (archivos por obra). Sin dependencias: fetch + multipart a mano,
 * portado del legacy (docs/index.html, HITO 33).
 *
 * Las funciones puras (queries, multipart, prune) están separadas de las que
 * hacen red para poder testearlas sin mocks pesados (tests/drive.test.ts).
 */

/**
 * REGLA DE SEGURIDAD INNEGOCIABLE — carpeta raíz de la app v2 en Drive.
 *
 * La app legacy en producción usa la carpeta "SUD Cómputo" y su cadena de
 * respaldos NO SE TOCA hasta el switchover definitivo. Por eso la v2 escribe
 * y lista EXCLUSIVAMENTE dentro de "SUD Cómputo v2" (esta constante es el
 * único lugar donde se define ese nombre). Nunca renombrar a "SUD Cómputo"
 * ni apuntar código v2 a la carpeta legacy.
 */
export const CARPETA_RAIZ = 'SUD Cómputo v2';

/** Nombre de la carpeta legacy — SOLO para asserts/tests de que no la usamos. */
export const CARPETA_LEGACY_PROHIBIDA = 'SUD Cómputo';

/** Subcarpeta de la raíz que agrupa los archivos por obra. */
export const SUBCARPETA_ARCHIVOS = 'Archivos';

export const MIME_CARPETA = 'application/vnd.google-apps.folder';

const API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/** Metadatos mínimos que pedimos a Drive para archivos. */
export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  trashed?: boolean;
}

/* ============================ Funciones puras ============================ */

/** Escapa un valor para usarlo dentro de comillas simples en una query de Drive. */
export function escaparQuery(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Query para buscar una carpeta por nombre (opcionalmente dentro de un padre). */
export function queryCarpeta(nombre: string, parentId?: string): string {
  const partes = [
    `name='${escaparQuery(nombre)}'`,
    `mimeType='${MIME_CARPETA}'`,
    'trashed=false'
  ];
  if (parentId) partes.push(`'${escaparQuery(parentId)}' in parents`);
  return partes.join(' and ');
}

/** Query para listar los respaldos JSON dentro de la carpeta raíz. */
export function queryRespaldos(folderId: string): string {
  return `'${escaparQuery(folderId)}' in parents and trashed=false and mimeType='application/json'`;
}

/** Query para listar los archivos (no carpetas) de una carpeta de obra. */
export function queryArchivos(folderId: string): string {
  return `'${escaparQuery(folderId)}' in parents and trashed=false and mimeType!='${MIME_CARPETA}'`;
}

/**
 * Arma el cuerpo multipart/related para subir a Drive (metadata JSON + contenido).
 * Devuelve Blob para soportar binarios (PDF/DWG/RVT/SKP/imágenes) sin corromperlos.
 */
export function construirMultipart(
  metadata: object,
  contenido: Blob | string,
  mimeType: string,
  boundary = 'sud_v2_boundary_' + Date.now()
): { body: Blob; contentType: string } {
  const delim = `\r\n--${boundary}\r\n`;
  const cierre = `\r\n--${boundary}--`;
  const body = new Blob([
    delim,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    delim,
    `Content-Type: ${mimeType}\r\n\r\n`,
    contenido,
    cierre
  ]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

/**
 * Prune: dado el listado completo, devuelve los archivos a borrar para quedarse
 * con los `max` más recientes (por createdTime descendente).
 */
export function seleccionarParaPrune<T extends { createdTime?: string }>(
  archivos: T[],
  max: number
): T[] {
  const orden = [...archivos].sort((a, b) =>
    (b.createdTime ?? '').localeCompare(a.createdTime ?? '')
  );
  return orden.slice(max);
}

/* ============================ Llamadas de red ============================ */

/** Llamada genérica a la API REST de Drive v3. Lanza Error si la respuesta no es ok. */
export async function driveApi<T = unknown>(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: object
): Promise<T | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const resp = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (resp.status === 204) return null; // DELETE ok
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Drive API ${method} ${path}: ${resp.status} ${txt}`);
  }
  return (await resp.json()) as T;
}

/** Subida multipart (archivo nuevo). Devuelve los metadatos del archivo creado. */
export async function subirMultipart(
  token: string,
  metadata: object,
  contenido: Blob | string,
  mimeType: string
): Promise<DriveFileMeta> {
  const { body, contentType } = construirMultipart(metadata, contenido, mimeType);
  const resp = await fetch(
    `${UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body
    }
  );
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Drive upload: ${resp.status} ${txt}`);
  }
  return (await resp.json()) as DriveFileMeta;
}

/** ¿Existe la carpeta (y no está en la papelera)? */
export async function carpetaVigente(token: string, folderId: string): Promise<boolean> {
  try {
    const r = await driveApi<DriveFileMeta>(token, 'GET', `/files/${folderId}?fields=id,trashed`);
    return !!r && !r.trashed;
  } catch {
    return false;
  }
}

/** Busca una carpeta por nombre (y padre opcional); si no existe la crea. Devuelve su id. */
export async function buscarOCrearCarpeta(
  token: string,
  nombre: string,
  parentId?: string
): Promise<string> {
  const q = encodeURIComponent(queryCarpeta(nombre, parentId));
  const res = await driveApi<{ files: DriveFileMeta[] }>(
    token,
    'GET',
    `/files?q=${q}&fields=files(id,name)&pageSize=10`
  );
  if (res?.files?.length) return res.files[0].id;
  const meta: Record<string, unknown> = { name: nombre, mimeType: MIME_CARPETA };
  if (parentId) meta.parents = [parentId];
  const creada = await driveApi<DriveFileMeta>(token, 'POST', '/files', meta);
  if (!creada) throw new Error('Drive no devolvió la carpeta creada');
  return creada.id;
}

/**
 * Carpeta raíz "SUD Cómputo v2" con caché del id en localStorage.
 * Clave propia de la v2 (cmp_v2_*) — NO reutiliza cmp_drive_folder_id del legacy,
 * que apunta a la carpeta de producción.
 */
const CLAVE_CARPETA_RAIZ = 'cmp_v2_drive_folder_id';

export async function obtenerCarpetaRaiz(token: string): Promise<string> {
  try {
    const cache = localStorage.getItem(CLAVE_CARPETA_RAIZ);
    if (cache && (await carpetaVigente(token, cache))) return cache;
  } catch {
    /* localStorage inaccesible: seguimos sin caché */
  }
  const id = await buscarOCrearCarpeta(token, CARPETA_RAIZ);
  try {
    localStorage.setItem(CLAVE_CARPETA_RAIZ, id);
  } catch {
    /* sin caché */
  }
  return id;
}
