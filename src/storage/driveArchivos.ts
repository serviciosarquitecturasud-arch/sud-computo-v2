/**
 * Archivos por obra en Google Drive (sección ARCHIVOS del panel de obra).
 *
 * Estructura en Drive:  SUD Cómputo v2 / Archivos / <nombre de obra>
 * (siempre bajo CARPETA_RAIZ v2 — nunca la carpeta legacy, ver driveClient).
 *
 * El id de la carpeta de la obra se cachea en obra.archivosDriveFolderId:
 * el modelo Obra tiene index signature, así que el campo viaja passthrough
 * por la persistencia sin tocar el núcleo.
 */
import type { Obra } from '../core';
import { requerirToken } from './googleAuth';
import {
  CARPETA_RAIZ,
  SUBCARPETA_ARCHIVOS,
  buscarOCrearCarpeta,
  carpetaVigente,
  driveApi,
  obtenerCarpetaRaiz,
  queryArchivos,
  subirMultipart,
  type DriveFileMeta
} from './driveClient';

/** Campo (passthrough) de Obra donde se guarda el id de su carpeta de Drive. */
export const CAMPO_FOLDER_ID = 'archivosDriveFolderId';

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mimeType: string;
  tamano: number; // bytes (0 para Google Docs nativos)
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
}

/** Nombre de la carpeta de la obra en Drive (puro, testeable). */
export function nombreCarpetaObra(obra: Pick<Obra, 'id' | 'nombre'>): string {
  const nombre = (obra.nombre ?? '').trim();
  return nombre || obra.id;
}

/** Ruta completa de carpetas (puro, testeable): raíz v2 → Archivos → obra. */
export function rutaCarpetaObra(obra: Pick<Obra, 'id' | 'nombre'>): string[] {
  return [CARPETA_RAIZ, SUBCARPETA_ARCHIVOS, nombreCarpetaObra(obra)];
}

/**
 * Asegura la carpeta de la obra. Usa obra.archivosDriveFolderId si sigue vigente;
 * si no, crea/encuentra la cadena raíz → Archivos → obra. El caller debe persistir
 * el id devuelto en la obra (setObra) para no repetir búsquedas.
 */
export async function asegurarCarpetaObra(obra: Obra): Promise<string> {
  const token = requerirToken();
  const cacheado = obra[CAMPO_FOLDER_ID];
  if (typeof cacheado === 'string' && cacheado && (await carpetaVigente(token, cacheado))) {
    return cacheado;
  }
  const raizId = await obtenerCarpetaRaiz(token);
  const archivosId = await buscarOCrearCarpeta(token, SUBCARPETA_ARCHIVOS, raizId);
  return buscarOCrearCarpeta(token, nombreCarpetaObra(obra), archivosId);
}

/** Lista los archivos de la carpeta de la obra, más reciente primero. */
export async function listarArchivos(folderId: string): Promise<ArchivoDrive[]> {
  const token = requerirToken();
  const q = encodeURIComponent(queryArchivos(folderId));
  const r = await driveApi<{ files: DriveFileMeta[] }>(
    token,
    'GET',
    `/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)&orderBy=modifiedTime desc&pageSize=200`
  );
  return (r?.files ?? []).map((f) => ({
    id: f.id,
    nombre: f.name,
    mimeType: f.mimeType ?? '',
    tamano: Number(f.size ?? 0),
    modifiedTime: f.modifiedTime ?? '',
    webViewLink: f.webViewLink ?? '',
    iconLink: f.iconLink ?? ''
  }));
}

/** Sube un archivo (cualquier tipo: PDF/DWG/RVT/SKP/imágenes…) a la carpeta de la obra. */
export async function subirArchivo(folderId: string, archivo: File): Promise<DriveFileMeta> {
  const token = requerirToken();
  const metadata = { name: archivo.name, parents: [folderId] };
  const mime = archivo.type || 'application/octet-stream';
  return subirMultipart(token, metadata, archivo, mime);
}

/** Manda un archivo a la papelera de Drive (recuperable desde Drive). */
export async function borrarArchivo(fileId: string): Promise<void> {
  const token = requerirToken();
  await driveApi(token, 'PATCH', `/files/${fileId}`, { trashed: true });
}

/** Link de preview embebible (iframe) de Drive. */
export function linkPreview(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** ¿Se puede previsualizar inline en nuestro modal? (PDF e imágenes) */
export function esPrevisualizable(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}
