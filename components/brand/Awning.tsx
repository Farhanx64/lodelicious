/**
 * The scalloped shop awning from Lody's mood board, drawn rather than photographed: an ivory
 * canopy with a gold-edged scalloped hem. Purely decorative.
 */
export function AwningHem({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`block h-7 w-full ${className}`} preserveAspectRatio="none" viewBox="0 0 240 14">
      <defs>
        <pattern id="awning-scallop" width="24" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 0h24v1C24 8 18.6 13 12 13S0 8 0 1Z" fill="var(--color-paper)" stroke="var(--color-gold)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="240" height="14" fill="url(#awning-scallop)" />
    </svg>
  );
}
