/**
 * Carátula — datos generales, superficies y resumen económico de la obra.
 * Ponderación de superficies (legacy): cubierto + 0,5·semicubierto + 0,25·descubierto.
 */
import { calcCoef, coefDefault, fmt, fmtN, money } from '../../core';
import type { Catalogo, ItemObra, Motor, Obra } from '../../core';
import { Card, SectionTitle } from '../../ui/base';
import { EditArea, EditCell, EditSelect } from '../../ui/edit';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

interface CaratulaData {
  estado?: string;
  fechaCot?: string;
  tipoCambio?: number | string;
  fechaTC?: string;
  fechaInicioObra?: string;
  fechaFinObra?: string;
  [k: string]: unknown;
}

interface Superficies {
  cub?: number | string;
  semi?: number | string;
  desc?: number | string;
  [k: string]: unknown;
}

const num = (v: unknown): number => Number(v) || 0;

const lbl = 'mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]';
const big = 'font-mono text-xl tabular-nums';

export function Caratula({ obra, setObra, motor }: Props) {
  const car = (obra.caratula ?? {}) as CaratulaData;
  const sup = (obra.superficies ?? {}) as Superficies;
  const setCar = (patch: Record<string, unknown>) =>
    setObra({ ...obra, caratula: { ...((obra.caratula as object) ?? {}), ...patch } });
  const setSup = (patch: Record<string, unknown>) =>
    setObra({ ...obra, superficies: { ...((obra.superficies as object) ?? {}), ...patch } });

  // ── Superficies ──
  const cub = num(sup.cub);
  const semi = num(sup.semi);
  const desc = num(sup.desc);
  const m2Total = cub + semi + desc;
  const m2Equiv = cub + 0.5 * semi + 0.25 * desc;

  // ── Economía ──
  const items = obra.items ?? [];
  const coef = calcCoef(obra.coef ?? coefDefault());
  const cu = (it: ItemObra): number =>
    motor.apuTiene(it.cod) ? motor.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;
  const costoDirecto = items.reduce((s, it) => s + cu(it) * (it.cant || 0), 0);
  const presupuesto = costoDirecto * coef;
  const tc = num(car.tipoCambio);
  const usdTotal = tc > 0 ? presupuesto / tc : 0;
  const pxM2Cub = cub > 0 ? presupuesto / cub : 0;
  const pxM2Eq = m2Equiv > 0 ? presupuesto / m2Equiv : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-marca text-3xl tracking-tight">Carátula</h1>

      {/* ── Datos generales ── */}
      <Card className="p-5">
        <SectionTitle>Datos de la obra</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className={lbl}>Nombre</div>
            <EditCell value={obra.nombre ?? ''} onCommit={(v) => setObra({ ...obra, nombre: v })} />
          </div>
          <div>
            <div className={lbl}>Comitente</div>
            <EditCell
              value={String(obra.comitente ?? '')}
              onCommit={(v) => setObra({ ...obra, comitente: v })}
            />
          </div>
          <div>
            <div className={lbl}>Dirección</div>
            <EditCell
              value={String(obra.direccion ?? '')}
              onCommit={(v) => setObra({ ...obra, direccion: v })}
            />
          </div>
        </div>
      </Card>

      {/* ── Superficies ── */}
      <Card className="p-5">
        <SectionTitle>Superficies (m²)</SectionTitle>
        <p className="mb-3 text-xs text-[var(--texto-2)]">
          Ponderación: cubierto + 0,5·semicubierto + 0,25·descubierto.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className={lbl}>Cubierta</div>
            <EditCell value={cub} tipo="number" onCommit={(v) => setSup({ cub: Number(v) || 0 })} />
          </div>
          <div>
            <div className={lbl}>Semicubierta</div>
            <EditCell value={semi} tipo="number" onCommit={(v) => setSup({ semi: Number(v) || 0 })} />
          </div>
          <div>
            <div className={lbl}>Descubierta</div>
            <EditCell value={desc} tipo="number" onCommit={(v) => setSup({ desc: Number(v) || 0 })} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--borde)] pt-4">
          <div>
            <div className="text-xs text-[var(--texto-2)]">Total m²</div>
            <div className={big}>{fmtN(m2Total)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--texto-2)]">m² equivalentes ponderados</div>
            <div className={`${big} text-[var(--color-sud-azul)]`}>{fmtN(m2Equiv)}</div>
          </div>
        </div>
      </Card>

      {/* ── Datos de carátula ── */}
      <Card className="p-5">
        <SectionTitle>Estado y fechas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className={lbl}>Estado</div>
            <EditSelect
              value={String(car.estado ?? '')}
              opciones={['proyecto', 'cotizacion', 'obra']}
              onCommit={(v) => setCar({ estado: v })}
            />
          </div>
          <div>
            <div className={lbl}>Fecha de cotización</div>
            <EditCell
              value={String(car.fechaCot ?? '')}
              placeholder="AAAA-MM-DD"
              onCommit={(v) => setCar({ fechaCot: v })}
            />
          </div>
          <div>
            <div className={lbl}>Tipo de cambio (USD)</div>
            <EditCell
              value={tc}
              tipo="number"
              onCommit={(v) =>
                setCar({ tipoCambio: Number(v) || 0, fechaTC: new Date().toISOString().slice(0, 10) })
              }
            />
            {car.fechaTC ? (
              <div className="mt-1 text-xs text-[var(--texto-2)]">TC al {String(car.fechaTC)}</div>
            ) : null}
          </div>
          <div>
            <div className={lbl}>Fecha TC</div>
            <EditCell
              value={String(car.fechaTC ?? '')}
              placeholder="AAAA-MM-DD"
              onCommit={(v) => setCar({ fechaTC: v })}
            />
          </div>
          <div>
            <div className={lbl}>Inicio de obra</div>
            <EditCell
              value={String(car.fechaInicioObra ?? '')}
              placeholder="AAAA-MM-DD"
              onCommit={(v) => setCar({ fechaInicioObra: v })}
            />
          </div>
          <div>
            <div className={lbl}>Fin de obra</div>
            <EditCell
              value={String(car.fechaFinObra ?? '')}
              placeholder="AAAA-MM-DD"
              onCommit={(v) => setCar({ fechaFinObra: v })}
            />
          </div>
        </div>
      </Card>

      {/* ── Resumen económico ── */}
      <Card className="p-5">
        <SectionTitle>Resumen económico</SectionTitle>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-[var(--texto-2)]">Presupuesto total</div>
            <div className={`${big} text-right md:text-left`}>{money(presupuesto)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--texto-2)]">Total en USD</div>
            <div className={big}>{tc > 0 ? 'USD ' + fmt(usdTotal) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--texto-2)]">$ / m² cubierto</div>
            <div className={big}>{cub > 0 ? money(pxM2Cub) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--texto-2)]">$ / m² equivalente</div>
            <div className={big}>{m2Equiv > 0 ? money(pxM2Eq) : '—'}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--borde)] pt-3 text-xs text-[var(--texto-2)]">
          <span>
            Costo directo: <span className="font-mono tabular-nums">{money(costoDirecto)}</span>
          </span>
          <span>
            Coeficiente de pase:{' '}
            <span className="font-mono tabular-nums">
              {coef.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            </span>
          </span>
          <span>Ítems computados: {items.length}</span>
        </div>
      </Card>

      {/* ── Observaciones ── */}
      <Card className="p-5">
        <SectionTitle>Observaciones de carátula</SectionTitle>
        <EditArea
          value={String(obra.observacionesCaratula ?? '')}
          rows={4}
          placeholder="Notas internas de la carátula…"
          onCommit={(v) => setObra({ ...obra, observacionesCaratula: v })}
        />
      </Card>
    </div>
  );
}
