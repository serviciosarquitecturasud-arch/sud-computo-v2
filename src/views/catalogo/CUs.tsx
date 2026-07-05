/**
 * Catálogo · Cómputos Unitarios (biblioteca de APUs) — auditoría y edición.
 * REGLA CRÍTICA (paridad legacy): toda modificación de filas de un APU agrega su
 * código a cat.apusEditados (sin duplicar) para blindarlo contra el merge del SEED.
 * Eliminar un APU completo agrega el código a cat.deletedApus, quita sus filas de
 * biblioteca y su fila de rubros.
 */
import { useMemo, useState } from 'react';
import { cmpCodigo, money } from '../../core';
import type { Catalogo, FilaBiblioteca, Motor, Rubro } from '../../core';
import { Badge, Btn, Card } from '../../ui/base';
import { ComboBuscar, EditCell } from '../../ui/edit';

type TipoGrupo = 'M' | 'MO' | 'E';

export function CUs({
  cat,
  setCat,
  motor
}: {
  cat: Catalogo;
  setCat: (c: Catalogo) => void;
  motor: Motor;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const apuCods = useMemo(
    () => [...new Set(cat.biblioteca.map((b) => b.apu))].sort(cmpCodigo),
    [cat.biblioteca]
  );

  const list = useMemo(
    () =>
      apuCods.filter((c) => {
        if (!q) return true;
        const r = motor.rubMap[c] as Rubro | undefined;
        return (c + ' ' + (r ? r.desc : '')).toLowerCase().includes(q.toLowerCase());
      }),
    [apuCods, q, motor]
  );

  // Agrupación por rubro principal (X.00).
  const gruposLista = useMemo(() => {
    const map = new Map<string, string[]>();
    list.forEach((c) => {
      const padre = c.split('.')[0] + '.00';
      const arr = map.get(padre);
      if (arr) arr.push(c);
      else map.set(padre, [c]);
    });
    return [...map.entries()].sort((a, b) => cmpCodigo(a[0], b[0]));
  }, [list]);

  const filas = useMemo(() => cat.biblioteca.filter((b) => b.apu === sel), [cat.biblioteca, sel]);
  const rub = sel ? (motor.rubMap[sel] as Rubro | undefined) : undefined;
  const huerfanos = sel ? motor.apuHuerfanos(sel) : [];

  /** Blindaje contra el merge del SEED: agrega cod a apusEditados sin duplicar. */
  const conApuEditado = (cod: string): string[] => {
    const ed = Array.isArray(cat.apusEditados) ? cat.apusEditados : [];
    return ed.includes(cod) ? ed : [...ed, cod];
  };

  const addApu = () => {
    const cod = (
      prompt('Código del nuevo CU (debe coincidir con un rubro existente o crear uno nuevo, ej "1.10", "4.02.08"):') ||
      ''
    ).trim();
    if (!cod) return;
    if (apuCods.includes(cod)) {
      alert('Ya existe un CU con ese código. Lo selecciono para que lo edites.');
      setSel(cod);
      return;
    }
    const filaNueva: FilaBiblioteca = { apu: cod, tipo: 'M', insumo: '', cant: 0, nota: '' };
    const sinDeleted = (Array.isArray(cat.deletedApus) ? cat.deletedApus : []).filter((x) => x !== cod);
    if (!cat.rubros.some((r) => r.cod === cod)) {
      const crear = confirm('No existe un rubro con código "' + cod + '". ¿Crearlo también en el catálogo de rubros?');
      if (!crear) return;
      const desc = prompt('Descripción del rubro:') || '';
      const unidad = prompt('Unidad (m², m³, ml, U, kg, Gl, ...):') || '';
      const padre = cod.split('.')[0] + '.00';
      const padreObj = cat.rubros.find((r) => r.cod === padre);
      setCat({
        ...cat,
        rubros: [...cat.rubros, { cod, rubro: padreObj ? padreObj.desc : '', subrubro: '', desc, unidad }],
        biblioteca: [...cat.biblioteca, filaNueva],
        deletedApus: sinDeleted
      });
    } else {
      setCat({ ...cat, biblioteca: [...cat.biblioteca, filaNueva], deletedApus: sinDeleted });
    }
    setSel(cod);
  };

  const updFila = (idx: number, patch: Partial<FilaBiblioteca>) => {
    if (!sel) return;
    let n = -1;
    setCat({
      ...cat,
      apusEditados: conApuEditado(sel),
      biblioteca: cat.biblioteca.map((b) => {
        if (b.apu !== sel) return b;
        n++;
        return n === idx ? { ...b, ...patch } : b;
      })
    });
  };

  const delFila = (idx: number) => {
    if (!sel) return;
    let n = -1;
    setCat({
      ...cat,
      apusEditados: conApuEditado(sel),
      biblioteca: cat.biblioteca.filter((b) => {
        if (b.apu !== sel) return true;
        n++;
        return n !== idx;
      })
    });
  };

  const addFila = (tipo: TipoGrupo) => {
    if (!sel) return;
    setCat({
      ...cat,
      apusEditados: conApuEditado(sel),
      biblioteca: [...cat.biblioteca, { apu: sel, tipo, insumo: '', cant: 0, nota: '' }]
    });
  };

  const delApu = () => {
    if (!sel) return;
    if (!confirm('¿Eliminar completamente el CU ' + sel + '? Se borrarán todas sus filas y su rubro del catálogo.'))
      return;
    const dele = Array.isArray(cat.deletedApus) ? cat.deletedApus : [];
    setCat({
      ...cat,
      biblioteca: cat.biblioteca.filter((b) => b.apu !== sel),
      rubros: cat.rubros.filter((r) => r.cod !== sel),
      deletedApus: dele.includes(sel) ? dele : [...dele, sel]
    });
    setSel(null);
  };

  const updRubro = (patch: Partial<Rubro>) => {
    if (!sel) return;
    setCat({ ...cat, rubros: cat.rubros.map((r) => (r.cod === sel ? { ...r, ...patch } : r)) });
  };

  const nombreInsumo = (f: FilaBiblioteca): string => {
    if (f.tipo === 'M') return motor.matMap[f.insumo]?.desc ?? '';
    if (f.tipo === 'MO') return motor.moMap[f.insumo]?.desc ?? '';
    if (f.tipo === 'E') return motor.herrMap[f.insumo]?.desc ?? '';
    return '';
  };

  const gruposInsumo: { t: TipoGrupo; label: string; opciones: { clave: string; texto: string }[] }[] = [
    {
      t: 'M',
      label: 'Materiales',
      opciones: cat.materiales.map((m) => ({ clave: m.cod, texto: `${m.cod} — ${m.desc} (${m.unidad})` }))
    },
    {
      t: 'MO',
      label: 'Mano de obra',
      opciones: cat.manoObra.map((o) => ({ clave: o.cod, texto: `${o.cod} — ${o.desc} (${o.unidad})` }))
    },
    {
      t: 'E',
      label: 'Equipos',
      opciones: cat.herramientas.map((h) => ({ clave: h.cod, texto: `${h.cod} — ${h.desc}` }))
    }
  ];

  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Cómputos Unitarios</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            {apuCods.length} CU en la biblioteca. Cada CU es la receta de insumos de un ítem; su costo
            unitario se calcula solo.
          </p>
        </div>
        <Btn variante="primario" onClick={addApu}>
          + Nuevo CU
        </Btn>
      </header>

      <div className="flex gap-4">
        {/* Lista de CUs agrupada por rubro principal */}
        <div className="w-80 shrink-0">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar CU"
            className="mb-2 w-full rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-sud-azul)]"
          />
          <Card className="max-h-[560px] overflow-y-auto">
            {gruposLista.length === 0 && (
              <div className="p-4 text-center text-xs text-[var(--texto-2)]">Sin resultados.</div>
            )}
            {gruposLista.map(([padre, cods]) => {
              const rp = motor.rubMap[padre] as Rubro | undefined;
              return (
                <div key={padre}>
                  <div className="sticky top-0 z-10 border-b border-[var(--borde)] bg-[var(--color-neutro-100)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)] dark:bg-[var(--color-neutro-800)]">
                    {padre} · {rp ? rp.desc : 'Sin rubro'}
                  </div>
                  {cods.map((c) => {
                    const r = motor.rubMap[c] as Rubro | undefined;
                    const nHuer = motor.apuHuerfanos(c).length;
                    return (
                      <button
                        key={c}
                        onClick={() => setSel(c)}
                        className={
                          'block w-full border-b border-[var(--borde)] px-3 py-2 text-left text-sm ' +
                          (sel === c
                            ? 'bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]'
                            : 'hover:bg-[var(--color-neutro-100)] dark:hover:bg-[var(--color-neutro-800)]')
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-[var(--texto-2)]">{c}</span>
                          <span className="flex items-center gap-1.5">
                            {nHuer > 0 && <Badge tono="alerta">{nHuer} huérf.</Badge>}
                            <span className="font-mono text-xs tabular-nums text-[var(--texto-2)]">
                              {money(motor.costoAPU(c))}
                            </span>
                          </span>
                        </div>
                        <div className="leading-tight">{r ? r.desc : '—'}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </Card>
        </div>

        {/* Detalle del CU seleccionado */}
        <div className="min-w-0 flex-1">
          {!sel ? (
            <Card className="p-10 text-center text-sm text-[var(--texto-2)]">
              Elegí un Cómputo Unitario de la lista para auditarlo o editarlo.
            </Card>
          ) : (
            <Card className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3 border-b border-[var(--borde)] pb-3">
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="shrink-0 font-mono text-sm text-[var(--texto-2)]">{sel}</span>
                  {rub ? (
                    <>
                      <div className="min-w-0 flex-1">
                        <EditCell value={rub.desc} onCommit={(v) => updRubro({ desc: v })} />
                      </div>
                      <span className="flex shrink-0 items-baseline gap-1 text-xs text-[var(--texto-2)]">
                        por
                        <span className="inline-block w-16">
                          <EditCell value={rub.unidad} onCommit={(v) => updRubro({ unidad: v })} />
                        </span>
                      </span>
                    </>
                  ) : (
                    <Badge tono="alerta">sin rubro en catálogo</Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Btn variante="peligro" onClick={delApu}>
                    Eliminar CU
                  </Btn>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--texto-2)]">
                      Costo directo unitario
                    </div>
                    <div className="font-mono text-xl tabular-nums">{money(motor.costoAPU(sel))}</div>
                  </div>
                </div>
              </div>

              {huerfanos.length > 0 && (
                <div className="mb-3 rounded-md border border-[var(--color-alerta)]/40 bg-[var(--color-alerta)]/10 px-3 py-2 text-sm text-[var(--color-alerta)]">
                  Este CU tiene insumos que no existen en el catálogo (cuentan $ 0):{' '}
                  {huerfanos.map((b) => b.tipo + ' ' + b.insumo).join(', ')}
                </div>
              )}

              {gruposInsumo.map((g) => {
                const filasG = filas.map((f, i) => ({ f, i })).filter((x) => x.f.tipo === g.t);
                return (
                  <div key={g.t} className="mb-4">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]">
                        {g.label}
                      </h3>
                      <Btn variante="fantasma" className="text-xs" onClick={() => addFila(g.t)}>
                        + Agregar
                      </Btn>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {filasG.length === 0 && (
                          <tr>
                            <td className="py-1 text-xs text-[var(--texto-2)]">— sin insumos —</td>
                          </tr>
                        )}
                        {filasG.map(({ f, i }) => {
                          const existe = motor.insumoExiste(f.tipo, f.insumo);
                          const cu = motor.costoInsumo(f.tipo, f.insumo);
                          return (
                            <tr key={i} className="border-b border-[var(--borde)]">
                              <td className="w-64 py-1 pr-2 align-middle">
                                <ComboBuscar
                                  opciones={g.opciones}
                                  onElegir={(clave) => updFila(i, { insumo: clave })}
                                  placeholder={f.insumo || 'Buscar insumo…'}
                                />
                              </td>
                              <td className="py-1 pr-2 align-middle">
                                {existe ? (
                                  <span>{nombreInsumo(f)}</span>
                                ) : (
                                  <Badge tono="alerta">✗ {f.insumo || 'sin insumo'} — no está en catálogo</Badge>
                                )}
                              </td>
                              <td className="w-24 py-1 pr-2 align-middle">
                                <EditCell
                                  tipo="number"
                                  value={f.cant}
                                  onCommit={(v) => updFila(i, { cant: Number(v) || 0 })}
                                />
                              </td>
                              <td className="w-40 py-1 pr-2 align-middle">
                                <EditCell
                                  value={f.nota}
                                  placeholder="nota"
                                  onCommit={(v) => updFila(i, { nota: v })}
                                />
                              </td>
                              <td className="w-28 py-1 pr-2 text-right align-middle font-mono text-xs tabular-nums text-[var(--texto-2)]">
                                {money(cu)}
                              </td>
                              <td className="w-28 py-1 pr-2 text-right align-middle font-mono tabular-nums">
                                {money(f.cant * cu)}
                              </td>
                              <td className="w-8 py-1 text-center align-middle">
                                <button
                                  className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                                  onClick={() => delFila(i)}
                                  title="Eliminar fila"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
