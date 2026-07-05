/**
 * Coeficiente de pase — editor de porcentajes y desglose de la fórmula.
 * (1 + (ggd+ggi+imp+ben)/100) × (1 + iib/100). El IVA se ignora desde R11 H7.
 */
import { calcCoef, coefDefault, fmtN, money } from '../../core';
import type { Catalogo, Coef, ItemObra, Motor, Obra } from '../../core';
import { Card, SectionTitle, td } from '../../ui/base';
import { EditCell } from '../../ui/edit';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

type CampoCoef = 'ggd' | 'ggi' | 'imp' | 'ben' | 'iib';

const FILAS: [CampoCoef, string][] = [
  ['ggd', 'Gastos Generales Directos'],
  ['ggi', 'Gastos Generales Indirectos'],
  ['imp', 'Imprevistos / Margen de seguridad'],
  ['ben', 'Beneficio (Utilidad)']
];

export function Coeficiente({ obra, setObra, motor }: Props) {
  const oc: Coef = obra.coef ?? coefDefault();
  const coef = calcCoef(oc);
  const setCoef = (k: CampoCoef, v: string) =>
    setObra({ ...obra, coef: { ...(obra.coef ?? coefDefault()), [k]: Number(v) || 0 } });

  const items = obra.items ?? [];
  const cu = (it: ItemObra): number =>
    motor.apuTiene(it.cod) ? motor.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;
  const costoDirecto = items.reduce((s, it) => s + cu(it) * (it.cant || 0), 0);

  const gg = (oc.ggd || 0) + (oc.ggi || 0) + (oc.imp || 0) + (oc.ben || 0);
  const coefFmt = coef.toLocaleString('es-AR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="font-marca text-3xl tracking-tight">Coeficiente de pase</h1>
      <p className="text-sm text-[var(--texto-2)]">
        Cargá los porcentajes como número entero (para 15 % escribí 15). El coeficiente se calcula solo.
      </p>

      <Card className="overflow-hidden p-4">
        <table className="w-full text-sm">
          <tbody>
            <tr className="bg-[var(--color-neutro-100)] dark:bg-[var(--color-neutro-800)]">
              <td className={td} colSpan={2}>
                Costo directo de la obra
              </td>
              <td className={`${td} text-right font-mono tabular-nums`}>{money(costoDirecto)}</td>
            </tr>
            {FILAS.map(([k, nombre]) => (
              <tr key={k}>
                <td className={td}>{nombre}</td>
                <td className={`${td} w-32`}>
                  <span className="inline-flex items-center gap-1">
                    <EditCell value={oc[k] || 0} tipo="number" onCommit={(v) => setCoef(k, v)} />
                    <span className="text-xs text-[var(--texto-2)]">%</span>
                  </span>
                </td>
                <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                  {money((costoDirecto * (oc[k] || 0)) / 100)}
                </td>
              </tr>
            ))}
            <tr>
              <td className={`${td} text-[var(--texto-2)]`}>IVA</td>
              <td className={`${td} w-32`}>
                <span className="inline-flex items-center gap-1">
                  <input
                    className="w-full rounded border border-[var(--borde)] bg-[var(--color-neutro-100)] px-1.5 py-0.5 text-right text-sm tabular-nums opacity-60 dark:bg-[var(--color-neutro-800)]"
                    value={oc.iva || 0}
                    disabled
                  />
                  <span className="text-xs text-[var(--texto-2)]">%</span>
                </span>
              </td>
              <td className={`${td} text-right text-xs italic text-[var(--texto-2)]`}>
                el IVA vive en el precio de los materiales desde R11
              </td>
            </tr>
            <tr>
              <td className={td}>Ingresos Brutos</td>
              <td className={`${td} w-32`}>
                <span className="inline-flex items-center gap-1">
                  <EditCell value={oc.iib || 0} tipo="number" onCommit={(v) => setCoef('iib', v)} />
                  <span className="text-xs text-[var(--texto-2)]">%</span>
                </span>
              </td>
              <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                {money(((costoDirecto * (1 + gg / 100)) * (oc.iib || 0)) / 100)}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <SectionTitle>Coeficiente resultante</SectionTitle>
        <div className="font-mono text-5xl tabular-nums tracking-tight">{coefFmt}</div>
        <div className="mt-3 space-y-1 border-t border-[var(--borde)] pt-3 font-mono text-sm tabular-nums text-[var(--texto-2)]">
          <div>coef = (1 + (ggd + ggi + imp + ben) / 100) × (1 + iibb / 100)</div>
          <div>
            coef = (1 + ({fmtN(oc.ggd || 0)} + {fmtN(oc.ggi || 0)} + {fmtN(oc.imp || 0)} +{' '}
            {fmtN(oc.ben || 0)}) / 100) × (1 + {fmtN(oc.iib || 0)} / 100)
          </div>
          <div>
            coef = {fmtN(1 + gg / 100)} × {fmtN(1 + (oc.iib || 0) / 100)} ={' '}
            <span className="text-[var(--texto)]">{coefFmt}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-between border-t border-[var(--borde)] pt-3 text-sm">
          <span className="text-[var(--texto-2)]">Costo directo × coeficiente</span>
          <span className="font-mono font-semibold tabular-nums">{money(costoDirecto * coef)}</span>
        </div>
      </Card>
    </div>
  );
}
