/** Inicio — obras del estudio con su aura + verificación del núcleo (H0/H1). */
import { Aura, auraCodigo, auraColor } from '../ui/Aura';
import { Badge, Card, SectionTitle } from '../ui/base';
import {
  buildMotor,
  buildPlan,
  calcCoef,
  coefDefault,
  money
} from '../core';
import type { Catalogo, Obra } from '../core';

export function Inicio({
  cat,
  obras,
  origen
}: {
  cat: Catalogo;
  obras: Obra[];
  origen: 'localStorage' | 'seed';
}) {
  const motor = buildMotor(cat);

  return (
    <div className="max-w-4xl space-y-10">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Obras</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            {origen === 'localStorage'
              ? 'Datos leídos de este navegador (compartidos con la app actual — solo lectura por ahora).'
              : 'Sin datos en este navegador: mostrando catálogo SEED.'}
          </p>
        </div>
      </header>

      {obras.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          No hay obras cargadas en este navegador.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {obras.map((obra) => {
            const nombre = obra.nombre || obra.id;
            const coef = calcCoef((obra.coef as never) || coefDefault());
            let cd = 0;
            for (const it of obra.items || []) {
              const cu = motor.apuTiene(it.cod)
                ? motor.costoAPUEnObra(it.cod, obra)
                : it.precioManual || 0;
              cd += cu * (it.cant || 0);
            }
            const plan = buildPlan(obra, motor);
            const planificado = plan.plazo > 0;
            return (
              <Card key={obra.id} className="flex items-center gap-4 p-5">
                <Aura color={auraColor(nombre)} codigo={auraCodigo(nombre)} size={110} className="-m-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-marca text-lg">{nombre}</div>
                  <div className="mt-0.5 text-xs text-[var(--texto-2)]">
                    {(obra.items || []).length} ítems · coef {coef.toFixed(3).replace('.', ',')}
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--texto-2)]">Costo directo</span>
                      <span className="tabular-nums">{money(cd)}</span>
                    </div>
                    <div className="flex justify-between gap-4 font-medium">
                      <span className="text-[var(--texto-2)]">Presupuesto</span>
                      <span className="tabular-nums">{money(cd * coef)}</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    {planificado ? (
                      <Badge tono="ok">plan: {plan.plazo} semanas</Badge>
                    ) : (
                      <Badge>sin planificar</Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section>
        <SectionTitle>Estado del núcleo</SectionTitle>
        <Card className="p-5">
          <ul className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:grid-cols-3">
            <li className="flex justify-between"><span className="text-[var(--texto-2)]">Materiales</span><span className="tabular-nums font-medium">{cat.materiales.length}</span></li>
            <li className="flex justify-between"><span className="text-[var(--texto-2)]">Mano de obra</span><span className="tabular-nums font-medium">{cat.manoObra.length}</span></li>
            <li className="flex justify-between"><span className="text-[var(--texto-2)]">Equipos</span><span className="tabular-nums font-medium">{cat.herramientas.length}</span></li>
            <li className="flex justify-between"><span className="text-[var(--texto-2)]">Cómputos Unitarios</span><span className="tabular-nums font-medium">{Object.keys(motor.bibMap).length}</span></li>
            <li className="flex justify-between"><span className="text-[var(--texto-2)]">Filas biblioteca</span><span className="tabular-nums font-medium">{cat.biblioteca.length}</span></li>
            <li className="flex justify-between"><span className="text-[var(--texto-2)]">APUs blindados</span><span className="tabular-nums font-medium">{(cat.apusEditados || []).length}</span></li>
          </ul>
          <p className="mt-3 text-xs text-[var(--texto-2)]">
            Los totales de arriba se calculan con el motor nuevo — deben coincidir al centavo con la
            app de producción.
          </p>
        </Card>
      </section>
    </div>
  );
}
