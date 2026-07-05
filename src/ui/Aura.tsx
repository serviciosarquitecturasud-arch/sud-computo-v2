/**
 * Aura de obra — la esfera difusa de la papelería SUD.
 * Cada obra tiene un color de aura y su código en crema (ej. "_M 4458").
 */
const AURA_COLORES = [
  'var(--color-sud-naranja)',
  'var(--color-sud-oliva)',
  'var(--color-sud-azul)',
  'var(--color-sud-tan)'
] as const;

/** Color determinístico según el id/nombre de la obra. */
export function auraColor(clave: string): string {
  let h = 0;
  for (let i = 0; i < clave.length; i++) h = (h * 31 + clave.charCodeAt(i)) | 0;
  return AURA_COLORES[Math.abs(h) % AURA_COLORES.length];
}

/** Deriva el código de aura desde el nombre: "Melicue 4458" → "_M\n4458". */
export function auraCodigo(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const letras = partes
    .filter((p) => !/^\d+$/.test(p))
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3);
  const numero = partes.find((p) => /^\d+$/.test(p)) ?? '';
  return `_${letras}${numero ? '\n' + numero : ''}`;
}

export function Aura({
  color,
  codigo,
  size = 96,
  className = ''
}: {
  color: string;
  codigo?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`aura flex items-center justify-center ${className}`}
      style={{ ['--aura-color' as string]: color, width: size, height: size }}
      aria-hidden
    >
      {codigo && (
        <span
          className="whitespace-pre text-center font-marca leading-tight text-[var(--color-sud-crema)]"
          style={{ fontSize: size * 0.16 }}
        >
          {codigo}
        </span>
      )}
    </div>
  );
}
