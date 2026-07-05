/** Camino crítico — CPM con holguras + Gantt SVG (port de CaminoCritico legacy). */
import { useMemo } from 'react';
import { buildPlan } from '../../core';
import type { Catalogo, Motor, Obra, PlanRubro } from '../../core';
import { Badge, Card, SectionTitle, td, th } from '../../ui/base';

/** Gantt SVG: barras inicio→fin por rubro, críticos en alerta, holgura como barra tenue. */
function Gantt({ base, plazo }: { base: PlanRubro[]; plazo: number }) {
  const filas = base.filter((b) => b.inicio != null && b.fin != null && b.duracion > 0);
  if (filas.length === 0 || plazo <= 0) return null;

  const labelW = 190;
  const rowH = 26;
  const axisH = 26;
  const padB = 8;
  const W = 760;
  const chartW = W - labelW - 12;
  const H = axisH + filas.length * rowH + padB;
  const xSem = (s: number) => labelW + ((s - 1) / plazo) * chartW; // borde izquierdo de la semana s
  const anchoSem = chartW / plazo;
  const paso = Math.max(1, Math.ceil(plazo / 18)); // labels legibles si hay muchas semanas

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gantt del camino crítico">
      {/* Grilla vertical por semana + eje de semanas arriba */}
      {Array.from({ length: plazo + 1 }).map((_, i) => (
        <line
          key={'g' + i}
          x1={xSem(i + 1)}
          y1={axisH - 6}
          x2={xSem(i + 1)}
          y2={H - padB}
          stroke="var(--borde)"
          strokeWidth={i % 4 === 0 ? 1.2 : 0.6}
        />
      ))}
      {Array.from({ length: plazo }).map((_, i) =>
        (i + 1) % paso === 0 || i === 0 ? (
          <text
            key={'s' + i}
            x={xSem(i + 1) + anchoSem / 2}
            y={axisH - 10}
            textAnchor="middle"
            fontSize="10"
            fill="var(--texto-2)"
          >
            S{i + 1}
          </text>
        ) : null
      )}

      {filas.map((b, fi) => {
        const y = axisH + fi * rowH;
        const ini = b.inicio as number;
        const fin = b.fin as number;
        const holgura = b.holgura ?? 0;
        const finT = b.finTardio;
        return (
          <g key={b.rp}>
            {/* Fondo de fila */}
            <rect
              x={labelW}
              y={y + 3}
              width={chartW}
              height={rowH - 8}
              fill="var(--color-neutro-100)"
              opacity={0.35}
              rx={3}
            />
            <text
              x={labelW - 8}
              y={y + rowH / 2 + 2.5}
              textAnchor="end"
              fontSize="11"
              fill="var(--texto-2)"
            >
              {(b.rp + '.00 · ' + b.nombre).slice(0, 30)}
            </text>
            {/* Holgura: barra tenue de fin → finTardio */}
            {holgura > 0 && finT != null && finT > fin && (
              <rect
                x={xSem(fin + 1)}
                y={y + 5}
                width={((finT - fin) / plazo) * chartW}
                height={rowH - 12}
                fill="var(--color-sud-azul)"
                opacity={0.25}
                rx={3}
              >
                <title>{`Holgura: ${holgura} sem (hasta semana ${finT})`}</title>
              </rect>
            )}
            {/* Barra del rubro */}
            <rect
              x={xSem(ini)}
              y={y + 4}
              width={(b.duracion / plazo) * chartW}
              height={rowH - 10}
              fill={b.critico ? 'var(--color-alerta)' : 'var(--color-sud-azul)'}
              rx={3}
            >
              <title>
                {`${b.rp}.00 · ${b.nombre} — semana ${ini} a ${fin}` +
                  (b.critico ? ' (crítico)' : ` (holgura ${holgura} sem)`)}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

export function CaminoCritico({
  obra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}) {
  const planData = useMemo(() => buildPlan(obra, motor), [obra, motor]);
  const { base, plazo } = planData;
  const criticos = base.filter((b) => b.critico && b.fin != null).length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Camino crítico</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Holgura de cada rubro: cuánto puede atrasarse sin correr la fecha final. Holgura 0 =
          rubro crítico.
        </p>
      </header>

      {base.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Cargá el Plan de trabajo para analizar el camino crítico.
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Card className="px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]">
                Plazo total de obra
              </div>
              <div className="text-2xl tabular-nums">
                {plazo} <span className="text-sm text-[var(--texto-2)]">semanas</span>
              </div>
            </Card>
            <Card className="px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--texto-2)]">
                Rubros críticos
              </div>
              <div className="text-2xl tabular-nums text-[var(--color-alerta)]">{criticos}</div>
            </Card>
          </div>

          <Card className="overflow-x-auto p-4">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr>
                  <th className={`${th} w-16`}>Rubro</th>
                  <th className={th}>Descripción</th>
                  <th className={`${th} w-24 text-right`}>Duración (sem)</th>
                  <th className={`${th} w-20 text-right`}>Inicio</th>
                  <th className={`${th} w-20 text-right`}>Fin</th>
                  <th className={`${th} w-24 text-right`}>Inicio tardío</th>
                  <th className={`${th} w-24 text-right`}>Fin tardío</th>
                  <th className={`${th} w-20 text-right`}>Holgura</th>
                  <th className={`${th} w-24`}>Crítico</th>
                </tr>
              </thead>
              <tbody>
                {base.map((b) => (
                  <tr
                    key={b.rp}
                    className={
                      b.critico && b.fin != null
                        ? 'bg-[var(--color-alerta)]/5'
                        : 'hover:bg-[var(--color-neutro-100)]/40'
                    }
                  >
                    <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{b.rp}.00</td>
                    <td className={td}>{b.nombre}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.duracion || '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.inicio ?? '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.fin ?? '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.inicioTardio ?? '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.finTardio ?? '—'}</td>
                    <td
                      className={`${td} text-right tabular-nums ${
                        b.holgura === 0 ? 'font-semibold text-[var(--color-alerta)]' : 'text-[var(--texto-2)]'
                      }`}
                    >
                      {b.holgura ?? '—'}
                    </td>
                    <td className={td}>
                      {b.critico && b.fin != null ? <Badge tono="alerta">crítico</Badge> : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {plazo > 0 && (
            <Card className="p-4">
              <SectionTitle>Cadena crítica — diagrama temporal con holguras</SectionTitle>
              <Gantt base={base} plazo={plazo} />
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--texto-2)]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-alerta)]" />
                  Crítico (sin holgura)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-sud-azul)]" />
                  Tarea con holgura
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-sud-azul)] opacity-25" />
                  Holgura disponible (puede correrse)
                </span>
              </div>
            </Card>
          )}

          <p className="text-xs text-[var(--texto-2)]/70">
            CPM con una precedencia por rubro, según el criterio del sistema. El camino crítico
            define el plazo de obra.
          </p>
        </>
      )}
    </div>
  );
}
