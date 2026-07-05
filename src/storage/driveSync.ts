/**
 * Sync de respaldos a Google Drive (portado del legacy HITO 33, adaptado a v2).
 *
 * - Sube el MISMO JSON que exportRespaldo (RespaldoV2 de useAppData) a la
 *   carpeta raíz "SUD Cómputo v2" (ver driveClient.CARPETA_RAIZ — regla de
 *   seguridad: jamás la carpeta legacy "SUD Cómputo").
 * - Mantiene los últimos MAX_RESPALDOS (prune automático tras cada subida).
 * - Auto-sync con debounce de 30s, PERO apagado por defecto: a diferencia del
 *   legacy, el usuario tiene que activarlo en cada sesión (fase de convivencia
 *   de las dos apps: evitamos que la v2 respalde sola sin decisión explícita).
 */
import type { RespaldoV2 } from '../state/useAppData';
import { requerirToken } from './googleAuth';
import {
  driveApi,
  obtenerCarpetaRaiz,
  queryRespaldos,
  seleccionarParaPrune,
  subirMultipart,
  type DriveFileMeta
} from './driveClient';

export const MAX_RESPALDOS = 10;
export const PREFIJO_RESPALDO = 'sud_v2_backup_';
export const DEBOUNCE_MS = 30000;

export interface RespaldoDrive {
  id: string;
  nombre: string;
  fecha: string; // createdTime ISO
  tamano: number; // bytes
}

/** Nombre de archivo de respaldo: sud_v2_backup_2026-07-05_14-30-15.json */
export function nombreArchivoRespaldo(fecha = new Date()): string {
  const ts = fecha.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  return `${PREFIJO_RESPALDO}${ts}.json`;
}

/** Sube un respaldo ahora. Devuelve los metadatos del archivo creado. */
export async function subirRespaldo(data: RespaldoV2): Promise<{ id: string; name: string }> {
  const token = requerirToken();
  const folderId = await obtenerCarpetaRaiz(token);
  const metadata = {
    name: nombreArchivoRespaldo(),
    parents: [folderId],
    mimeType: 'application/json'
  };
  const creado = await subirMultipart(
    token,
    metadata,
    JSON.stringify(data, null, 2),
    'application/json'
  );
  await podarViejos().catch(() => undefined); // prune best-effort, no rompe la subida
  return { id: creado.id, name: creado.name };
}

/** Lista los respaldos de la carpeta v2, más reciente primero. */
export async function listarRespaldos(): Promise<RespaldoDrive[]> {
  const token = requerirToken();
  const folderId = await obtenerCarpetaRaiz(token);
  const q = encodeURIComponent(queryRespaldos(folderId));
  const r = await driveApi<{ files: DriveFileMeta[] }>(
    token,
    'GET',
    `/files?q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc&pageSize=50`
  );
  return (r?.files ?? []).map((f) => ({
    id: f.id,
    nombre: f.name,
    fecha: f.createdTime ?? '',
    tamano: Number(f.size ?? 0)
  }));
}

/** Descarga el contenido JSON de un respaldo (para restaurar vía importRespaldo). */
export async function descargarRespaldo(fileId: string): Promise<RespaldoV2> {
  const token = requerirToken();
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error(`Descarga falló: ${resp.status}`);
  return (await resp.json()) as RespaldoV2;
}

/** Borra los respaldos que exceden MAX_RESPALDOS (los más viejos). */
export async function podarViejos(): Promise<number> {
  const token = requerirToken();
  const lista = await listarRespaldos();
  const aBorrar = seleccionarParaPrune(
    lista.map((r) => ({ id: r.id, createdTime: r.fecha })),
    MAX_RESPALDOS
  );
  for (const f of aBorrar) {
    await driveApi(token, 'DELETE', `/files/${f.id}`).catch(() => undefined);
  }
  return aBorrar.length;
}

/* ============================ Auto-sync (debounce) ============================ */

/**
 * Debounce del auto-sync. `habilitado` arranca en false SIEMPRE (estado de
 * módulo, no persistido): el toggle de la UI vale solo para la sesión actual.
 */
export class DebounceSync {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _habilitado = false;

  constructor(private readonly delayMs: number = DEBOUNCE_MS) {}

  get habilitado(): boolean {
    return this._habilitado;
  }

  setHabilitado(v: boolean): void {
    this._habilitado = v;
    if (!v) this.cancelar();
  }

  /**
   * Llamar tras cada cambio de datos. Si el auto-sync está habilitado,
   * (re)programa `subir` para dentro de delayMs. Devuelve si quedó programado.
   */
  notificarCambio(subir: () => void): boolean {
    if (!this._habilitado) return false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      subir();
    }, this.delayMs);
    return true;
  }

  cancelar(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/** Instancia global de la app (default APAGADO — deliberado, ver cabecera). */
export const autoSync = new DebounceSync();
