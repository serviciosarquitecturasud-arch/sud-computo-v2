/**
 * Import Revit (H3) — port del flujo legacy con la regla de negocio del proyecto:
 * el mapeo elemento → código SUD sale SOLO del campo Comentarios del elemento
 * (nunca del Type name). Filas sin comentario se reportan y no se importan.
 */
import { useMemo, useRef, useState } from 'react';
import type { Catalogo, Obra } from '../core';
import type { Motor } from '../core';
import { cmpCodigo, fmtN, uid } from '../core';
import {
  aplicarRevitAObra,
  diffContraObra,
  estadoVinculo,
  prepararImport,
  validateRevitPayload,
  type ResultadoAplicar,
  type RevitPayload,
  type RevitVinculo
} from '../core/revit';
import { Badge, Btn, Card, SectionTitle, td, th } from '../ui/base';

const inputCls =
  'rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-1.5 text-sm ' +
  'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

export function Revit({
  cat,
  motor,
  obras,
  setObras,
  revitMap,
  setRevitMap,
  onAbrirObra
}: {
  cat: Catalogo;
  motor: Motor;
  obras: Obra[];
  setObras: (o: Obra[]) => void;
  revitMap: Record<string, string>;
  setRevitMap: (m: Record<string, string>) => void;
  onAbrirObra: (id: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [data, setData] = useState<RevitPayload | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [obraDestinoId, setObraDestinoId] = useState('');
  const [nombreNueva, setNombreNueva] = useState('');
  const [resultado, setResultado] = useState<(ResultadoAplicar & { obraId: string; obraNombre: string }) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const obraDestino = useMemo(
    () => (obraDestinoId ? obras.find((o) => o.id === obraDestinoId) || null : null),
    [obras, obraDestinoId]
  );

  const validar = () => {
    setErrores([]);
    setWarnings([]);
    setData(null);
    setResultado(null);
    if (!texto.trim()) {
      setErrores(['El campo está vacío. Pegá el JSON o subí un archivo.']);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(texto);
    } catch (err) {
      setErrores(['JSON inválido: ' + (err as Error).message]);
      return;
    }
    const res = validateRevitPayload(parsed);
    if (res.errs.length > 0) {
      setErrores(res.errs);
      setWarnings(res.warns);
      return;
    }
    setWarnings(res.warns);
    setData(parsed as RevitPayload);
  };

  const limpiar = () => {
    setTexto('');
    setData(null);
    setErrores([]);
    setWarnings([]);
    setResultado(null);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTexto(String(ev.target?.result || ''));
      setErrores([]);
      setWarnings([]);
      setData(null);
      setResultado(null);
    };
    reader.readAsText(f);
  };

  const prep = useMemo(() => (data ? prepararImport(data, cat.rubros || [], revitMap) : null), [data, cat.rubros, revitMap]);

  const vinculo = useMemo(() => (data && obraDestino ? estadoVinculo(data, obraDestino) : null), [data, obraDestino]);

  const diff = useMemo(
    () => (data && prep && obraDestino ? diffContraObra(data, prep, obraDestino) : null),
    [data, prep, obraDestino]
  );

  const rubrosValidos = useMemo(
    () =>
      (cat.rubros || [])
        .filter((r) => r.unidad && !r.cod.endsWith('.00'))
        .slice()
        .sort((a, b) => cmpCodigo(a.cod, b.cod)),
    [cat.rubros]
  );

  const sinMapear = prep ? prep.grupos.filter((g) => !g.rubroValido) : [];
  const puedeAplicar = !!(data && prep && obraDestino && prep.rubros.length > 0 && (!vinculo || vinculo.tipo !== 'mismatch'));

  const crearObraDestino = () => {
    const nombre = nombreNueva.trim();
    if (!nombre) return;
    const o: Obra = {
      id: uid(),
      nombre,
      comitente: '',
      direccion: '',
      items: [],
      coef: { ggd: 0, ggi: 0, imp: 0, ben: 0, iva: 0, iib: 0 },
      creada: new Date().toISOString(),
      caratula: {},
      superficies: { cub: 0, semi: 0, desc: 0 },
      precios: {},
      proveedores: {},
      plan: { hsSem: 45, rubros: {} },
      materialesConfig: {},
      cotizacionesPorRubro: {}
    };
    setObras([...obras, o]);
    setObraDestinoId(o.id);
    setNombreNueva('');
  };

  const aplicar = () => {
    if (!puedeAplicar || !data || !obraDestino) return;
    const res = aplicarRevitAObra(obraDestino, data, cat.rubros || [], revitMap);
    setObras(obras.map((o) => (o.id === obraDestino.id ? res.obra : o)));
    setResultado({ ...res, obraId: obraDestino.id, obraNombre: String(obraDestino.nombre || '') });
  };

  const asignarMapeo = (comentario: string, cod: string) => {
    if (!cod) return;
    setRevitMap({ ...revitMap, [comentario]: cod });
  };
  const quitarMapeo = (comentario: string) => {
    const next = { ...revitMap };
    delete next[comentario];
    setRevitMap(next);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Import Revit</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Pegá el JSON exportado de Revit (NonicaTab). El mapeo a rubros SUD sale del campo{' '}
          <strong>Comentarios</strong> de cada elemento — nunca del nombre de tipo.
        </p>
      </header>

      {/* ── Entrada ─────────────────────────────────────────── */}
      {!data && (
        <Card className="p-5">
          <SectionTitle>1 · Pegar JSON o subir archivo</SectionTitle>
          <textarea
            className={`${inputCls} w-full font-mono text-xs`}
            rows={10}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder='{ "metadata": { "schemaVersion": "1.1", ... }, "elementos": [ ... ] }'
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json,text/plain"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Btn onClick={() => fileRef.current?.click()}>Subir archivo…</Btn>
            <Btn variante="primario" disabled={!texto.trim()} onClick={validar}>
              Validar y cargar
            </Btn>
            {texto && <Btn variante="fantasma" onClick={limpiar}>Limpiar</Btn>}
            <span className="ml-auto text-xs text-[var(--texto-2)]">
              {texto ? `${texto.length.toLocaleString('es-AR')} caracteres` : 'sin contenido'}
            </span>
          </div>
        </Card>
      )}

      {/* ── Errores / advertencias ──────────────────────────── */}
      {errores.length > 0 && (
        <Card className="border-[var(--color-alerta)]/40 p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--color-alerta)]">
            {errores.length} {errores.length === 1 ? 'error' : 'errores'} de validación:
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-[var(--color-alerta)]">
            {errores.slice(0, 20).map((m, i) => (
              <li key={i} className="font-mono">{m}</li>
            ))}
            {errores.length > 20 && <li className="italic">…y {errores.length - 20} error(es) más</li>}
          </ul>
        </Card>
      )}
      {warnings.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--texto)]">
            <Badge tono="alerta">{warnings.length} {warnings.length === 1 ? 'advertencia' : 'advertencias'}</Badge>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--texto-2)]">
            {warnings.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Payload validado ────────────────────────────────── */}
      {data && prep && (
        <>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-marca text-lg leading-tight">{data.metadata.proyecto}</p>
                <p className="mt-0.5 text-xs text-[var(--texto-2)]">
                  JSON validado · schema {data.metadata.schemaVersion} · {data.elementos.length}{' '}
                  {data.elementos.length === 1 ? 'elemento' : 'elementos'}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.1em] text-[var(--texto-2)]">Ruta del archivo Revit</p>
                <p className="break-all font-mono text-xs">
                  {data.metadata.documentoHostRuta || (
                    <span className="text-[var(--color-alerta)]">
                      sin ruta (schema 1.0) — la vinculación obra ↔ archivo no es robusta
                    </span>
                  )}
                </p>
              </div>
              <Btn variante="fantasma" onClick={limpiar}>✕ Limpiar</Btn>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge tono="info">{prep.rubros.length} rubros a importar</Badge>
              <Badge tono={prep.sinComentario.length ? 'alerta' : 'ok'}>
                {prep.sinComentario.length} sin comentario
              </Badge>
              {sinMapear.length > 0 && <Badge tono="alerta">{sinMapear.length} comentarios sin rubro válido</Badge>}
              {prep.excluidos.fueraMvp > 0 && <Badge>{prep.excluidos.fueraMvp} fuera de categorías MVP</Badge>}
              {prep.sinMagnitud.length > 0 && (
                <Badge tono="alerta">{prep.sinMagnitud.length} sin magnitud requerida</Badge>
              )}
            </div>
          </Card>

          {/* ── Filas sin comentario ──────────────────────────── */}
          {prep.sinComentario.length > 0 && (
            <Card className="border-[var(--color-alerta)]/40 p-5">
              <SectionTitle>Filas sin comentario</SectionTitle>
              <p className="mb-3 text-sm text-[var(--color-alerta)]">
                {prep.sinComentario.length} {prep.sinComentario.length === 1 ? 'fila' : 'filas'} sin comentario, cargar y
                reintentar. El campo Comentarios del elemento es la única fuente de mapeo: completalo en Revit con el
                código SUD y volvé a exportar. Estas filas <strong>no se importan</strong>.
              </p>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Categoría</th>
                      <th className={th}>Tipo</th>
                      <th className={th}>Nivel</th>
                      <th className={th}>Id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prep.sinComentario.map((f) => (
                      <tr key={f.uid}>
                        <td className={td}>{f.categoria}</td>
                        <td className={td}>{f.tipo}</td>
                        <td className={`${td} text-[var(--texto-2)]`}>{f.nivel || '—'}</td>
                        <td className={`${td} font-mono text-xs`}>{String(f.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ── Mapeo por comentario ──────────────────────────── */}
          <Card className="p-5">
            <SectionTitle>2 · Mapeo por campo Comentarios</SectionTitle>
            <p className="mb-3 text-sm text-[var(--texto-2)]">
              Si el comentario ya es un código de rubro válido, se usa directo. Si no, asignale un rubro: queda guardado
              en la biblioteca de mapeos (<span className="font-mono text-xs">cmp_revitMap</span>) para futuros imports.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Comentario</th>
                  <th className={th}>Elementos</th>
                  <th className={th}>Tipos (informativo)</th>
                  <th className={th}>Rubro SUD</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {prep.grupos.map((g) => (
                  <tr key={g.comentario}>
                    <td className={`${td} font-mono text-xs`}>{g.comentario}</td>
                    <td className={`${td} tabular-nums`}>{g.count}</td>
                    <td className={`${td} max-w-56 truncate text-xs text-[var(--texto-2)]`} title={g.tipos.join(' · ')}>
                      {g.tipos.join(' · ')}
                    </td>
                    <td className={td}>
                      {g.rubroValido ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs">{g.codFinal}</span>
                          <span className="text-xs text-[var(--texto-2)]">
                            {g.rubroDesc} ({g.rubroUnidad})
                          </span>
                          <Badge tono={g.fuente === 'mapaManual' ? 'info' : 'ok'}>
                            {g.fuente === 'mapaManual' ? 'mapa manual' : 'comentario'}
                          </Badge>
                          {motor.apuTiene(g.codFinal) ? <Badge tono="ok">APU</Badge> : <Badge>precio manual</Badge>}
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tono="alerta">sin rubro válido</Badge>
                          <select
                            className={`${inputCls} max-w-64 py-0.5 text-xs`}
                            value=""
                            onChange={(e) => asignarMapeo(g.comentario, e.target.value)}
                          >
                            <option value="">Asignar rubro…</option>
                            {rubrosValidos.map((r) => (
                              <option key={r.cod} value={r.cod}>
                                {r.cod} — {r.desc} ({r.unidad})
                              </option>
                            ))}
                          </select>
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      {g.fuente === 'mapaManual' && (
                        <Btn variante="fantasma" className="px-2 py-0.5 text-xs" onClick={() => quitarMapeo(g.comentario)}>
                          quitar mapeo
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* ── Obra destino ──────────────────────────────────── */}
          <Card className="p-5">
            <SectionTitle>3 · Obra destino</SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${inputCls} min-w-64`}
                value={obraDestinoId}
                onChange={(e) => setObraDestinoId(e.target.value)}
              >
                <option value="">Elegí una obra…</option>
                {obras.map((o) => {
                  const v = o.revitVinculo as RevitVinculo | undefined;
                  return (
                    <option key={o.id} value={o.id}>
                      {String(o.nombre || '(sin nombre)')}
                      {v && v.rutaArchivo ? ' · vinculada' : ''}
                    </option>
                  );
                })}
              </select>
              <span className="text-xs text-[var(--texto-2)]">o crear nueva:</span>
              <input
                className={`${inputCls} w-52`}
                placeholder="Nombre de la nueva obra…"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && crearObraDestino()}
              />
              <Btn disabled={!nombreNueva.trim()} onClick={crearObraDestino}>+ Crear</Btn>
            </div>

            {vinculo && (
              <div className="mt-4 rounded-md border border-[var(--borde)] p-3 text-sm">
                {vinculo.tipo === 'match' && (
                  <p>
                    <Badge tono="ok">vinculación OK</Badge>{' '}
                    <span className="text-[var(--texto-2)]">La obra ya está vinculada a</span>{' '}
                    <span className="break-all font-mono text-xs">{vinculo.ruta}</span>
                  </p>
                )}
                {vinculo.tipo === 'noVinculada' && (
                  <p className="text-[var(--texto-2)]">
                    <Badge tono="info">se vinculará</Badge> La obra no tiene archivo Revit vinculado: al aplicar quedará
                    vinculada a <span className="break-all font-mono text-xs">{data.metadata.documentoHostRuta}</span>.
                  </p>
                )}
                {vinculo.tipo === 'sinRuta' && (
                  <p className="text-[var(--texto-2)]">
                    <Badge tono="alerta">sin ruta</Badge> El JSON (schema 1.0) no trae ruta de archivo: no se puede
                    vincular obra ↔ archivo de forma robusta.
                  </p>
                )}
                {vinculo.tipo === 'sinRutaJson' && (
                  <p className="text-[var(--texto-2)]">
                    <Badge tono="alerta">sin ruta en JSON</Badge> La obra está vinculada a{' '}
                    <span className="break-all font-mono text-xs">{vinculo.rutaObra}</span> pero el JSON (schema 1.0) no
                    trae ruta: no se puede verificar que sea el mismo archivo.
                  </p>
                )}
                {vinculo.tipo === 'mismatch' && (
                  <div className="text-sm">
                    <p className="font-semibold text-[var(--color-alerta)]">
                      ⚠ Esta obra está vinculada a OTRO archivo Revit.
                    </p>
                    <p className="mt-1 text-xs text-[var(--texto-2)]">
                      Obra: <span className="break-all font-mono">{vinculo.rutaObra}</span>
                      <br />
                      JSON: <span className="break-all font-mono">{vinculo.rutaJson}</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--texto-2)]">
                      Para evitar pisar cómputos de otro modelo, el import está bloqueado. Desvinculá el archivo desde la
                      obra o elegí la obra correcta.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* ── Diff ──────────────────────────────────────────── */}
          {obraDestino && diff && (
            <Card className="p-5">
              <SectionTitle>4 · Diferencias contra “{String(obraDestino.nombre || '')}”</SectionTitle>
              {prep.rubros.length === 0 ? (
                <p className="text-sm text-[var(--texto-2)]">
                  No hay rubros importables todavía: revisá comentarios sin cargar o sin rubro válido.
                </p>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={th}>Código</th>
                        <th className={th}>Rubro</th>
                        <th className={th}>Estado</th>
                        <th className={`${th} text-right`}>Cant. actual</th>
                        <th className={`${th} text-right`}>Cant. Revit</th>
                        <th className={th}>Elementos (uid)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.filas.map((f) => (
                        <tr key={f.cod}>
                          <td className={`${td} font-mono text-xs`}>{f.cod}</td>
                          <td className={td}>
                            {f.desc} <span className="text-xs text-[var(--texto-2)]">({f.unidad})</span>
                            {f.conflictoManual && (
                              <span className="ml-1.5">
                                <Badge tono="alerta">pisa carga manual</Badge>
                              </span>
                            )}
                          </td>
                          <td className={td}>
                            {f.estado === 'nuevo' && <Badge tono="info">nuevo</Badge>}
                            {f.estado === 'cambia' && <Badge tono="alerta">cambia</Badge>}
                            {f.estado === 'igual' && <Badge tono="ok">igual</Badge>}
                          </td>
                          <td className={`${td} text-right font-mono tabular-nums text-xs`}>
                            {f.cantAnterior === null ? '—' : fmtN(f.cantAnterior)}
                          </td>
                          <td className={`${td} text-right font-mono tabular-nums text-xs`}>{fmtN(f.cantNueva)}</td>
                          <td className={`${td} text-xs text-[var(--texto-2)]`}>
                            +{f.elementos.nuevos.length} · ~{f.elementos.modificados.length} · −
                            {f.elementos.eliminados.length} · ={f.elementos.sinCambios.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-[var(--texto-2)]">
                    Elementos: {diff.total.nuevos} nuevos · {diff.total.modificados} modificados ·{' '}
                    {diff.total.eliminados} eliminados · {diff.total.sinCambios} sin cambios
                    {diff.hayReimport ? ' · re-import sobre datos Revit previos' : ''}
                  </p>
                </>
              )}
              <div className="mt-4 flex items-center gap-3">
                <Btn variante="primario" disabled={!puedeAplicar} onClick={aplicar}>
                  Aplicar import a la obra
                </Btn>
                {!puedeAplicar && vinculo?.tipo === 'mismatch' && (
                  <span className="text-xs text-[var(--color-alerta)]">bloqueado por vinculación a otro archivo</span>
                )}
              </div>
            </Card>
          )}

          {/* ── Resultado ─────────────────────────────────────── */}
          {resultado && (
            <Card className="border-[var(--color-ok)]/40 p-5">
              <p className="text-sm font-semibold">
                ✓ Import aplicado a “{resultado.obraNombre}”
              </p>
              <p className="mt-1 text-sm text-[var(--texto-2)]">
                {resultado.nuevos} ítems nuevos · {resultado.reimportados} re-importados ·{' '}
                {resultado.conflictosResueltos} cargas manuales pisadas
                {resultado.autoVinculo && resultado.rutaArchivo && (
                  <>
                    {' '}· obra vinculada a <span className="break-all font-mono text-xs">{resultado.rutaArchivo}</span>
                  </>
                )}
              </p>
              {resultado.sinComentario.length > 0 && (
                <p className="mt-1 text-sm text-[var(--color-alerta)]">
                  Quedaron {resultado.sinComentario.length} filas sin comentario sin importar: cargar el comentario en
                  Revit y reintentar.
                </p>
              )}
              <div className="mt-3">
                <Btn variante="primario" onClick={() => onAbrirObra(resultado.obraId)}>
                  Abrir obra →
                </Btn>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
