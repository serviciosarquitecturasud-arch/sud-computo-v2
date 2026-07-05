/** Lista de obras del estudio: crear, abrir, eliminar. */
import { useState } from 'react';
import type { Catalogo, Obra } from '../core';
import type { Motor } from '../core';
import { buildPlan, calcCoef, coefDefault, money } from '../core';
import { Aura, auraCodigo, auraColor } from '../ui/Aura';
import { Badge, Btn, Card } from '../ui/base';

export function Obras({
  obras,
  motor,
  onAbrir,
  onCrear,
  onEliminar,
  origen
}: {
  obras: Obra[];
  cat: Catalogo;
  motor: Motor;
  onAbrir: (id: string) => void;
  onCrear: (nombre: string) => void;
  onEliminar: (id: string) => void;
  origen: 'localStorage' | 'seed';
}) {
  const [nueva, setNueva] = useState('');
  return (
    <div className="max-w-4xl space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-marca text-3xl tracking-tight">Obras</h1>
          <p className="mt-1 text-sm text-[var(--texto-2)]">
            {origen === 'localStorage'
              ? 'Datos de este navegador — compartidos con la app de producción.'
              : 'Sin datos previos: catálogo SEED cargado.'}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="w-56 rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-1.5 text-sm"
            placeholder="Nombre de la nueva obra…"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nueva.trim()) {
                onCrear(nueva.trim());
                setNueva('');
              }
            }}
          />
          <Btn
            variante="primario"
            disabled={!nueva.trim()}
            onClick={() => {
              onCrear(nueva.trim());
              setNueva('');
            }}
          >
            + Crear
          </Btn>
        </div>
      </header>

      {obras.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
          No hay obras. Creá la primera con el campo de arriba.
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
            return (
              <Card key={obra.id} className="group flex items-center gap-4 p-5">
                <button className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={() => onAbrir(obra.id)}>
                  <Aura color={auraColor(nombre)} codigo={auraCodigo(nombre)} size={110} className="-m-2 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-marca text-lg">{nombre}</span>
                    <span className="mt-0.5 block text-xs text-[var(--texto-2)]">
                      {(obra.items || []).length} ítems · coef {coef.toFixed(3).replace('.', ',')}
                    </span>
                    <span className="mt-2 flex justify-between gap-4 text-sm">
                      <span className="text-[var(--texto-2)]">Presupuesto</span>
                      <span className="font-medium tabular-nums">{money(cd * coef)}</span>
                    </span>
                    <span className="mt-2 block">
                      {plan.plazo > 0 ? <Badge tono="ok">plan: {plan.plazo} semanas</Badge> : <Badge>sin planificar</Badge>}
                    </span>
                  </span>
                </button>
                <Btn
                  variante="peligro"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => {
                    if (confirm(`¿Eliminar la obra "${nombre}"? Esta acción no se puede deshacer.`)) onEliminar(obra.id);
                  }}
                >
                  ✕
                </Btn>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
