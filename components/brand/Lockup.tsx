import { Bow } from "./Bow";

/**
 * The board's lockup: gold bow, letterspaced SOUSET-PINK in serif capitals, the tagline in small
 * capitals and a short gold rule. Text comes from Store settings so /admin can change it.
 */
export function Lockup({ name, tagline, size = "md" }: { name: string; tagline?: string | null; size?: "sm" | "md" | "lg" }) {
  const word = { sm: "text-2xl", md: "text-[clamp(1.75rem,5vw,2.75rem)]", lg: "text-[clamp(2.25rem,7vw,4.25rem)]" }[size];
  const bow = { sm: "w-9", md: "w-12", lg: "w-16" }[size];
  return (
    <span className="flex flex-col items-center text-center text-gold-text">
      <Bow className={`${bow} mb-1 text-gold`} />
      <span className={`font-display leading-none font-medium tracking-[0.16em] uppercase ${word}`}>{name}</span>
      {tagline && <span className="caps mt-2 text-[0.7rem] text-gold-text sm:text-xs">{tagline}</span>}
      {size !== "sm" && <span aria-hidden="true" className="mt-3 h-px w-14 bg-gold" />}
    </span>
  );
}
