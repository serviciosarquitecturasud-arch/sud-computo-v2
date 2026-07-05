/**
 * Herramientas y equipos (tab de obra) — subtabs Precios | Análisis (paridad legacy).
 *  · Precios: overrides por obra (obra.precios.herramientas / herramientasConIVA +
 *    obra.proveedores.herramientas).
 *  · Análisis: pendiente también en el legacy — se mantiene el aviso con paridad.
 */
import { useState } from 'react';
import type { Catalogo, Motor, Obra } from '../../core';
import { Badge, Card, SubTabs } from '../../ui/base';
import { PreciosInsumos } from './PreciosInsumos';

interface Props {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
}

const SUBS = [
  ['precios', 'Precios'],
  ['analisis', 'Análisis']
] as const;

export function Herramientas(props: Props) {
  const [sub, setSub] = useState<'precios' | 'analisis'>('precios');
  return (
    <div>
      <header className="mb-4">
        <h1 className="font-marca text-3xl tracking-tight">Herramientas</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Valor de los equipos en esta obra (compra si es propio, jornada si es alquilado) y su
          costo horario resultante.
        </p>
      </header>
      <SubTabs tabs={SUBS} activa={sub} onCambiar={setSub} />
      {sub === 'precios' ? (
        <PreciosInsumos tipo="herr" {...props} />
      ) : (
        <Card className="p-8 text-center">
          <div className="font-marca text-lg">Análisis de herramientas</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--texto-2)]">
            Pendiente — va a incluir horas, incidencia y amortización de equipos por obra. Por
            ahora cargá precios en la subtab Precios.
          </p>
          <div className="mt-4">
            <Badge>pendiente — igual que en el legacy</Badge>
          </div>
        </Card>
      )}
    </div>
  );
}
