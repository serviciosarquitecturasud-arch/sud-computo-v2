/** Marca SUD_estudio — wordmark tipográfico (Acid Grotesk, solo Regular). */
export function Logo({ sub = 'cómputo', className = '' }: { sub?: string; className?: string }) {
  return (
    <span className={`font-marca select-none leading-none ${className}`}>
      <span className="text-[1.6em] tracking-tight">SUD</span>
      <span className="text-[0.95em] text-[var(--texto-2)]">_{sub}</span>
    </span>
  );
}
