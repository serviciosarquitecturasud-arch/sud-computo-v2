/**
 * Resumen — dashboard de la obra (H4). Primera tab del panel.
 * KPIs generales, distribución del presupuesto por rubro, composición
 * del costo directo por tipo de insumo y mini curva de inversión.
 * Solo lectura: no edita la obra.
 */
import { useMemo } from 'react';
import { buildPlan, calcCoef, coefDefault, fmtN, money } from '../../core';
import type { Catalogo, ItemObra, Motor, Obra } from '../../core';
import { Card, SectionTitle } from '../../ui/base';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

interface Superficies {
  cub?: number | string;
  semi?: number | string;
  desc?: number | string;
  [k: string]: unknown;
}

const num = (v: unknown): number => Number(v) || 0;
const trunc = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s);
/** Redondeo a 1 decimal para porcentajes en pantalla */
const pct1 = (p: number): string => fmtN(Math.round(p * 10) / 10) + ' %';

function Kpi({
  label,
  valor,
  detalle,
  acento
}: {
  label: string;
  valor: string;
  detalle?: string;
  acento?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-xl tabular-nums"
        style={acento ? { color: acento } : undefined}
      >
        {valor}
      </div>
      {detalle ? <div className="mt-0.5 text-xs text-[var(--texto-2)]">{detalle}</div> : null}
    </Card>
  );
}

