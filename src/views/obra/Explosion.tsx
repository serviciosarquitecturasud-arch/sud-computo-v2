/**
 * Explosión de insumos — materiales totales de la obra con desperdicio,
 * costo y conversión a presentación comercial (fac1/pres1, con override por obra).
 */
import { fmtN, materialesTotalObra, money } from '../../core';
import type { Catalogo, MaterialConfigObra, Motor, Obra } from '../../core';
import { Card, td, th } from '../../ui/base';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

export function Explosion({ obra, motor }: Props) {
  const filas = materialesTotalObra(obra, motor).sort((a, b) => b.costoTotal - a.costoTotal);
  const total = filas.reduce((s, f) => s + f.costoTotal, 0);
  const cfg: Record<string, MaterialConfigObra> = obra.materialesConfig ?? {};

  const compraDe = (matCod: string, cantConDesp: number): string => {
    const ov = cfg[matCod] ?? {};
    const mat = motor.matMap[matCod];
    const fac1 =
      ov.fac1 !== undefined && ov.fac1 !== '' ? Number(ov.fac1) || 0 : Number(mat?.fac1) || 0;
    if (!(fac1 > 0)) return '—';
    const pres1 = (ov.pres1 !== undefined && ov.pres1 !== '' ? String(ov.pres1) : mat?.pres1) || 'un.';
    return `${fmtN(Math.ceil(cantConDesp / fac1))} ${pres1}`;
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Explosión de insumos</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Materiales totales de la obra: cantidad técnica, desperdicio y conversión a presentación
          comercial. Ordenado por costo.
        </p>
      </header>

      {filas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Sin materiales: cargá ítems con APU en el cómputo para ver la explosión.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={`${th} w-20`}>Código</th>
                <th className={th}>Material</th>
                <th className={`${th} w-14`}>Un.</th>
                <th className={`${th} w-24 text-right`}>Cantidad</th>
                <th className={`${th} w-20 text-right`}>Desp. %</th>
                <th className={`${th} w-28 text-right`}>Cant. c/desp.</th>
                <th className={`${th} w-28 text-right`}>Compra</th>
                <th className={`${th} w-28 text-right`}>Precio unit.</th>
                <th className={`${th} w-32 text-right`}>Costo total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.matCod}>
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{f.matCod}</td>
                  <td className={td}>{f.matDesc}</td>
                  <td className={`${td} text-[var(--texto-2)]`}>{f.unidad}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{fmtN(f.cantidad)}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                    {fmtN(f.desperdicioPct)}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>
                    {fmtN(f.cantidadConDesperdicio)}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>
                    {compraDe(f.matCod, f.cantidadConDesperdicio)}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                    {money(f.precioUnit)}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{money(f.costoTotal)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={`${td} border-t-2 border-[var(--borde)]`} colSpan={8}>
                  TOTAL MATERIALES
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                  {money(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
