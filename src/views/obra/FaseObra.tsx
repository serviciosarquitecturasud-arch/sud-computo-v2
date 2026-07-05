/**
 * Fase OBRA del panel de obra (H8a) — dirección de obra en ejecución.
 * Subtabs: Diario (jornales/fijos/adelantos) | Caja (movimientos) |
 * Compras (saldo regresivo de materiales) | Herramientas (inventario).
 * Réplica profesionalizada de las planillas reales del estudio.
 */
import { useState } from 'react';
import type { Motor, Obra } from '../../core';
import { SubTabs } from '../../ui/base';
import { ObraDiario } from './ObraDiario';
import { ObraCaja } from './ObraCaja';
import { ObraCompras } from './ObraCompras';
import { ObraHerramientasObra } from './ObraHerramientasObra';

type TabObra = 'diario' | 'caja' | 'compras' | 'herramientas';

const TABS = [
  ['diario', 'Diario'],
  ['caja', 'Caja'],
  ['compras', 'Compras'],
  ['herramientas', 'Herramientas']
] as const;

export function FaseObra({
  obra,
  setObra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  motor: Motor;
}) {
  const [tab, setTab] = useState<TabObra>('diario');
  return (
    <div>
      <SubTabs tabs={TABS} activa={tab} onCambiar={setTab} />
      {tab === 'diario' && <ObraDiario obra={obra} setObra={setObra} motor={motor} />}
      {tab === 'caja' && <ObraCaja obra={obra} setObra={setObra} />}
      {tab === 'compras' && <ObraCompras obra={obra} setObra={setObra} motor={motor} />}
      {tab === 'herramientas' && <ObraHerramientasObra obra={obra} setObra={setObra} />}
    </div>
  );
}
