/**
 * Respaldo manual (exportar/importar JSON v2) + sync con Google Drive (H3).
 * Los respaldos de Drive van a la carpeta "SUD Cómputo v2" — NUNCA a la
 * carpeta legacy de producción (ver src/storage/driveClient.ts).
 */
import { useEffect, useRef, useState } from 'react';
import { Badge, Btn, Card, SectionTitle, td, th } from '../ui/base';
import type { RespaldoV2 } from '../state/useAppData';
import { conectar, desconectar, useGoogleAuth } from '../storage/googleAuth';
import {
  autoSync,
  descargarRespaldo,
  listarRespaldos,
  subirRespaldo,
  type RespaldoDrive
} from '../storage/driveSync';
import { CARPETA_RAIZ } from '../storage/driveClient';

function fmtBytes(n: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtFecha(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('es-AR');
}

export function Respaldo({
  exportRespaldo,
  importRespaldo
}: {
  exportRespaldo: () => RespaldoV2;
  importRespaldo: (data: RespaldoV2) => string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // --- Google Drive ---------------------------------------------------------
  const auth = useGoogleAuth();
  const [lista, setLista] = useState<RespaldoDrive[]>([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [autoOn, setAutoOn] = useState(autoSync.habilitado);

  const refrescar = async () => {
    setCargando(true);
    try {
      setLista(await listarRespaldos());
      setDriveMsg(null);
    } catch (e) {
      setDriveMsg(e instanceof Error ? e.message : 'No se pudo listar los respaldos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (auth.autenticado) void refrescar();
    else setLista([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.autenticado]);

  const onConectar = async () => {
    try {
      setDriveMsg(null);
      await conectar();
    } catch (e) {
      setDriveMsg(e instanceof Error ? e.message : 'No se pudo conectar con Google.');
    }
  };

  const onSubirAhora = async () => {
    setSubiendo(true);
    try {
      const r = await subirRespaldo(exportRespaldo());
      setDriveMsg(`Respaldo subido: ${r.name}`);
      await refrescar();
    } catch (e) {
      setDriveMsg(e instanceof Error ? e.message : 'Falló la subida del respaldo.');
    } finally {
      setSubiendo(false);
    }
  };

  const onRestaurar = async (r: RespaldoDrive) => {
    if (
      !window.confirm(
        `¿Restaurar el respaldo "${r.nombre}" (${fmtFecha(r.fecha)})?\n` +
          'Reemplaza los datos actuales de este navegador.'
      )
    )
      return;
    try {
      const data = await descargarRespaldo(r.id);
      const err = importRespaldo(data);
      setDriveMsg(err ?? `Respaldo restaurado (${data.obras?.length ?? 0} obras, ${data.fecha ?? 'sin fecha'}).`);
    } catch (e) {
      setDriveMsg(e instanceof Error ? e.message : 'No se pudo restaurar el respaldo.');
    }
  };

  const onToggleAuto = (v: boolean) => {
    autoSync.setHabilitado(v);
    setAutoOn(v);
  };

  // --- Export/import local (H0) ---------------------------------------------
  const descargar = () => {
    const data = exportRespaldo();
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `computo_respaldo_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Respaldo descargado.');
  };

  const importar = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as RespaldoV2;
      const err = importRespaldo(data);
      setMsg(err ?? `Respaldo importado (${data.obras?.length ?? 0} obras, ${data.fecha ?? 'sin fecha'}).`);
    } catch {
      setMsg('No se pudo leer el archivo: JSON inválido.');
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-marca text-3xl tracking-tight">Respaldo</h1>
      <Card className="space-y-4 p-6">
        <SectionTitle>Exportar</SectionTitle>
        <p className="text-sm text-[var(--texto-2)]">
          Descarga un JSON con catálogo completo, obras y mapa Revit — mismo formato que la app de
          producción (compatible en ambos sentidos).
        </p>
        <Btn variante="primario" onClick={descargar}>Descargar respaldo</Btn>
      </Card>
      <Card className="space-y-4 p-6">
        <SectionTitle>Importar</SectionTitle>
        <p className="text-sm text-[var(--texto-2)]">
          Restaura desde un respaldo JSON (de esta app o de la legacy). Reemplaza los datos actuales
          de este navegador; se aplican las migraciones y el merge con el SEED al cargar.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
        />
        <Btn onClick={() => fileRef.current?.click()}>Elegir archivo…</Btn>
      </Card>
      {msg && <p className="text-sm text-[var(--texto-2)]">{msg}</p>}

      <Card className="space-y-4 p-6">
        <SectionTitle>Google Drive (carpeta {CARPETA_RAIZ})</SectionTitle>
        <p className="text-sm text-[var(--texto-2)]">
          Respaldos en la nube dentro de la carpeta <b>{CARPETA_RAIZ}</b> de tu Drive (se crea sola).
          Esta app no toca la carpeta de respaldos de la app de producción. Se conservan los últimos
          10 respaldos.
        </p>

        {!auth.autenticado ? (
          <Btn variante="primario" onClick={() => void onConectar()}>
            Conectar cuenta de Google
          </Btn>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tono="ok">Conectado</Badge>
              <span className="text-sm text-[var(--texto-2)]">{auth.email ?? 'cuenta de Google'}</span>
              <Btn variante="fantasma" onClick={desconectar}>Desconectar</Btn>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Btn variante="primario" onClick={() => void onSubirAhora()} disabled={subiendo}>
                {subiendo ? 'Subiendo…' : 'Subir respaldo ahora'}
              </Btn>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoOn}
                  onChange={(e) => onToggleAuto(e.target.checked)}
                  className="accent-[var(--color-sud-tinta)]"
                />
                Sync automático (esta sesión)
              </label>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]">
                  Respaldos en Drive
                </span>
                <Btn variante="fantasma" onClick={() => void refrescar()} disabled={cargando}>
                  {cargando ? 'Cargando…' : 'Actualizar'}
                </Btn>
              </div>
              {lista.length === 0 ? (
                <p className="text-sm text-[var(--texto-2)]">
                  {cargando ? 'Buscando respaldos…' : 'Todavía no hay respaldos en la carpeta.'}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Archivo</th>
                      <th className={th}>Fecha</th>
                      <th className={th}>Tamaño</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((r) => (
                      <tr key={r.id}>
                        <td className={td}>{r.nombre}</td>
                        <td className={td}>{fmtFecha(r.fecha)}</td>
                        <td className={td}>{fmtBytes(r.tamano)}</td>
                        <td className={`${td} text-right`}>
                          <Btn variante="fantasma" onClick={() => void onRestaurar(r)}>
                            Restaurar
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
        {driveMsg && <p className="text-sm text-[var(--texto-2)]">{driveMsg}</p>}
      </Card>
    </div>
  );
}
