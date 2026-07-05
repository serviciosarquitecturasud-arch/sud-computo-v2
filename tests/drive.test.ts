/**
 * Tests de la integración Google Drive (H3) — solo lógica pura y fetch mockeado,
 * sin red real: queries, multipart, elección de carpeta (regla de seguridad v2),
 * prune con fechas mock y gating del debounce de auto-sync.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARPETA_LEGACY_PROHIBIDA,
  CARPETA_RAIZ,
  MIME_CARPETA,
  SUBCARPETA_ARCHIVOS,
  construirMultipart,
  driveApi,
  escaparQuery,
  queryArchivos,
  queryCarpeta,
  queryRespaldos,
  seleccionarParaPrune,
  subirMultipart
} from '../src/storage/driveClient';
import { DebounceSync, MAX_RESPALDOS, nombreArchivoRespaldo } from '../src/storage/driveSync';
import {
  esPrevisualizable,
  linkPreview,
  nombreCarpetaObra,
  rutaCarpetaObra
} from '../src/storage/driveArchivos';

/* ============ Regla de seguridad: carpeta v2, jamás la legacy ============ */

describe('elección de carpeta (regla de seguridad)', () => {
  it('la carpeta raíz v2 es "SUD Cómputo v2" y NO la legacy de producción', () => {
    expect(CARPETA_RAIZ).toBe('SUD Cómputo v2');
    expect(CARPETA_LEGACY_PROHIBIDA).toBe('SUD Cómputo');
    expect(CARPETA_RAIZ).not.toBe(CARPETA_LEGACY_PROHIBIDA);
  });

  it('la query de carpeta raíz nunca matchea exactamente la carpeta legacy', () => {
    const q = queryCarpeta(CARPETA_RAIZ);
    expect(q).toContain("name='SUD Cómputo v2'");
    expect(q).not.toContain("name='SUD Cómputo'");
  });

  it('la ruta de archivos por obra cuelga de la raíz v2', () => {
    const obra = { id: 'ob1', nombre: 'Casa Pérez' };
    expect(rutaCarpetaObra(obra)).toEqual(['SUD Cómputo v2', 'Archivos', 'Casa Pérez']);
    expect(SUBCARPETA_ARCHIVOS).toBe('Archivos');
  });

  it('nombreCarpetaObra usa el nombre y cae al id si está vacío', () => {
    expect(nombreCarpetaObra({ id: 'x1', nombre: '  Torre Sur  ' })).toBe('Torre Sur');
    expect(nombreCarpetaObra({ id: 'x1', nombre: '' })).toBe('x1');
    expect(nombreCarpetaObra({ id: 'x1' })).toBe('x1');
  });
});

/* ============================ Query strings ============================ */

describe('armado de queries de Drive', () => {
  it('escapa comillas simples y backslashes', () => {
    expect(escaparQuery("Casa D'Angelo")).toBe("Casa D\\'Angelo");
    expect(escaparQuery('a\\b')).toBe('a\\\\b');
  });

  it('queryCarpeta arma nombre + mime + trashed y padre opcional', () => {
    expect(queryCarpeta('Archivos')).toBe(
      `name='Archivos' and mimeType='${MIME_CARPETA}' and trashed=false`
    );
    expect(queryCarpeta("O'Higgins", 'PADRE1')).toBe(
      `name='O\\'Higgins' and mimeType='${MIME_CARPETA}' and trashed=false and 'PADRE1' in parents`
    );
  });

  it('queryRespaldos filtra JSON no borrados dentro de la carpeta', () => {
    expect(queryRespaldos('F1')).toBe(
      "'F1' in parents and trashed=false and mimeType='application/json'"
    );
  });

  it('queryArchivos excluye subcarpetas', () => {
    expect(queryArchivos('F2')).toBe(
      `'F2' in parents and trashed=false and mimeType!='${MIME_CARPETA}'`
    );
  });
});

/* ============================ Multipart body ============================ */

describe('multipart', () => {
  it('arma el cuerpo multipart/related con metadata y contenido', async () => {
    const meta = { name: 'b.json', parents: ['F1'], mimeType: 'application/json' };
    const { body, contentType } = construirMultipart(meta, '{"a":1}', 'application/json', 'BND');
    expect(contentType).toBe('multipart/related; boundary=BND');
    const texto = await body.text();
    expect(texto).toContain('\r\n--BND\r\n');
    expect(texto).toContain('Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta));
    expect(texto).toContain('Content-Type: application/json\r\n\r\n{"a":1}');
    expect(texto.endsWith('\r\n--BND--')).toBe(true);
  });

  it('acepta contenido binario (Blob) sin pasarlo a string', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });
    const { body } = construirMultipart({ name: 'p.dwg' }, blob, 'application/octet-stream', 'B2');
    expect(body.size).toBeGreaterThan(3);
    const texto = await body.text();
    expect(texto).toContain('Content-Type: application/octet-stream');
  });
});

/* ============================ Prune ============================ */

