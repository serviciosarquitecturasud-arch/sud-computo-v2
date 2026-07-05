/**
 * Cómputo — la vista central: planilla de cotización agrupada por rubro principal.
 * CU con APU → calculado por el motor; sin APU → precio manual editable.
 */
import { calcCoef, cmpCodigo, coefDefault, fmtN, money } from '../../core';
import type { Catalogo, ItemObra, Motor, Obra } from '../../core';
import { Badge, Btn, Card, td, th } from '../../ui/base';
import { ComboBuscar, EditCell } from '../../ui/edit';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

interface Fila extends ItemObra {
  _idx: number;
  desc: string;
  unidad: string;
  tieneApu: boolean;
  unit: number;
  total: number;
}

interface Grupo {
  rp: string;
  nombre: string;
  filas: Fila[];
  total: number;
}

export function Computo({ obra, setObra, cat, motor }: Props) {
  const items = obra.items ?? [];
  const coef = calcCoef(obra.coef ?? coefDefault());

  const setItems = (its: ItemObra[]) => setObra({ ...obra, items: its });
  const updItem = (idx: number, patch: Partial<ItemObra>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const delItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const addItem = (cod: string) => {
    if (items.some((i) => i.cod === cod)) return;
    const nuevo: ItemObra = motor.bibMap[cod] ? { cod, cant: 0 } : { cod, cant: 0, precioManual: 0 };
    setItems([...items, nuevo]);
  };

  // ── Filas con cálculo ──
  const filas: Fila[] = items.map((it, i) => {
    const r = motor.rubMap[it.cod];
    const tieneApu = motor.apuTiene(it.cod);
    const unit = tieneApu ? motor.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;
    return {
      ...it,
      _idx: i,
      desc: r?.desc ?? '—',
      unidad: r?.unidad ?? '',
      tieneApu,
      unit,
      total: unit * (it.cant || 0)
    };
  });
  const costoDirecto = filas.reduce((s, f) => s + f.total, 0);

  // ── Agrupación por rubro principal ──
  const grupos: Grupo[] = (() => {
    const map: Record<string, Grupo> = {};
    filas.forEach((f) => {
      const rp = String(f.cod || '').split('.')[0];
      if (!map[rp]) {
        const r = motor.rubMap[rp + '.00'] ?? motor.rubMap[rp];
        map[rp] = { rp, nombre: r?.desc ? r.desc : 'Rubro ' + rp, filas: [], total: 0 };
      }
      map[rp].filas.push(f);
      map[rp].total += f.total;
    });
    return Object.values(map)
      .sort((a, b) => cmpCodigo(a.rp, b.rp))
      .map((g) => ({ ...g, filas: [...g.filas].sort((a, b) => cmpCodigo(a.cod, b.cod)) }));
  })();

  // ── Opciones para agregar ítem (excluye títulos x.00 y ya cargados) ──
  const opciones = (cat.rubros ?? [])
    .filter((r) => r.desc && r.unidad && !r.cod.endsWith('.00') && !items.some((i) => i.cod === r.cod))
    .sort((a, b) => cmpCodigo(a.cod, b.cod))
    .map((r) => ({ clave: r.cod, texto: `${r.cod} — ${r.desc}` }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Cómputo</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            {items.length} ítem(s) · CU con <Badge tono="info">APU</Badge> lo calcula el motor; sin APU el
            precio unitario es <Badge tono="alerta">manual</Badge> y se edita acá.
          </p>
        </div>
        <div className="w-full max-w-md">
          <ComboBuscar
            opciones={opciones}
            placeholder="Agregar ítem: buscar por código o descripción…"
            onElegir={addItem}
          />
        </div>
      </div>

      {filas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Sin ítems todavía. Buscá un ítem del catálogo de rubros para empezar el cómputo.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={`${th} w-24`}>Código</th>
                <th className={th}>Descripción</th>
                <th className={`${th} w-14`}>Un.</th>
                <th className={`${th} w-24 text-right`}>Cant.</th>
                <th className={`${th} w-32 text-right`}>CU</th>
                <th className={`${th} w-32 text-right`}>Costo directo</th>
                <th className={`${th} w-32 text-right`}>Precio final</th>
                <th className={`${th} w-10`}></th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <FilasRubro
                  key={g.rp}
                  grupo={g}
                  coef={coef}
                  updItem={updItem}
                  delItem={delItem}
                />
              ))}
              <tr className="font-semibold">
                <td className={`${td} border-t-2 border-[var(--borde)]`} colSpan={5}>
                  TOTAL GENERAL
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                  {money(costoDirecto)}
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                  {money(costoDirecto * coef)}
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)]`}></td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-[var(--texto-2)]">
        Precio final = costo directo × coeficiente de pase (
        {coef.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}).
      </p>
    </div>
  );
}

function FilasRubro({
  grupo,
  coef,
  updItem,
  delItem
}: {
  grupo: Grupo;
  coef: number;
  updItem: (idx: number, patch: Partial<ItemObra>) => void;
  delItem: (idx: number) => void;
}) {
  return (
    <>
      <tr className="bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]">
        <td className={`${td} font-mono text-xs`}>{grupo.rp + '.00'}</td>
        <td className={`${td} text-xs font-semibold uppercase tracking-wide`} colSpan={4}>
          {grupo.nombre}
        </td>
        <td className={`${td} text-right font-mono font-semibold tabular-nums`}>{money(grupo.total)}</td>
        <td className={`${td} text-right font-mono font-semibold tabular-nums`}>
          {money(grupo.total * coef)}
        </td>
        <td className={td}></td>
      </tr>
      {grupo.filas.map((f) => (
        <tr key={f.cod}>
          <td className={`${td} pl-4 font-mono text-xs text-[var(--texto-2)]`}>{f.cod}</td>
          <td className={td}>{f.desc}</td>
          <td className={`${td} text-[var(--texto-2)]`}>{f.unidad}</td>
          <td className={`${td} text-right`}>
            <EditCell
              value={f.cant || 0}
              tipo="number"
              onCommit={(v) => updItem(f._idx, { cant: Number(v) || 0 })}
            />
          </td>
          <td className={`${td} text-right`}>
            {f.tieneApu ? (
              <span className="font-mono tabular-nums" title="Calculado por APU">
                {money(f.unit)}
              </span>
            ) : (
              <span title="Sin APU: precio manual">
                <EditCell
                  value={f.precioManual ?? 0}
                  tipo="number"
                  className="border-[var(--color-alerta)]/40"
                  onCommit={(v) => updItem(f._idx, { precioManual: Number(v) || 0 })}
                />
              </span>
            )}
          </td>
          <td className={`${td} text-right font-mono tabular-nums`}>{money(f.total)}</td>
          <td className={`${td} text-right font-mono tabular-nums`}>{money(f.total * coef)}</td>
          <td className={`${td} text-right`}>
            <Btn
              variante="fantasma"
              className="px-1.5 py-0.5 text-[var(--color-alerta)]"
              title={'Eliminar ' + f.cod}
              onClick={() => delItem(f._idx)}
            >
              ✕
            </Btn>
          </td>
        </tr>
      ))}
      {grupo.filas.length > 1 && (
        <tr className="text-xs text-[var(--texto-2)]">
          <td className={td} colSpan={5}>
            Subtotal {grupo.nombre} · {fmtN(grupo.filas.length)} ítem(s)
          </td>
          <td className={`${td} text-right font-mono tabular-nums`}>{money(grupo.total)}</td>
          <td className={`${td} text-right font-mono tabular-nums`}>{money(grupo.total * coef)}</td>
          <td className={td}></td>
        </tr>
      )}
    </>
  );
}
