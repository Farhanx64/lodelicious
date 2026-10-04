/** The gold ribbon bow from Lody's mood board, drawn as line art so it stays crisp at any size. */
export function Bow({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* loops */}
      <path d="M28.5 16.5C21 6.5 6.5 4.5 5.5 13.5c-.8 7.5 12 9.5 23 6" />
      <path d="M35.5 16.5c7.5-10 22-12 23-3 .8 7.5-12 9.5-23 6" />
      <path d="M28 15c-6-5.5-14-7-16.5-4" opacity={0.7} />
      <path d="M36 15c6-5.5 14-7 16.5-4" opacity={0.7} />
      {/* knot */}
      <rect x={28.5} y={13.5} width={7} height={9} rx={2.5} />
      {/* tails */}
      <path d="M29.5 22.5C26 30 21 37.5 15.5 44l6-1.5 2.5 4c3-7.5 6.5-15 8-23" />
      <path d="M34.5 22.5C38 30 43 37.5 48.5 44l-6-1.5-2.5 4c-3-7.5-6.5-15-8-23" />
    </svg>
  );
}
