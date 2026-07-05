/** Vista de aprobación del design system (checkpoint H1). Se retira al cerrar el hito. */
import { Aura } from '../ui/Aura';
import { Badge, Btn, Card, SectionTitle, td, th } from '../ui/base';
import { money } from '../core';

const COLORES = [
  ['Naranja SUD', '#DC8A52'],
  ['Oliva SUD', '#63704A'],
  ['Azul SUD', '#78A6C0'],
  ['Tan', '#D9B798'],
  ['Crema', '#FDFAE7'],
  ['Tinta', '#1B1B18']
] as const;

export function SistemaVisual() {
  return (
    <div className="max-w-4xl space-y-10">
      <header>
        <h1 className="font-marca text-3xl tracking-tight">Sistema visual</h1>
        <p className="mt-1 text-sm text-[var(--texto-2)]">
          Checkpoint H1 — identidad SUD_estudio aplicada a la app. Esta página se retira al aprobar.
        </p>
      </header>

      <section>
        <SectionTitle>Paleta (de la papelería del estudio)</SectionTitle>
        <div className="flex flex-wrap gap-3">
          {COLORES.map(([nombre, hex]) => (
            <div key={hex} className="w-28">
              <div
                className="h-16 rounded-lg border border-[var(--borde)]"
                style={{ background: hex }}
              />
              <div className="mt-1 text-xs font-medium">{nombre}</div>
              <div className="text-[10px] text-[var(--texto-2)]">{hex}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Auras de obra (identidad por proyecto)</SectionTitle>
        <div className="flex flex-wrap items-center gap-6">
          <Aura color="var(--color-sud-naranja)" codigo={'_M\n4458'} size={130} />
          <Aura color="var(--color-sud-oliva)" codigo={'_JAG\n4060'} size={130} />
          <Aura color="var(--color-sud-azul)" codigo={'_RJ\n587'} size={130} />
          <Aura color="var(--color-sud-tan)" codigo={'_CD\n110'} size={130} />
        </div>
        <p className="mt-2 text-xs text-[var(--texto-2)]">
          Cada obra recibe su esfera difusa — el mismo recurso de las gráficas de obra del estudio.
        </p>
      </section>

      <section>
        <SectionTitle>Tipografía</SectionTitle>
        <Card className="p-5">
          <p className="font-marca text-2xl">Acid Grotesk — títulos, marca y códigos de obra</p>
          <p className="mt-2 text-sm">
            Inter — texto de interfaz, tablas y números. Alineación tabular:{' '}
            <span className="tabular-nums">{money(1234567.89)} / {money(987.5)}</span>
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>Componentes</SectionTitle>
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Btn variante="primario">Guardar</Btn>
            <Btn>Exportar respaldo</Btn>
            <Btn variante="fantasma">Cancelar</Btn>
            <Btn variante="peligro">Eliminar ítem</Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tono="ok">Adjudicado ✓</Badge>
            <Badge tono="info">en uso</Badge>
            <Badge tono="alerta">requiere cotización</Badge>
            <Badge>sin planificar</Badge>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Código</th>
                <th className={th}>Descripción</th>
                <th className={th}>Unidad</th>
                <th className={`${th} text-right`}>Cantidad</th>
                <th className={`${th} text-right`}>Precio unit.</th>
                <th className={`${th} text-right`}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${td} font-medium`}>3.01.01</td>
                <td className={td}>Hormigón H21 para bases — elaborado en obra</td>
                <td className={td}>m³</td>
                <td className={`${td} text-right`}>12,50</td>
                <td className={`${td} text-right`}>{money(98432.1)}</td>
                <td className={`${td} text-right font-medium`}>{money(1230401.25)}</td>
              </tr>
              <tr>
                <td className={`${td} font-medium`}>4.01</td>
                <td className={td}>Mampostería ladrillo hueco 18 — tizón</td>
                <td className={td}>m²</td>
                <td className={`${td} text-right`}>85,00</td>
                <td className={`${td} text-right`}>{money(41250)}</td>
                <td className={`${td} text-right font-medium`}>{money(3506250)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <SectionTitle>Portada / login (degradado de papelería)</SectionTitle>
        <div className="fondo-paleta flex h-48 items-end rounded-[var(--radius-card)] border border-[var(--borde)] p-6">
          <span className="font-marca text-[#1B1B18]">
            <span className="text-4xl tracking-tight">SUD</span>
            <span className="text-xl">_cómputo</span>
          </span>
        </div>
      </section>
    </div>
  );
}
