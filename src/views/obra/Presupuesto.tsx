/**
 * Presupuesto — resumen formal por rubro principal, con precio final y observaciones.
 * Pensado para leerse limpio: es la base de la salida a cliente (H6).
 */
import { calcCoef, cmpCodigo, coefDefault, fmtN, money } from '../../core';
import type { Catalogo, ItemObra, Motor, Obra } from '../../core';
import { Card, SectionTitle, td, th } from '../../ui/base';
import { EditArea } from '../../ui/edit';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

export function Presupuesto({ obra, setObra, motor }: Props) {
  const items = obra.items ?? [];
  const coef = calcCoef(obra.coef ?? coefDefault());
  const cu = (it: ItemObra): number =>
    motor.apuTiene(it.cod) ? motor.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;

  // ── Totales por rubro principal ──
  const map: Record<string, { rp: string; nombre: string; costo: number }> = {};
  items.forEach((it) => {
    const rp = String(it.cod || '').split('.')[0];
    if (!map[rp]) {
      const r = motor.rubMap[rp + '.00'] ?? motor.rubMap[rp];
      map[rp] = { rp, nombre: r?.desc ? r.desc : 'Rubro ' + rp, costo: 0 };
    }
    map[rp].costo += cu(it) * (it.cant || 0);
  });
  const rubros = Object.values(map).sort((a, b) => cmpCodigo(a.rp, b.rp));
  const costoDirecto = rubros.reduce((s, r) => s + r.costo, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Presupuesto</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          {obra.nombre ?? ''}
          {obra.comitente ? ` · ${String(obra.comitente)}` : ''}
          {obra.direccion ? ` · ${String(obra.direccion)}` : ''}
        </p>
      </header>

      {rubros.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          Cargá ítems en el cómputo para ver el presupuesto.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={`${th} w-16`}>Rubro</th>
                <th className={th}>Descripción</th>
                <th className={`${th} w-32 text-right`}>Costo directo</th>
                <th className={`${th} w-20 text-right`}>Inc. %</th>
                <th className={`${th} w-36 text-right`}>Precio final</th>
              </tr>
            </thead>
            <tbody>
              {rubros.map((r) => (
                <tr key={r.rp}>
                  <td className={`${td} font-mono text-xs text-[var(--texto-2)]`}>{r.rp}</td>
                  <td className={td}>{r.nombre}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                    {money(r.costo)}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums text-[var(--texto-2)]`}>
                    {costoDirecto > 0 ? fmtN((r.costo / costoDirecto) * 100) + ' %' : '—'}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{money(r.costo * coef)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={`${td} border-t-2 border-[var(--borde)]`} colSpan={2}>
                  PRECIO TOTAL DE OBRA
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                  {money(costoDirecto)}
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                  100 %
                </td>
                <td className={`${td} border-t-2 border-[var(--borde)] text-right font-mono tabular-nums`}>
                  {money(costoDirecto * coef)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-5">
        <SectionTitle>Observaciones</SectionTitle>
        <EditArea
          value={String(obra.observacionesPresupuesto ?? '')}
          rows={4}
          placeholder="Aclaraciones del presupuesto (ej.: no incluye muebles, plazo sujeto a clima, etc.)"
          onCommit={(v) => setObra({ ...obra, observacionesPresupuesto: v })}
        />
      </Card>
    </div>
  );
}
