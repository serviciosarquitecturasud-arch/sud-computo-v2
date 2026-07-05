/**
 * Catálogo · Tipos de plano — nomenclatura controlada para el registro de
 * documentación por obra (cod = prefijo de grupo + número, ej. IE1, H5).
 * Editable: alta, edición inline y baja. Si un tipo está usado en el registro
 * de documentación de alguna obra, la baja se bloquea con aviso (integridad:
 * los documentos registrados referencian el código).
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ordenGrupos } from '../../core';
import type { Catalogo, Obra, TipoPlano } from '../../core';
import { Btn, Card, td, th } from '../../ui/base';
import { EditCell } from '../../ui/edit';

const inputCls =
  'rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-sud-azul)]';

export function TiposPlano({
  cat,
  setCat,
  obras
}: {
  cat: Catalogo;
  setCat: (c: Catalogo) => void;
  obras: Obra[];
}) {
  const tipos = useMemo(() => cat.tiposPlano ?? [], [cat.tiposPlano]);
  const grupos = useMemo(() => ordenGrupos(tipos), [tipos]);
  const [q, setQ] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [alta, setAlta] = useState(false);
  const [nuevo, setNuevo] = useState<TipoPlano>({ cod: '', den: '', esc: '', grupo: '', sub: '' });

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const visibles = useMemo(() => {
    const nq = norm(q);
    return tipos.filter(
      (t) =>
        (!filtroGrupo || t.grupo === filtroGrupo) &&
        (!nq || norm(t.cod + ' ' + t.den + ' ' + (t.sub ?? '') + ' ' + t.grupo).includes(nq))
    );
  }, [tipos, q, filtroGrupo]);

  const gruposVisibles = useMemo(
    () => ordenGrupos(visibles).map((g) => ({ grupo: g, tipos: visibles.filter((t) => t.grupo === g) })),
    [visibles]
  );

  const upd = (cod: string, patch: Partial<TipoPlano>) =>
    setCat({
      ...cat,
      tiposPlano: tipos.map((t) => (t.cod === cod ? { ...t, ...patch } : t))
    });

  /** Obras cuyo registro de documentación usa este código. */
  const obrasQueUsan = (cod: string): string[] =>
    obras
      .filter((o) => (Array.isArray(o.documentos) ? o.documentos : []).some((d) => d?.cod === cod))
      .map((o) => o.nombre || o.id);

  const del = (t: TipoPlano) => {
    const usos = obrasQueUsan(t.cod);
    if (usos.length) {
      alert(
        `No se puede dar de baja ${t.cod} — ${t.den}: está usado en el registro de documentación de ` +
          `${usos.length === 1 ? 'la obra' : 'las obras'} ${usos.join(', ')}. ` +
          'Eliminá primero esas revisiones (o dejá el tipo en el catálogo).'
      );
      return;
    }
    if (!confirm(`¿Eliminar el tipo de plano ${t.cod} — ${t.den} del catálogo?`)) return;
    setCat({ ...cat, tiposPlano: tipos.filter((x) => x.cod !== t.cod) });
  };

  const agregar = () => {
    const cod = nuevo.cod.trim().toUpperCase();
    const den = nuevo.den.trim();
    const grupo = nuevo.grupo.trim();
    if (!cod || !den || !grupo) {
      alert('Completá al menos código, denominación y grupo.');
      return;
    }
    if (tipos.some((t) => t.cod === cod)) {
      alert(`Ya existe un tipo con el código ${cod}.`);
      return;
    }
    const t: TipoPlano = { cod, den, esc: nuevo.esc.trim(), grupo };
    if (nuevo.sub?.trim()) t.sub = nuevo.sub.trim();
    setCat({ ...cat, tiposPlano: [...tipos, t] });
    setNuevo({ cod: '', den: '', esc: '', grupo, sub: '' });
    setAlta(false);
  };

  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Tipos de plano</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            {tipos.length} tipos en {grupos.length} grupos · nomenclatura controlada del registro de
            documentación por obra (código = prefijo de grupo + número, ej. IE1, H5, CAMAD3).
          </p>
        </div>
        <Btn variante="primario" onClick={() => setAlta((a) => !a)}>
          + Tipo de plano
        </Btn>
      </header>

      {alta && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--texto-2)]">Grupo *</span>
              <input
                className={inputCls + ' w-64'}
                list="grupos-tiposplano"
                value={nuevo.grupo}
                onChange={(e) => setNuevo({ ...nuevo, grupo: e.target.value })}
                placeholder="Existente o nuevo"
              />
              <datalist id="grupos-tiposplano">
                {grupos.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--texto-2)]">Código *</span>
              <input
                className={inputCls + ' w-28 font-mono uppercase'}
                value={nuevo.cod}
                onChange={(e) => setNuevo({ ...nuevo, cod: e.target.value })}
                placeholder="IE9"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--texto-2)]">Denominación *</span>
              <input
                className={inputCls + ' w-72'}
                value={nuevo.den}
                onChange={(e) => setNuevo({ ...nuevo, den: e.target.value })}
                placeholder="Ej.: Tablero seccional"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--texto-2)]">Escala</span>
              <input
                className={inputCls + ' w-28'}
                value={nuevo.esc}
                onChange={(e) => setNuevo({ ...nuevo, esc: e.target.value })}
                placeholder="1,50"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--texto-2)]">Subgrupo</span>
              <input
                className={inputCls + ' w-48'}
                value={nuevo.sub ?? ''}
                onChange={(e) => setNuevo({ ...nuevo, sub: e.target.value })}
                placeholder="(opcional)"
              />
            </label>
            <Btn variante="primario" onClick={agregar}>Agregar</Btn>
            <Btn variante="fantasma" onClick={() => setAlta(false)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar código o denominación"
          className={inputCls + ' w-72'}
        />
        <select className={inputCls} value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
          <option value="">Todos los grupos</option>
          {grupos.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--texto-2)]">{visibles.length} en pantalla</span>
      </div>

      <Card className="overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th + ' w-24'}>Código</th>
              <th className={th}>Denominación</th>
              <th className={th + ' w-52'}>Subgrupo</th>
              <th className={th + ' w-28'}>Escala</th>
              <th className={th + ' w-10'}></th>
            </tr>
          </thead>
          <tbody>
            {gruposVisibles.map((g) => (
              <GrupoFilas key={g.grupo} grupo={g.grupo}>
                {g.tipos.map((t, i) => (
                  <tr key={t.cod + '#' + i}>
                    <td className={td + ' font-mono text-xs text-[var(--texto-2)]'}>{t.cod}</td>
                    <td className={td}>
                      <EditCell value={t.den} onCommit={(v) => upd(t.cod, { den: v })} />
                    </td>
                    <td className={td}>
                      <EditCell
                        value={t.sub ?? ''}
                        onCommit={(v) => upd(t.cod, v.trim() ? { sub: v } : { sub: undefined })}
                      />
                    </td>
                    <td className={td}>
                      <EditCell value={t.esc} onCommit={(v) => upd(t.cod, { esc: v })} />
                    </td>
                    <td className={td + ' text-center'}>
                      <button
                        className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                        onClick={() => del(t)}
                        title="Eliminar tipo de plano"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </GrupoFilas>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--texto-2)]">Sin resultados para el filtro actual.</p>
        )}
      </Card>
    </div>
  );
}

function GrupoFilas({ grupo, children }: { grupo: string; children: ReactNode }) {
  return (
    <>
      <tr className="bg-[var(--color-sud-tinta)] text-[var(--color-sud-crema)]">
        <td className={td + ' text-xs font-semibold uppercase tracking-wide'} colSpan={5}>
          {grupo}
        </td>
      </tr>
      {children}
    </>
  );
}