describe('prune de respaldos viejos', () => {
  const archivo = (id: string, iso: string) => ({ id, createdTime: iso });

  it('con 10 o menos no borra nada', () => {
    const lista = Array.from({ length: 10 }, (_, i) =>
      archivo(`f${i}`, `2026-07-0${(i % 9) + 1}T00:00:00Z`)
    );
    expect(seleccionarParaPrune(lista, MAX_RESPALDOS)).toEqual([]);
  });

  it('con 12 borra los 2 más viejos aunque vengan desordenados', () => {
    const fechas = [
      '2026-07-05T10:00:00Z', '2026-06-01T00:00:00Z', '2026-07-04T09:00:00Z',
      '2026-07-03T08:00:00Z', '2026-05-15T00:00:00Z', '2026-07-02T07:00:00Z',
      '2026-07-01T06:00:00Z', '2026-06-30T05:00:00Z', '2026-06-29T04:00:00Z',
      '2026-06-28T03:00:00Z', '2026-06-27T02:00:00Z', '2026-06-26T01:00:00Z'
    ];
    const lista = fechas.map((f, i) => archivo(`f${i}`, f));
    const borrar = seleccionarParaPrune(lista, MAX_RESPALDOS);
    expect(borrar.map((f) => f.createdTime).sort()).toEqual([
      '2026-05-15T00:00:00Z',
      '2026-06-01T00:00:00Z'
    ]);
  });

  it('respeta max arbitrario', () => {
    const lista = [
      archivo('a', '2026-01-01T00:00:00Z'),
      archivo('b', '2026-01-03T00:00:00Z'),
      archivo('c', '2026-01-02T00:00:00Z')
    ];
    expect(seleccionarParaPrune(lista, 1).map((f) => f.id).sort()).toEqual(['a', 'c']);
  });
});

/* ============================ Debounce / gating ============================ */

describe('auto-sync: gating del debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('APAGADO por defecto: notificarCambio no programa nada', () => {
    const sync = new DebounceSync(30000);
    const subir = vi.fn();
    expect(sync.habilitado).toBe(false);
    expect(sync.notificarCambio(subir)).toBe(false);
    vi.advanceTimersByTime(120000);
    expect(subir).not.toHaveBeenCalled();
  });

  it('habilitado: debounce de 30s y una sola subida por ráfaga de cambios', () => {
    const sync = new DebounceSync(30000);
    const subir = vi.fn();
    sync.setHabilitado(true);
    expect(sync.notificarCambio(subir)).toBe(true);
    vi.advanceTimersByTime(15000);
    sync.notificarCambio(subir); // reinicia el timer
    vi.advanceTimersByTime(29999);
    expect(subir).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(subir).toHaveBeenCalledTimes(1);
  });

  it('deshabilitar cancela una subida pendiente', () => {
    const sync = new DebounceSync(30000);
    const subir = vi.fn();
    sync.setHabilitado(true);
    sync.notificarCambio(subir);
    sync.setHabilitado(false);
    vi.advanceTimersByTime(60000);
    expect(subir).not.toHaveBeenCalled();
  });
});

/* ============================ fetch mockeado ============================ */

describe('driveApi / subirMultipart (fetch mock)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('driveApi pega a la URL de Drive v3 con Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ files: [] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await driveApi<{ files: unknown[] }>('TOK123', 'GET', '/files?q=x');
    expect(r).toEqual({ files: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://www.googleapis.com/drive/v3/files?q=x');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TOK123');
    expect(init.method).toBe('GET');
  });

  it('driveApi lanza con status y cuerpo si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 403 })));
    await expect(driveApi('T', 'DELETE', '/files/abc')).rejects.toThrow(/403/);
  });

  it('subirMultipart postea al endpoint de upload con uploadType=multipart', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'nuevo1', name: 'b.json' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const meta = { name: 'b.json', parents: ['F1'] };
    const r = await subirMultipart('TOK', meta, '{"a":1}', 'application/json');
    expect(r.id).toBe('nuevo1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TOK');
    expect(headers['Content-Type']).toMatch(/^multipart\/related; boundary=/);
    const cuerpo = await (init.body as Blob).text();
    expect(cuerpo).toContain(JSON.stringify(meta));
    expect(cuerpo).toContain('{"a":1}');
  });
});

/* ============================ Varios ============================ */

describe('helpers varios', () => {
  it('nombreArchivoRespaldo usa prefijo v2 y timestamp legible', () => {
    const n = nombreArchivoRespaldo(new Date('2026-07-05T14:30:15Z'));
    expect(n).toBe('sud_v2_backup_2026-07-05_14-30-15.json');
  });

  it('linkPreview arma la URL embebible de Drive', () => {
    expect(linkPreview('ABC')).toBe('https://drive.google.com/file/d/ABC/preview');
  });

  it('esPrevisualizable: PDF e imágenes sí, DWG no', () => {
    expect(esPrevisualizable('application/pdf')).toBe(true);
    expect(esPrevisualizable('image/png')).toBe(true);
    expect(esPrevisualizable('image/vnd.dwg')).toBe(true); // Drive a veces lo reporta así
    expect(esPrevisualizable('application/acad')).toBe(false);
  });
});
