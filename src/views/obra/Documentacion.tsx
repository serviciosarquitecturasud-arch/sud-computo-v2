/**
 * Registro de Documentación por obra (subtab de Archivos).
 * Revisiones de planos con nomenclatura controlada (cat.tiposPlano):
 * la vigencia se deriva (mayor rev por código = Vigente, el resto Superada).
 * Opcionalmente cada revisión se vincula a un archivo de la carpeta de Drive
 * de la obra, o se registra sin archivo (plano en papel).
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  agruparDocs,
  kpisDocumentos,
  nombreEstandar,
  ordenGrupos,
  proximaRev,
  tipoPorCod,
  uid,
  ultimoAutor,
  validarCod
} from '../../core';
import type { Catalogo, DocumentoObra, Obra, TipoPlano } from '../../core';
import { Badge, Btn, Card, SectionTitle, td, th } from '../../ui/base';
import { linkPreview, type ArchivoDrive } from '../../storage/driveArchivos';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1 text-sm ' +
  'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

function fmtFechaCorta(iso: string): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

function linkDeDoc(d: DocumentoObra): string {
  if (d.driveLink) return d.driveLink;
  if (d.driveFileId) return linkPreview(d.driveFileId).replace('/preview', '/view');
  return '';
}

function Kpi({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="rounded-md border border-[var(--borde)] px-4 py-2">
      <div className="font-marca text-xl tabular-nums">{valor}</div>
      <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--texto-2)]">{label}</div>
    </div>
  );
}

/** Formulario de alta de revisión. */
function FormRegistro({
  tipos,
  docs,
  archivos,
  codInicial,
  onGuardar,
  onCerrar
}: {
  tipos: TipoPlano[];
  docs: DocumentoObra[];
  archivos: ArchivoDrive[];
  codInicial: string;
  onGuardar: (d: DocumentoObra) => void;
  onCerrar: () => void;
}) {
  const tipoIni = tipoPorCod(tipos, codInicial);
  const grupos = useMemo(() => ordenGrupos(tipos), [tipos]);
  const [grupo, setGrupo] = useState(tipoIni?.grupo ?? '');
  const [cod, setCod] = useState(codInicial);
  const [rev, setRev] = useState<string>(codInicial ? String(proximaRev(docs, codInicial)) : '');
  const [fecha, setFecha] = useState(hoyISO());
  const [autor, setAutor] = useState(ultimoAutor(docs));
  const [fileId, setFileId] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const tiposDelGrupo = useMemo(
    () => tipos.filter((t) => (grupo ? t.grupo === grupo : true)),
    [tipos, grupo]
  );
  const tipo = tipoPorCod(tipos, cod);
  const revNum = Math.floor(Number(rev));
  const nombreStd = tipo && rev !== '' && Number.isFinite(revNum) && revNum >= 0
    ? nombreEstandar(tipo.cod, revNum, tipo.den)
    : '';

  const elegirTipo = (c: string) => {
    setCod(c);
    setRev(c ? String(proximaRev(docs, c)) : '');
  };

  const guardar = () => {
    if (!validarCod(cod, tipos)) {
      setError('Elegí un tipo de plano del catálogo (el código es obligatorio).');
      return;
    }
    if (rev === '' || !Number.isInteger(Number(rev)) || Number(rev) < 0) {
      setError('La revisión debe ser un número entero mayor o igual a 0.');
      return;
    }
    if (!fecha) {
      setError('Indicá la fecha del documento.');
      return;
    }
    const n = Number(rev);
    if (docs.some((d) => d.cod === cod && Number(d.rev) === n)) {
      setError(`Ya está registrada la revisión R${n} de ${cod}.`);
      return;
    }
    const archivo = archivos.find((a) => a.id === fileId);
    const nuevo: DocumentoObra = {
      id: uid(),
      cod,
      rev: n,
      fecha,
      autor: autor.trim()
    };
    if (archivo) {
      nuevo.driveFileId = archivo.id;
      if (archivo.webViewLink) nuevo.driveLink = archivo.webViewLink;
    }
    if (notas.trim()) nuevo.notas = notas.trim();
    onGuardar(nuevo);
  };

  return (
    <Card className="space-y-3 border-[var(--color-sud-azul)]/40 p-5">
      <div className="flex items-center justify-between">
        <SectionTitle>Registrar documento</SectionTitle>
        <button className="mb-3 text-[var(--texto-2)] hover:text-[var(--texto)]" onClick={onCerrar}>✕</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Grupo</span>
          <select
            className={inputCls}
            value={grupo}
            onChange={(e) => {
              setGrupo(e.target.value);
              elegirTipo('');
            }}
          >
            <option value="">Todos los grupos</option>
            {grupos.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Tipo de plano *</span>
          <select className={inputCls} value={cod} onChange={(e) => elegirTipo(e.target.value)}>
            <option value="">Elegir tipo…</option>
            {tiposDelGrupo.map((t) => (
              <option key={t.cod} value={t.cod}>
                {t.cod} — {t.den}{t.sub ? ` (${t.sub})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Escala sugerida</span>
          <input className={inputCls} value={tipo?.esc ?? ''} readOnly disabled placeholder="—" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Revisión (R…)</span>
            <input
              className={inputCls + ' tabular-nums'}
              type="number"
              min={0}
              step={1}
              value={rev}
              onChange={(e) => setRev(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Fecha</span>
            <input className={inputCls} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Autor</span>
          <input
            className={inputCls}
            value={autor}
            placeholder="Quién elaboró el plano"
            onChange={(e) => setAutor(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Archivo de Drive (opcional)</span>
          <select className={inputCls} value={fileId} onChange={(e) => setFileId(e.target.value)}>
            <option value="">Sin archivo (plano en papel)</option>
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
            placeholder="Ej.: emitido para construcción, reemplaza versión preliminar…"
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>
      </div>

      {nombreStd && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-[var(--color-neutro-100)] px-3 py-2 text-xs dark:bg-[var(--color-neutro-800)]">
          <span className="text-[var(--texto-2)]">Nombre estándar sugerido para el archivo:</span>
          <code className="font-mono">{nombreStd}</code>
          <Btn
            variante="fantasma"
            className="px-2 py-0.5 text-xs"
            onClick={() => {
              void navigator.clipboard?.writeText(nombreStd);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar'}
          </Btn>
          <span className="text-[var(--texto-2)]">
            (solo sugerencia: renombralo a mano en Drive si querés seguir la nomenclatura)
          </span>
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-alerta)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <Btn variante="fantasma" onClick={onCerrar}>Cancelar</Btn>
        <Btn variante="primario" onClick={guardar}>Registrar revisión</Btn>
      </div>
    </Card>
  );
}

export function Documentacion({
  obra,
  setObra,
  cat,
  archivos
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  archivos: ArchivoDrive[];
}) {
  const tipos = useMemo(() => cat.tiposPlano ?? [], [cat.tiposPlano]);
  const docs = useMemo(() => obra.documentos ?? [], [obra.documentos]);
  const [form, setForm] = useState<{ abierto: boolean; cod: string }>({ abierto: false, cod: '' });
  const [historiales, setHistoriales] = useState<Set<string>>(new Set());

  const grupos = useMemo(() => agruparDocs(docs, tipos), [docs, tipos]);
  const kpis = useMemo(() => kpisDocumentos(docs, tipos), [docs, tipos]);

  const toggleHistorial = (cod: string) =>
    setHistoriales((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });

  const agregar = (d: DocumentoObra) => {
    setObra({ ...obra, documentos: [...docs, d] });
    setForm({ abierto: false, cod: '' });
  };

  const eliminar = (d: DocumentoObra) => {
    const den = tipoPorCod(tipos, d.cod)?.den ?? '';
    if (!window.confirm(`¿Eliminar la revisión R${d.rev} de ${d.cod}${den ? ` (${den})` : ''} del registro? El archivo en Drive no se toca.`)) return;
    setObra({ ...obra, documentos: docs.filter((x) => x.id !== d.id) });
  };

  const filaRev = (d: DocumentoObra, vigente: boolean, tipo?: TipoPlano, principal = false) => (
    <tr key={d.id} className={principal ? undefined : 'bg-[var(--color-neutro-100)]/40 dark:bg-[var(--color-neutro-800)]/30'}>
      <td className={td + ' font-mono text-xs' + (principal ? '' : ' text-[var(--texto-2)]')}>
        {principal ? d.cod : ''}
      </td>
      <td className={td + (principal ? '' : ' pl-4 text-xs text-[var(--texto-2)]')}>
        {principal ? (
          <>
            {tipo?.den ?? <span className="text-[var(--texto-2)]">(tipo fuera del catálogo)</span>}
            {tipo?.sub && <span className="ml-1 text-xs text-[var(--texto-2)]">· {tipo.sub}</span>}
          </>
        ) : (
          d.notas || '—'
        )}
      </td>
      <td className={td + ' text-xs text-[var(--texto-2)]'}>{principal ? (tipo?.esc ?? '—') : ''}</td>
      <td className={td + ' font-mono text-xs tabular-nums'}>R{d.rev}</td>
      <td className={td + ' text-xs tabular-nums'}>{fmtFechaCorta(d.fecha)}</td>
      <td className={td + ' text-xs'}>{d.autor || '—'}</td>
      <td className={td}>
        {vigente ? <Badge tono="ok">Vigente</Badge> : <Badge>Superada</Badge>}
      </td>
      <td className={td + ' whitespace-nowrap text-right'}>
        {linkDeDoc(d) ? (
          <a
            href={linkDeDoc(d)}
            target="_blank"
            rel="noreferrer"
            className="mr-1 text-xs text-[var(--color-sud-azul)] hover:underline"
            title="Abrir el archivo vinculado en Drive"
          >
            Abrir
          </a>
        ) : (
          <span className="mr-1 text-xs text-[var(--texto-2)]" title="Registrado sin archivo digital">📄 papel</span>
        )}
        {principal && (
          <>
            <Btn
              variante="fantasma"
              className="px-2 py-0.5 text-xs"
              onClick={() => setForm({ abierto: true, cod: d.cod })}
              title="Registrar una nueva revisión de este plano"
            >
              + Rev
            </Btn>
            <Btn
              variante="fantasma"
              className="px-2 py-0.5 text-xs"
              onClick={() => toggleHistorial(d.cod)}
            >
              {historiales.has(d.cod) ? 'Ocultar historial' : 'Historial'}
            </Btn>
          </>
        )}
        <button
          className="ml-1 text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
          onClick={() => eliminar(d)}
          title="Eliminar esta revisión del registro"
        >
          ✕
        </button>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle>Registro de documentación</SectionTitle>
          <div className="mb-3 ml-auto">
            <Btn variante="primario" onClick={() => setForm({ abierto: true, cod: '' })}>
              Registrar documento
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Kpi valor={String(kpis.registrados)} label="Revisiones registradas" />
          <Kpi valor={String(kpis.vigentes)} label="Documentos vigentes" />
          <Kpi valor={`${kpis.gruposCubiertos} / ${kpis.gruposTotal}`} label="Grupos cubiertos" />
        </div>

        {form.abierto && (
          <FormRegistro
            tipos={tipos}
            docs={docs}
            archivos={archivos}
            codInicial={form.cod}
            onGuardar={agregar}
            onCerrar={() => setForm({ abierto: false, cod: '' })}
          />
        )}

        {docs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--texto-2)]">
            Todavía no hay documentos registrados. Usá «Registrar documento» para cargar la primera
            revisión de un plano (con o sin archivo en Drive).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th + ' w-24'}>Código</th>
                <th className={th}>Denominación</th>
                <th className={th + ' w-24'}>Escala</th>
                <th className={th + ' w-16'}>Rev.</th>
                <th className={th + ' w-24'}>Fecha</th>
                <th className={th + ' w-36'}>Autor</th>
                <th className={th + ' w-24'}>Estado</th>
                <th className={th + ' text-right'}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <FragmentoGrupo key={g.grupo} grupo={g.grupo}>
                  {g.cods.map((c) => [
                    filaRev(c.vigente, true, c.tipo, true),
                    ...(historiales.has(c.cod)
                      ? c.revisiones.slice(1).map((r) => filaRev(r, false, c.tipo))
                      : [])
                  ])}
                </FragmentoGrupo>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-[var(--texto-2)]">
          La vigencia es automática: para cada código, la revisión más alta queda «Vigente» y las
          anteriores «Superadas» (visibles desde «Historial»).
        </p>
      </Card>
    </div>
  );
}

/** Fila-encabezado de grupo + filas hijas (mantiene el estilo de Rubros). */
function FragmentoGrupo({ grupo, children }: { grupo: string; children: ReactNode }) {
  return (
    <>
      <tr className="bg-[var(--color-sud-tinta)] text-[var(--color-sud-crema)]">
        <td className={td + ' text-xs font-semibold uppercase tracking-wide'} colSpan={8}>
          {grupo}
        </td>
      </tr>
      {children}
    </>
  );
}
