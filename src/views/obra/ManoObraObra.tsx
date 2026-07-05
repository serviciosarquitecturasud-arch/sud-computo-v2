/**
 * Mano de obra de la obra — horas y costo por insumo MO (oficiales, ayudantes,
 * subcontratos) y desglose por rubro principal. Horas = cant_fila × cant_ítem.
 */
import { cmpCodigo, fmtN, money } from '../../core';
import type { Catalogo, Motor, Obra } from '../../core';
import { Card, SectionTitle, td, th } from '../../ui/base';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

interface FilaMO {
  cod: string;
  desc: string;
  unidad: string;
  horas: number;
  valor: number;
  costo: number;
}

export function ManoObraObra({ obra, motor }: Props) {
  const items = obra.items ?? [];

  // ── Acumular horas por insumo MO y por rubro principal ──
  const porInsumo: Record<string, number> = {};
  const porRubro: Record<string, Record<string, number>> = {};
  items.forEach((it) => {
    const rp = String(it.cod || '').split('.')[0];
    (motor.bibMap[it.cod] ?? []).forEach((b) => {
      if (b.tipo !== 'MO') return;
      const horas = (b.cant || 0) * (it.cant || 0);
      if (horas <= 0) return;
      porInsumo[b.insumo] = (porInsumo[b.insumo] ?? 0) + horas;
      if (!porRubro[rp]) porRubro[rp] = {};
      porRubro[rp][b.insumo] = (porRubro[rp][b.insumo] ?? 0) + horas;
    });
  });

  const filaDe = (cod: string, horas: number): FilaMO => {
    const mo = motor.moMap[cod];
    const valor = motor.costoInsumoEnObra('MO', cod, obra);
    return {
      cod,
      desc: mo?.desc ?? cod,
      unidad: mo?.unidad ?? 'hs',
      horas,
      valor,
      costo: horas * valor
    };
  };

  const insumos: FilaMO[] = Object.keys(porInsumo)
    .sort(cmpCodigo)
    .map((cod) => filaDe(cod, porInsumo[cod]));
  const totalMO = insumos.reduce((s, f) => s + f.costo, 0);
  const totalHs = insumos.filter((f) => f.unidad === 'hs').reduce((s, f) => s + f.horas, 0);

  const rubros = Object.keys(porRubro)
    .sort(cmpCodigo)
    .map((rp) => {
      const r = motor.rubMap[rp + '.00'] ?? motor.rubMap[rp];
      const filas = Object.keys(porRubro[rp])
        .sort(cmpCodigo)
        .map((cod) => filaDe(cod, porRubro[rp][cod]));
      return {
        rp,
        nombre: r?.desc ? r.desc : 'Rubro ' + rp,
        filas,
        costo: filas.reduce((s, f) => s + f.costo, 0)
      };
    });

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Mano de obra</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Horas de cada insumo de mano de obra según los APU de los ítems computados. Los ítems sin
          APU (precio manual) no aportan horas.
        </p>
      </header>

      {insumos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Sin mano de obra computada todavía.
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-4">
            <SectionTitle>Total por insumo</SectionTitle>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${th} w-16`}>Código</th>
                  <th className={th}>Insumo</th>
                  <th className={`${th} w-14`}>Un.</th>
                  <th className={`${th} w-24 text-right`}>Cantidad</th>
                  <th className={`${th} w-28 text-right`}>Valor unit.</th>
                  <th className={`${th} w-32 text-right`}>Costo</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((f) => (
                  <tr key={f.cod}>
                    <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{f.cod}</td>
                    <td className={td}>{f.desc}</td>
                    <td className={`${td} text-[var(--texto-2)]`}>{f.unidad}</td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(f.horas)}</td>
                    <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                      {money(f.valor)}
                    </td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{money(f.costo)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className={`${td} border-t-2 border-[var(--borde)]`} colSpan={3}>
                    TOTAL MANO DE OBRA
                  </td>
                  <td
                    className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}
                    title="Solo insumos jornalizados (hs)"
                  >
                    {fmtN(totalHs)} hs
                  </td>
                  <td className={`${td} border-t-2 border-[var(--borde)]`}></td>
                  <td
                    className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}
                  >
                    {money(totalMO)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card className="overflow-x-auto p-4">
            <SectionTitle>Desglose por rubro principal</SectionTitle>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${th} w-16`}>Código</th>
                  <th className={th}>Rubro / insumo</th>
                  <th className={`${th} w-14`}>Un.</th>
                  <th className={`${th} w-24 text-right`}>Cantidad</th>
                  <th className={`${th} w-32 text-right`}>Costo</th>
                </tr>
              </thead>
              <tbody>
                {rubros.map((g) => (
                  <FilasRubroMO key={g.rp} grupo={g} totalMO={totalMO} />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function FilasRubroMO({
  grupo,
  totalMO
}: {
  grupo: { rp: string; nombre: string; filas: FilaMO[]; costo: number };
  totalMO: number;
}) {
  return (
    <>
      <tr className="bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]">
        <td className={`${td} font-mono text-xs`}>{grupo.rp}</td>
        <td className={`${td} text-xs font-semibold uppercase tracking-wide`} colSpan={2}>
          {grupo.nombre}
        </td>
        <td className={`${td} text-right font-mono text-xs tabular-nums text-[var(--texto-2)]`}>
          {totalMO > 0 ? fmtN((grupo.costo / totalMO) * 100) + ' %' : ''}
        </td>
        <td className={`${td} text-right font-mono font-semibold tabular-nums`}>{money(grupo.costo)}</td>
      </tr>
      {grupo.filas.map((f) => (
        <tr key={grupo.rp + '-' + f.cod}>
          <td className={`${td} pl-4 font-mono text-xs text-[var(--texto-2)]`}>{f.cod}</td>
          <td className={td}>{f.desc}</td>
          <td className={`${td} text-[var(--texto-2)]`}>{f.unidad}</td>
          <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(f.horas)}</td>
          <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
            {money(f.costo)}
          </td>
        </tr>
      ))}
    </>
  );
}
