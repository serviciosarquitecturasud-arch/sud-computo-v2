/**
 * Legajo legal por obra (subtab de Archivos).
 * Contratos, presupuestos, permisos/trámites, seguridad e higiene,
 * ART/seguros y actas, agrupados por categoría del catálogo editable
 * (cat.categoriasLegal). El estado "Vencido" no se persiste: se deriva
 * de fechaVenc < hoy y se muestra como badge de alerta superpuesto.
 * Cada documento puede vincularse a un archivo de la carpeta de Drive
 * de la obra (mismo mecanismo que Documentación) o registrarse sin archivo.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ESTADOS_LEGAL,
  SEED_CATEGORIAS_LEGAL,
  agruparLegales,
  estaVencido,
  kpisLegales,
  money,
  uid
} from '../../core';
import type { Catalogo, DocumentoLegal, EstadoLegal, Obra } from '../../core';
import { Badge, Btn, Card, SectionTitle, td, th } from '../../ui/base';
import { linkPreview, type ArchivoDrive } from '../../storage/driveArchivos';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const NUEVA = '__nueva__';

const inputCls =
  'w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1 text-sm ' +
  'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

const ETIQUETA_ESTADO: Record<EstadoLegal, string> = {
  presentado: 'Presentado',
  aprobado: 'Aprobado',
  firmado: 'Firmado',
  rechazado: 'Rechazado'
};

const TONO_ESTADO: Record<EstadoLegal, 'ok' | 'info' | 'alerta'> = {
  presentado: 'info',
  aprobado: 'ok',
  firmado: 'ok',
  rechazado: 'alerta'
};

function fmtFechaCorta(iso: string): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

function linkDeLegal(d: DocumentoLegal): string {
  if (d.driveLink) return d.driveLink;
  if (d.driveFileId) return linkPreview(d.driveFileId).replace('/preview', '/view');
  return '';
}

function Kpi({ valor, label, alerta = false }: { valor: string; label: string; alerta?: boolean }) {
  return (
    <div
      className={
        'rounded-md border px-4 py-2 ' +
        (alerta ? 'border-[var(--color-alerta)]/50' : 'border-[var(--borde)]')
      }
    >
      <div className="flex items-center gap-2">
        <span
          className={
            'font-marca text-xl tabular-nums' + (alerta ? ' text-[var(--color-alerta)]' : '')
          }
        >
          {valor}
        </span>
        {alerta && <Badge tono="alerta">¡Atención!</Badge>}
      </div>
      <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--texto-2)]">{label}</div>
    </div>
  );
}

/** Formulario de alta/edición de un documento del legajo. */
function FormLegal({
  categorias,
  archivos,
  inicial,
  onGuardar,
  onCerrar
}: {
  categorias: string[];
  archivos: ArchivoDrive[];
  inicial: DocumentoLegal | null;
  onGuardar: (d: DocumentoLegal, categoriaNueva: string | null) => void;
  onCerrar: () => void;
}) {
  const catIni = inicial?.categoria ?? '';
  const [categoria, setCategoria] = useState(
    catIni && !categorias.includes(catIni) ? NUEVA : catIni
  );
  const [categoriaNueva, setCategoriaNueva] = useState(
    catIni && !categorias.includes(catIni) ? catIni : ''
  );
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [emisor, setEmisor] = useState(inicial?.emisor ?? 'estudio SUD');
  const [destinatario, setDestinatario] = useState(inicial?.destinatario ?? '');
  const [monto, setMonto] = useState(
    inicial?.monto !== undefined && Number.isFinite(inicial.monto) ? String(inicial.monto) : ''
  );
  const [fechaDoc, setFechaDoc] = useState(inicial?.fechaDoc ?? hoyISO());
  const [fechaVenc, setFechaVenc] = useState(inicial?.fechaVenc ?? '');
  const [estado, setEstado] = useState<EstadoLegal>(inicial?.estado ?? 'presentado');
  const [fileId, setFileId] = useState(inicial?.driveFileId ?? '');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    const catFinal = (categoria === NUEVA ? categoriaNueva : categoria).trim();
    if (!catFinal) {
      setError(
        categoria === NUEVA
          ? 'Escribí el nombre de la categoría nueva.'
          : 'Elegí una categoría del catálogo (o creá una nueva).'
      );
      return;
    }
    if (!titulo.trim()) {
      setError('Indicá un título para el documento (ej. "Contrato de locación de obra").');
      return;
    }
    if (!fechaDoc) {
      setError('Indicá la fecha del documento.');
      return;
    }
    if (monto.trim() !== '' && (!Number.isFinite(Number(monto)) || Number(monto) < 0)) {
      setError('El monto debe ser un número mayor o igual a 0 (o dejarse vacío).');
      return;
    }
    if (fechaVenc && fechaVenc < fechaDoc) {
      setError('El vencimiento no puede ser anterior a la fecha del documento.');
      return;
    }
    const nuevo: DocumentoLegal = {
      id: inicial?.id ?? uid(),
      categoria: catFinal,
      titulo: titulo.trim(),
      emisor: emisor.trim(),
      destinatario: destinatario.trim(),
      fechaDoc,
      estado
    };
    if (monto.trim() !== '') nuevo.monto = Number(monto);
    if (fechaVenc) nuevo.fechaVenc = fechaVenc;
    const archivo = archivos.find((a) => a.id === fileId);
    if (archivo) {
      nuevo.driveFileId = archivo.id;
      if (archivo.webViewLink) nuevo.driveLink = archivo.webViewLink;
    } else if (fileId && fileId === inicial?.driveFileId) {
      // Preserva el vínculo aunque la lista de Drive no esté cargada ahora.
      nuevo.driveFileId = inicial.driveFileId;
      if (inicial.driveLink) nuevo.driveLink = inicial.driveLink;
    }
    if (notas.trim()) nuevo.notas = notas.trim();
    const esNueva = !categorias.some((c) => c.trim().toLowerCase() === catFinal.toLowerCase());
    onGuardar(nuevo, esNueva ? catFinal : null);
  };

  const vinculadoSinLista =
    fileId && fileId === inicial?.driveFileId && !archivos.some((a) => a.id === fileId);

  return (
    <Card className="space-y-3 border-[var(--color-sud-azul)]/40 p-5">
      <div className="flex items-center justify-between">
        <SectionTitle>{inicial ? 'Editar documento legal' : 'Registrar documento legal'}</SectionTitle>
        <button className="mb-3 text-[var(--texto-2)] hover:text-[var(--texto)]" onClick={onCerrar}>✕</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Categoría *</span>
          <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Elegir categoría…</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={NUEVA}>+ Nueva categoría…</option>
          </select>
        </label>
        {categoria === NUEVA ? (
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Nombre de la categoría nueva *</span>
            <input
              className={inputCls}
              value={categoriaNueva}
              placeholder="Ej.: Garantías bancarias"
              onChange={(e) => setCategoriaNueva(e.target.value)}
            />
          </label>
        ) : (
          <div className="hidden md:block" />
        )}
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Título *</span>
          <input
            className={inputCls}
            value={titulo}
            placeholder='Ej.: "Contrato de locación de obra — etapa 1"'
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Emisor</span>
          <input
            className={inputCls}
            value={emisor}
            placeholder='Ej.: "estudio SUD", "Contratista Jesus"'
            onChange={(e) => setEmisor(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Destinatario</span>
          <input
            className={inputCls}
            value={destinatario}
            placeholder='Ej.: "Cliente", "estudio SUD"'
            onChange={(e) => setDestinatario(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Monto ARS (opcional)</span>
          <input
            className={inputCls + ' tabular-nums'}
            type="number"
            min={0}
            step="any"
            value={monto}
            placeholder="Para presupuestos y contratos"
            onChange={(e) => setMonto(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Fecha del documento *</span>
            <input className={inputCls} type="date" value={fechaDoc} onChange={(e) => setFechaDoc(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Vencimiento (opcional)</span>
            <input className={inputCls} type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Estado</span>
          <select
            className={inputCls}
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoLegal)}
          >
            {ESTADOS_LEGAL.map((es) => (
              <option key={es} value={es}>{ETIQUETA_ESTADO[es]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Archivo de Drive (opcional)</span>
          <select className={inputCls} value={fileId} onChange={(e) => setFileId(e.target.value)}>
            <option value="">Sin archivo (documento en papel)</option>
            {vinculadoSinLista && <option value={fileId}>(archivo vinculado actual)</option>}
            {archivos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Notas (opcional)</span>
          <input
            className={inputCls}
            value={notas}
            placeholder="Ej.: firmado en dos ejemplares, expediente N° 1234/26…"
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-sm text-[var(--color-alerta)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <Btn variante="fantasma" onClick={onCerrar}>Cancelar</Btn>
        <Btn variante="primario" onClick={guardar}>
          {inicial ? 'Guardar cambios' : 'Registrar documento'}
        </Btn>
      </div>
    </Card>
  );
}

export function Legales({
  obra,
  setObra,
  cat,
  setCat,
  archivos
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  setCat: (c: Catalogo) => void;
  archivos: ArchivoDrive[];
}) {
  const categorias = useMemo(
    () =>
      Array.isArray(cat.categoriasLegal) && cat.categoriasLegal.length
        ? cat.categoriasLegal
        : SEED_CATEGORIAS_LEGAL,
    [cat.categoriasLegal]
  );
  const docs = useMemo(() => obra.legales ?? [], [obra.legales]);
  const hoy = hoyISO();
  const [form, setForm] = useState<{ abierto: boolean; doc: DocumentoLegal | null }>({
    abierto: false,
    doc: null
  });

  const grupos = useMemo(() => agruparLegales(docs, categorias), [docs, categorias]);
  const kpis = useMemo(() => kpisLegales(docs, hoy), [docs, hoy]);

  const guardar = (d: DocumentoLegal, categoriaNueva: string | null) => {
    if (categoriaNueva) {
      // Alta de categoría al vuelo: se suma al catálogo global (merge con seed).
      setCat({ ...cat, categoriasLegal: [...categorias, categoriaNueva] });
    }
    const existe = docs.some((x) => x.id === d.id);
    setObra({
      ...obra,
      legales: existe ? docs.map((x) => (x.id === d.id ? d : x)) : [...docs, d]
    });
    setForm({ abierto: false, doc: null });
  };

  const eliminar = (d: DocumentoLegal) => {
    if (
      !window.confirm(
        `¿Eliminar "${d.titulo}" (${d.categoria}) del legajo legal? El archivo en Drive no se toca.`
      )
    )
      return;
    setObra({ ...obra, legales: docs.filter((x) => x.id !== d.id) });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle>Legajo legal de la obra</SectionTitle>
          <div className="mb-3 ml-auto">
            <Btn variante="primario" onClick={() => setForm({ abierto: true, doc: null })}>
              Registrar documento
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Kpi valor={String(kpis.total)} label="Documentos" />
          <Kpi valor={String(kpis.aprobados)} label="Aprobados / firmados" />
          <Kpi valor={String(kpis.pendientes)} label="Pendientes" />
          <Kpi valor={String(kpis.vencidos)} label="Vencidos" alerta={kpis.vencidos > 0} />
          <Kpi valor={money(kpis.montoPresupAprobado)} label="Presupuestos aprobados" />
        </div>

        {form.abierto && (
          <FormLegal
            categorias={categorias}
            archivos={archivos}
            inicial={form.doc}
            onGuardar={guardar}
            onCerrar={() => setForm({ abierto: false, doc: null })}
          />
        )}

        {docs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--texto-2)]">
            Todavía no hay documentos en el legajo. Usá «Registrar documento» para cargar
            contratos, presupuestos, permisos, seguros o actas de la obra.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Documento</th>
                <th className={th + ' w-48'}>Emisor → Destinatario</th>
                <th className={th + ' w-32 text-right'}>Monto</th>
                <th className={th + ' w-24'}>Fecha</th>
                <th className={th + ' w-28'}>Vencimiento</th>
                <th className={th + ' w-36'}>Estado</th>
                <th className={th + ' text-right'}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <FragmentoCategoria key={g.categoria} categoria={g.categoria}>
                  {g.docs.map((d) => {
                    const vencido = estaVencido(d, hoy);
                    return (
                      <tr key={d.id}>
                        <td className={td}>
                          {d.titulo}
                          {d.notas && (
                            <div className="text-xs text-[var(--texto-2)]">{d.notas}</div>
                          )}
                        </td>
                        <td className={td + ' text-xs'}>
                          {d.emisor || '—'}
                          <span className="mx-1 text-[var(--texto-2)]">→</span>
                          {d.destinatario || '—'}
                        </td>
                        <td className={td + ' text-right tabular-nums'}>
                          {d.monto !== undefined && Number.isFinite(Number(d.monto))
                            ? money(d.monto)
                            : '—'}
                        </td>
                        <td className={td + ' text-xs tabular-nums'}>{fmtFechaCorta(d.fechaDoc)}</td>
                        <td
                          className={
                            td +
                            ' text-xs tabular-nums' +
                            (vencido ? ' font-medium text-[var(--color-alerta)]' : '')
                          }
                        >
                          {d.fechaVenc ? fmtFechaCorta(d.fechaVenc) : '—'}
                        </td>
                        <td className={td}>
                          <span className="inline-flex flex-wrap items-center gap-1">
                            <Badge tono={TONO_ESTADO[d.estado] ?? 'neutro'}>
                              {ETIQUETA_ESTADO[d.estado] ?? d.estado}
                            </Badge>
                            {vencido && <Badge tono="alerta">Vencido</Badge>}
                          </span>
                        </td>
                        <td className={td + ' whitespace-nowrap text-right'}>
                          {linkDeLegal(d) ? (
                            <a
                              href={linkDeLegal(d)}
                              target="_blank"
                              rel="noreferrer"
                              className="mr-1 text-xs text-[var(--color-sud-azul)] hover:underline"
                              title="Abrir el archivo vinculado en Drive"
                            >
                              Abrir
                            </a>
                          ) : (
                            <span
                              className="mr-1 text-xs text-[var(--texto-2)]"
                              title="Registrado sin archivo digital"
                            >
                              📄 papel
                            </span>
                          )}
                          <Btn
                            variante="fantasma"
                            className="px-2 py-0.5 text-xs"
                            onClick={() => setForm({ abierto: true, doc: d })}
                          >
                            Editar
                          </Btn>
                          <button
                            className="ml-1 text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                            onClick={() => eliminar(d)}
                            title="Eliminar este documento del legajo"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </FragmentoCategoria>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-[var(--texto-2)]">
          El estado «Vencido» es automático: se marca cuando la fecha de vencimiento quedó atrás,
          sin pisar el estado registrado (presentado, aprobado, firmado o rechazado).
        </p>
      </Card>
    </div>
  );
}

/** Fila-encabezado de categoría + filas hijas (mismo estilo que Documentación). */
function FragmentoCategoria({ categoria, children }: { categoria: string; children: ReactNode }) {
  return (
    <>
      <tr className="bg-[var(--color-sud-tinta)] text-[var(--color-sud-crema)]">
        <td className={td + ' text-xs font-semibold uppercase tracking-wide'} colSpan={7}>
          {categoria}
        </td>
      </tr>
      {children}
    </>
  );
}
