/** Curva de inversión — % financiero y % horas acumulados por mes (port de CurvaInversion legacy). */
import { useMemo } from 'react';
import { buildPlan, fmtN, money } from '../../core';
import type { Catalogo, Motor, Obra, PlanMes } from '../../core';
import { Card, SectionTitle, td, th } from '../../ui/base';

/** Gráfico de líneas SVG propio (sin librerías): dos series 0–100 % por mes. */
function CurvaChart({ meses }: { meses: PlanMes[] }) {
  const W = 720;
  const H = 320;
  const m = { top: 20, right: 20, bottom: 44, left: 52 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const n = meses.length;
  const x = (i: number) => m.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (pct: number) => m.top + ih - (Math.min(100, Math.max(0, pct)) / 100) * ih;
  const path = (get: (mm: PlanMes) => number) =>
    meses.map((mm, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(mm)).toFixed(1)}`).join(' ');
  const gridY = [0, 25, 50, 75, 100];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Curva de inversión: porcentaje acumulado por mes"
    >
      {/* Grilla horizontal + labels % */}
      {gridY.map((g) => (
        <g key={g}>
          <line
            x1={m.left}
            y1={y(g)}
            x2={W - m.right}
            y2={y(g)}
            stroke="var(--borde)"
            strokeWidth={g === 0 ? 1.5 : 1}
            strokeDasharray={g === 0 ? undefined : '3 4'}
          />
          <text
            x={m.left - 8}
            y={y(g) + 3.5}
            textAnchor="end"
            fontSize="10"
            fill="var(--texto-2)"
          >
            {g}%
          </text>
        </g>
      ))}
      {/* Eje X: un tick por mes */}
      {meses.map((mm, i) => (
        <g key={mm.mes}>
          <line
            x1={x(i)}
            y1={m.top + ih}
            x2={x(i)}
            y2={m.top + ih + 4}
            stroke="var(--texto-2)"
            strokeWidth={1}
          />
          <text
            x={x(i)}
            y={m.top + ih + 16}
            textAnchor="middle"
            fontSize="10"
            fill="var(--texto-2)"
          >
            M{mm.mes}
          </text>
        </g>
      ))}
      <text
        x={m.left + iw / 2}
        y={H - 6}
        textAnchor="middle"
        fontSize="10"
        fill="var(--texto-2)"
      >
        Mes
      </text>

      {/* Series */}
      <path
        d={path((mm) => mm.pctF)}
        fill="none"
        stroke="var(--color-sud-naranja)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={path((mm) => mm.pctH)}
        fill="none"
        stroke="var(--color-sud-azul)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {meses.map((mm, i) => (
        <g key={'p' + mm.mes}>
          <circle cx={x(i)} cy={y(mm.pctF)} r={3} fill="var(--color-sud-naranja)">
            <title>{`Mes ${mm.mes} — Financiero ${mm.pctF.toFixed(1)}%`}</title>
          </circle>
          <circle cx={x(i)} cy={y(mm.pctH)} r={3} fill="var(--color-sud-azul)">
            <title>{`Mes ${mm.mes} — Horas ${mm.pctH.toFixed(1)}%`}</title>
          </circle>
        </g>
      ))}

      {/* Leyenda */}
      <g fontSize="11" fill="var(--texto-2)">
        <rect x={m.left + 4} y={m.top} width={10} height={3} fill="var(--color-sud-naranja)" />
        <text x={m.left + 19} y={m.top + 4}>
          % financiero acum.
        </text>
        <rect x={m.left + 140} y={m.top} width={10} height={3} fill="var(--color-sud-azul)" />
        <text x={m.left + 155} y={m.top + 4}>
          % horas acum.
        </text>
      </g>
    </svg>
  );
}

export function Curva({
  obra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}) {
  const planData = useMemo(() => buildPlan(obra, motor), [obra, motor]);
  const meses = planData.meses ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Curva de inversión</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Curva de avance físico-financiero previsto, derivada del Plan de trabajo.
        </p>
      </header>

      {planData.base.length === 0 || planData.plazo === 0 || meses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Cargá duraciones e inicios en el Plan de trabajo para ver la curva.
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <SectionTitle>% acumulado por mes</SectionTitle>
            <CurvaChart meses={meses} />
          </Card>

          <Card className="overflow-x-auto p-4">
            <SectionTitle>Detalle mensual</SectionTitle>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className={`${th} w-16`}>Mes</th>
                  <th className={`${th} text-right`}>Inversión del mes</th>
                  <th className={`${th} text-right`}>Acumulada</th>
                  <th className={`${th} text-right`}>HH del mes</th>
                  <th className={`${th} text-right`}>HH acum.</th>
                  <th className={`${th} w-20 text-right`}>% F</th>
                  <th className={`${th} w-20 text-right`}>% H</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((mm) => (
                  <tr key={mm.mes} className="hover:bg-[var(--color-neutro-100)]/40">
                    <td className={td}>Mes {mm.mes}</td>
                    <td className={`${td} text-right tabular-nums`}>{money(mm.invMes)}</td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {money(mm.invAcum)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{fmtN(mm.hhMes)}</td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {fmtN(mm.hhAcum)}
                    </td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {mm.pctF.toFixed(1)}%
                    </td>
                    <td className={`${td} text-right tabular-nums text-[var(--texto-2)]`}>
                      {mm.pctH.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