export function Resumen({ obra, motor }: Props) {
  const items = obra.items ?? [];
  const coef = calcCoef(obra.coef ?? coefDefault());
  const cu = (it: ItemObra): number =>
    motor.apuTiene(it.cod) ? motor.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;

  const plan = useMemo(() => buildPlan(obra, motor), [obra, motor]);
  const meses = plan.meses ?? [];

  // ── Totales generales ──
  const costoDirecto = items.reduce((s, it) => s + cu(it) * (it.cant || 0), 0);
  const presupuesto = costoDirecto * coef;
  const totalHH = plan.totalH ?? 0;

  // ── Superficies (ponderación legacy: cub + 0,5·semi + 0,25·desc) ──
  const sup = (obra.superficies ?? {}) as Superficies;
  const m2Equiv = num(sup.cub) + 0.5 * num(sup.semi) + 0.25 * num(sup.desc);

  // ── Distribución por rubro principal (mismo agrupamiento que Presupuesto) ──
  const map: Record<string, { rp: string; nombre: string; costo: number }> = {};
  items.forEach((it) => {
    const rp = String(it.cod || '').split('.')[0];
    if (!map[rp]) {
      const r = motor.rubMap[rp + '.00'] ?? motor.rubMap[rp];
      map[rp] = { rp, nombre: r?.desc ? r.desc : 'Rubro ' + rp, costo: 0 };
    }
    map[rp].costo += cu(it) * (it.cant || 0);
  });
  const rubros = Object.values(map).sort((a, b) => b.costo - a.costo);
  const maxCosto = rubros.length > 0 ? rubros[0].costo : 0;

  // ── Composición del costo directo por tipo de insumo ──
  let compM = 0,
    compMO = 0,
    compE = 0,
    compG = 0;
  items.forEach((it) => {
    const q = it.cant || 0;
    if (motor.apuTiene(it.cod)) {
      (motor.bibMap[it.cod] ?? []).forEach((b) => {
        const c = b.cant * q * motor.costoInsumoEnObra(b.tipo, b.insumo, obra);
        if (b.tipo === 'M') compM += c;
        else if (b.tipo === 'MO') compMO += c;
        else if (b.tipo === 'E') compE += c;
        else compG += c;
      });
    } else {
      compG += (it.precioManual || 0) * q;
    }
  });
  const compTotal = compM + compMO + compE + compG;
  const segmentos = [
    { k: 'Materiales', v: compM, color: 'var(--color-sud-tan)' },
    { k: 'Mano de obra', v: compMO, color: 'var(--color-sud-oliva)' },
    { k: 'Equipos', v: compE, color: 'var(--color-sud-azul)' },
    { k: 'Globales / manuales', v: compG, color: 'var(--color-neutro-400)' }
  ];

  // ── Mini curva de inversión (sparkline de pctF acumulado por mes) ──
  const spark = useMemo(() => {
    if (meses.length === 0 || plan.plazo <= 0) return null;
    const W = 720,
      H = 90,
      mL = 6,
      mR = 6,
      mT = 10,
      mB = 10;
    const n = meses.length;
    const x = (i: number) => mL + (n <= 1 ? (W - mL - mR) / 2 : (i / (n - 1)) * (W - mL - mR));
    const y = (p: number) => mT + (H - mT - mB) * (1 - Math.min(100, Math.max(0, p)) / 100);
    const line = meses
      .map((mm, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(mm.pctF).toFixed(1)}`)
      .join(' ');
    const area = `${line} L${x(n - 1).toFixed(1)},${H - mB} L${x(0).toFixed(1)},${H - mB} Z`;
    return { W, H, line, area, cx: x(n - 1), cy: y(meses[n - 1].pctF) };
  }, [meses, plan.plazo]);
  const acumFinal = meses.length > 0 ? meses[meses.length - 1].invAcum : 0;

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <header>
          <h1 className="font-marca text-3xl tracking-tight">Resumen</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">Panorama general del proyecto.</p>
        </header>
        <Card className="p-12 text-center">
          <div className="font-marca text-xl">Todavía no hay nada que resumir</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--texto-2)]">
            Esta obra no tiene ítems cargados. Empezá por la pestaña <b>Cómputo</b>: a medida que
            cargues rubros y cantidades, acá vas a ver el presupuesto, la incidencia por rubro, la
            composición del costo y la curva de inversión.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Resumen</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          {obra.nombre ?? ''}
          {obra.comitente ? ` · ${String(obra.comitente)}` : ''} — panorama general del proyecto.
        </p>
      </header>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Presupuesto total"
          valor={money(presupuesto)}
          detalle="precio final (×coef)"
          acento="var(--color-sud-naranja)"
        />
        <Kpi label="Costo directo" valor={money(costoDirecto)} detalle="sin coeficiente" />
        <Kpi label="Coeficiente" valor={fmtN(Math.round(coef * 1000) / 1000)} detalle="de pase" />
        <Kpi
          label="$ / m²"
          valor={m2Equiv > 0 ? money(presupuesto / m2Equiv) : '—'}
          detalle={m2Equiv > 0 ? fmtN(Math.round(m2Equiv * 100) / 100) + ' m² equiv.' : 'sin superficies'}
        />
        <Kpi
          label="Plazo"
          valor={plan.plazo > 0 ? fmtN(plan.plazo) + ' sem' : '—'}
          detalle={plan.plazo > 0 ? '≈ ' + fmtN(meses.length) + (meses.length === 1 ? ' mes' : ' meses') : 'sin plan de trabajo'}
        />
        <Kpi
          label="Total HH"
          valor={fmtN(Math.round(totalHH))}
          detalle="oficiales + ayudantes"
        />
        <Kpi
          label="Ítems"
          valor={fmtN(items.length)}
          detalle={fmtN(rubros.length) + (rubros.length === 1 ? ' rubro' : ' rubros')}
        />
      </div>

      {/* ── Distribución por rubro ── */}
      <Card className="p-5">
        <SectionTitle>Distribución por rubro</SectionTitle>
        <svg
          viewBox={`0 0 720 ${rubros.length * 34}`}
          width="100%"
          role="img"
          aria-label="Distribución del presupuesto por rubro principal"
        >
          {rubros.map((r, i) => {
            const yc = i * 34 + 17;
            const w = maxCosto > 0 ? Math.max(2, (r.costo / maxCosto) * 360) : 2;
            const inc = costoDirecto > 0 ? (r.costo / costoDirecto) * 100 : 0;
            return (
              <g key={r.rp}>
                <text x={0} y={yc + 4} fontSize="11" fill="var(--texto)">
                  {trunc(`${r.rp} · ${r.nombre}`, 30)}
                </text>
                <rect
                  x={190}
                  y={yc - 7}
                  width={w}
                  height={14}
                  rx={3}
                  fill={i === 0 ? 'var(--color-sud-naranja)' : 'var(--color-sud-azul)'}
                />
                <text
                  x={600}
                  y={yc + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--texto-2)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {pct1(inc)}
                </text>
                <text
                  x={720}
                  y={yc + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontFamily="monospace"
                  fill="var(--texto)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {money(r.costo * coef)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-2 text-right text-xs text-[var(--texto-2)]">
          Montos a precio final (×{fmtN(Math.round(coef * 1000) / 1000)}) · incidencia sobre el
          costo directo.
        </div>
      </Card>

      {/* ── Composición del costo ── */}
      <Card className="p-5">
        <SectionTitle>Composición del costo directo</SectionTitle>
        {compTotal > 0 ? (
          <>
            <div
              className="flex h-5 w-full overflow-hidden rounded-md"
              role="img"
              aria-label="Composición del costo directo por tipo de insumo"
            >
              {segmentos
                .filter((s) => s.v > 0)
                .map((s) => (
                  <div
                    key={s.k}
                    title={`${s.k}: ${money(s.v)}`}
                    style={{ width: `${(s.v / compTotal) * 100}%`, background: s.color }}
                  />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {segmentos.map((s) => (
                <div key={s.k} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: s.color }}
                  />
                  <span className="text-[var(--texto-2)]">{s.k}</span>
                  <span className="font-mono tabular-nums">{money(s.v)}</span>
                  <span className="text-xs text-[var(--texto-2)]">
                    {compTotal > 0 ? pct1((s.v / compTotal) * 100) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--texto-2)]">
            Los ítems cargados no tienen costo todavía (APUs sin precios o cantidades en cero).
          </p>
        )}
      </Card>

      {/* ── Mini curva de inversión ── */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-4">
          <SectionTitle>Curva de inversión</SectionTitle>
          {spark ? (
            <div className="text-xs text-[var(--texto-2)]">
              {fmtN(plan.plazo)} semanas · acumulado{' '}
              <span className="font-mono tabular-nums text-[var(--texto)]">{money(acumFinal)}</span>
            </div>
          ) : null}
        </div>
        {spark ? (
          <>
            <svg
              viewBox={`0 0 ${spark.W} ${spark.H}`}
              width="100%"
              role="img"
              aria-label="Avance financiero acumulado por mes"
            >
              <path d={spark.area} fill="var(--color-sud-naranja)" fillOpacity={0.14} />
              <path
                d={spark.line}
                fill="none"
                stroke="var(--color-sud-naranja)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={spark.cx} cy={spark.cy} r={3.5} fill="var(--color-sud-naranja)" />
            </svg>
            <div className="mt-2 text-right text-xs text-[var(--texto-2)]">
              % financiero acumulado por mes — el detalle completo está en la pestaña{' '}
              <b>Curva</b> →
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--texto-2)]">
            Definí duraciones e inicios en el <b>Plan de trabajo</b> para ver la curva de
            inversión.
          </p>
        )}
      </Card>
    </div>
  );
}
