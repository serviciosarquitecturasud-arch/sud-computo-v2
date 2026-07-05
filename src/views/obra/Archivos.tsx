/**
 * ARCHIVOS de obra (H3): planos y editables (PDF, DWG, RVT, SKP, imágenes…)
 * en la carpeta de Drive de la obra: "SUD Cómputo v2/Archivos/<obra>".
 * El id de carpeta se cachea en obra.archivosDriveFolderId (passthrough).
 */
import { useEffect, useRef, useState } from 'react';
import type { Obra } from '../../core';
import { Badge, Btn, Card, SectionTitle, td, th } from '../../ui/base';
import { Modal } from '../../ui/edit';
import { conectar, useGoogleAuth } from '../../storage/googleAuth';
import {
  CAMPO_FOLDER_ID,
  asegurarCarpetaObra,
  borrarArchivo,
  esPrevisualizable,
  linkPreview,
  listarArchivos,
  subirArchivo,
  type ArchivoDrive
} from '../../storage/driveArchivos';

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

/** Ícono según tipo de archivo (por MIME y extensión). */
function icono(a: ArchivoDrive): string {
  const ext = (a.nombre.split('.').pop() ?? '').toLowerCase();
  if (a.mimeType === 'application/pdf') return '📄';
  if (a.mimeType.startsWith('image/')) return '🖼️';
  if (['dwg', 'dxf'].includes(ext)) return '📐';
  if (['rvt', 'rfa', 'rte'].includes(ext)) return '🏗️';
  if (ext === 'skp') return '🧊';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['doc', 'docx', 'txt'].includes(ext)) return '📝';
  return '📎';
}

export function Archivos({ obra, setObra }: { obra: Obra; setObra: (o: Obra) => void }) {
  const auth = useGoogleAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<ArchivoDrive[]>([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<ArchivoDrive | null>(null);

  const inicializar = async () => {
    setCargando(true);
    setMsg(null);
    try {
      const id = await asegurarCarpetaObra(obra);
      setFolderId(id);
      if (obra[CAMPO_FOLDER_ID] !== id) {
        // Persistir el id en la obra (passthrough) para no repetir búsquedas
        setObra({ ...obra, [CAMPO_FOLDER_ID]: id });
      }
      setArchivos(await listarArchivos(id));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo acceder a la carpeta de Drive.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (auth.autenticado) void inicializar();
    else {
      setFolderId(null);
      setArchivos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.autenticado, obra.id]);

  const refrescar = async () => {
    if (!folderId) return;
    setCargando(true);
    try {
      setArchivos(await listarArchivos(folderId));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo listar la carpeta.');
    } finally {
      setCargando(false);
    }
  };

  const onSubir = async (files: FileList) => {
    if (!folderId) return;
    setMsg(null);
    try {
      for (const f of Array.from(files)) {
        setSubiendo(f.name);
        await subirArchivo(folderId, f);
      }
      setMsg(`${files.length === 1 ? 'Archivo subido' : `${files.length} archivos subidos`}.`);
      await refrescar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falló la subida.');
    } finally {
      setSubiendo(null);
    }
  };

  const onBorrar = async (a: ArchivoDrive) => {
    if (!window.confirm(`¿Enviar "${a.nombre}" a la papelera de Drive?`)) return;
    try {
      await borrarArchivo(a.id);
      setMsg(`"${a.nombre}" enviado a la papelera.`);
      await refrescar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo borrar el archivo.');
    }
  };

  const onConectar = async () => {
    try {
      setMsg(null);
      await conectar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo conectar con Google.');
    }
  };

  if (!auth.autenticado) {
    return (
      <Card className="p-10 text-center">
        <div className="font-marca text-xl">Archivos de obra</div>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--texto-2)]">
          Planos y archivos editables (PDF, DWG, RVT, SKP…) alojados en la carpeta de Google Drive
          de la obra («SUD Cómputo v2 / Archivos / {obra.nombre || obra.id}»), accesibles desde
          cualquier dispositivo.
        </p>
        <div className="mt-5">
          <Btn variante="primario" onClick={() => void onConectar()}>Conectar cuenta de Google</Btn>
        </div>
        {msg && <p className="mt-3 text-sm text-[var(--texto-2)]">{msg}</p>}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle>Archivos de la obra</SectionTitle>
          <span className="mb-3 text-xs text-[var(--texto-2)]">
            Drive · SUD Cómputo v2 / Archivos / {obra.nombre || obra.id}
          </span>
          <div className="mb-3 ml-auto flex items-center gap-2">
            <Btn variante="fantasma" onClick={() => void refrescar()} disabled={cargando || !folderId}>
              {cargando ? 'Cargando…' : 'Actualizar'}
            </Btn>
            <Btn
              variante="primario"
              onClick={() => inputRef.current?.click()}
              disabled={!folderId || subiendo !== null}
            >
              {subiendo ? `Subiendo ${subiendo}…` : 'Subir archivos'}
            </Btn>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onSubir(e.target.files);
            e.target.value = '';
          }}
        />

        {archivos.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--texto-2)]">
            {cargando
              ? 'Buscando archivos…'
              : 'La carpeta está vacía. Subí planos, PDFs, modelos o imágenes con «Subir archivos».'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Archivo</th>
                <th className={th}>Tamaño</th>
                <th className={th}>Modificado</th>
                <th className={`${th} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {archivos.map((a) => (
                <tr key={a.id}>
                  <td className={td}>
                    <span className="mr-2" aria-hidden>{icono(a)}</span>
                    {a.nombre}
                  </td>
                  <td className={td}>{fmtBytes(a.tamano)}</td>
                  <td className={td}>{fmtFecha(a.modifiedTime)}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {esPrevisualizable(a.mimeType) && (
                      <Btn variante="fantasma" onClick={() => setPreview(a)}>Ver</Btn>
                    )}
                    {a.webViewLink && (
                      <a
                        href={a.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-[var(--texto-2)] transition-colors hover:bg-[var(--color-neutro-100)] hover:text-[var(--texto)] dark:hover:bg-[var(--color-neutro-800)]"
                      >
                        Abrir en Drive
                      </a>
                    )}
                    <Btn variante="peligro" className="border-0" onClick={() => void onBorrar(a)}>
                      Borrar
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {msg && <p className="text-sm text-[var(--texto-2)]">{msg}</p>}
        <div className="flex items-center gap-2">
          <Badge tono="info">Drive</Badge>
          <span className="text-xs text-[var(--texto-2)]">
            Conectado como {auth.email ?? 'cuenta de Google'} · los archivos borrados van a la
            papelera de Drive.
          </span>
        </div>
      </Card>

      {preview && (
        <Modal titulo={preview.nombre} onCerrar={() => setPreview(null)} ancho="max-w-4xl">
          <iframe
            src={linkPreview(preview.id)}
            title={preview.nombre}
            className="h-[65vh] w-full rounded-md border border-[var(--borde)]"
            allow="autoplay"
          />
        </Modal>
      )}
    </div>
  );
}
