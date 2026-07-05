/**
 * Panel de obra — estructura en dos fases (decisión 05/07/2026):
 *   PROYECTO: todo el trabajo pre-obra (cómputo, presupuesto, plan…).
 *   OBRA: ejecución (H8 — pendiente de las planillas conceptuales del estudio).
 *   ARCHIVOS: planos y editables por obra (H3 — Google Drive).
 */
import { useState } from 'react';
import type { Catalogo, Obra } from '../../core';
import type { Motor } from '../../core';
import { Aura, auraCodigo, auraColor } from '../../ui/Aura';
import { Badge, Card } from '../../ui/base';
import { Resumen } from './Resumen';
import { Caratula } from './Caratula';
import { Computo } from './Computo';
import { Coeficiente } from './Coeficiente';
import { Presupuesto } from './Presupuesto';
import { Explosion } from './Explosion';
import { ManoObraObra } from './ManoObraObra';
import { Herramientas } from './Herramientas';
import { Plan } from './Plan';
import { Curva } from './Curva';
import { CaminoCritico } from './CaminoCritico';
import { Suministro } from './Suministro';
import { Comparativa } from './Comparativa';
import { Imprimir } from './Imprimir';
import { Archivos } from './Archivos';

type Fase = 'proyecto' | 'obra' | 'archivos';

const TABS_PROYECTO = [
  { id: 'resumen', label: 'Resumen', C: Resumen },
  { id: 'caratula', label: 'Carátula', C: Caratula },
  { id: 'computo', label: 'Cómputo', C: Computo },
  { id: 'coef', label: 'Coeficiente', C: Coeficiente },
  { id: 'presup', label: 'Presupuesto', C: Presupuesto },
  { id: 'explosion', label: 'Explosión', C: Explosion },
  { id: 'mo', label: 'Mano de obra', C: ManoObraObra },
  { id: 'herr', label: 'Herramientas', C: Herramientas },
  { id: 'plan', label: 'Plan de trabajo', C: Plan },
  { id: 'curva', label: 'Curva', C: Curva },
  { id: 'camino', label: 'Camino crítico', C: CaminoCritico },
  { id: 'suministro', label: 'Suministro', C: Suministro },
  { id: 'comparativa', label: 'Proveedores', C: Comparativa },
  { id: 'imprimir', label: 'Imprimir', C: Imprimir }
] as const;

export function ObraPanel({
  obra,
  setObra,
  cat,
  motor,
  onVolver
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  cat: Catalogo;
  motor: Motor;
  onVolver: () => void;
}) {
  const [fase, setFase] = useState<Fase>('proyecto');
  const [tab, setTab] = useState<string>('resumen');
  const nombre = obra.nombre || obra.id;
  const TabActiva = TABS_PROYECTO.find((t) => t.id === tab)?.C ?? Caratula;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button className="text-sm text-[var(--texto-2)] hover:text-[var(--texto)]" onClick={onVolver}>
          ← Obras
        </button>
        <Aura color={auraColor(nombre)} codigo={auraCodigo(nombre)} size={72} className="-m-3" />
        <div>
          <h1 className="font-marca text-2xl tracking-tight">{nombre}</h1>
          <div className="text-xs text-[var(--texto-2)]">
            {(obra.comitente as string) || ''} {(obra.direccion as string) ? '· ' + (obra.direccion as string) : ''}
          </div>
        </div>
        <div className="ml-auto flex rounded-lg border border-[var(--borde)] bg-[var(--panel)] p-0.5">
          {(
            [
              ['proyecto', 'Proyecto'],
              ['obra', 'Obra'],
              ['archivos', 'Archivos']
            ] as [Fase, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFase(f)}
              className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                fase === f
                  ? 'bg-[var(--color-sud-tinta)] font-medium text-[var(--color-sud-crema)] dark:bg-[var(--color-sud-crema)] dark:text-[var(--color-sud-tinta)]'
                  : 'text-[var(--texto-2)] hover:text-[var(--texto)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {fase === 'proyecto' && (
        <>
          <div className="mb-6 flex flex-wrap gap-1 border-b border-[var(--borde)]">
            {TABS_PROYECTO.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                  tab === t.id
                    ? 'border-[var(--color-sud-tinta)] font-medium text-[var(--texto)] dark:border-[var(--color-sud-crema)]'
                    : 'border-transparent text-[var(--texto-2)] hover:text-[var(--texto)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <TabActiva obra={obra} setObra={setObra} cat={cat} motor={motor} />
        </>
      )}

      {fase === 'obra' && (
        <Card className="p-10 text-center">
          <div className="font-marca text-xl">Fase de obra</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--texto-2)]">
            Seguimiento de ejecución: avance físico y financiero, certificaciones, desvíos,
            controles, fotos y recorridos. Se desarrolla en H8 sobre las planillas de gestión del
            estudio (pendiente de carga).
          </p>
          <div className="mt-4"><Badge>en desarrollo — H8</Badge></div>
        </Card>
      )}

      {fase === 'archivos' && <Archivos obra={obra} setObra={setObra} />}
    </div>
  );
}
