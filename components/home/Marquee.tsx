import { Asterisk } from "lucide-react";

/**
 * A slow strip of what the shop stands for, separated by small asterisks. Pure CSS (see
 * .marquee in app/globals.css): the list is printed twice and slides left by one copy, so it
 * loops without a jump. It pauses while hovered or focused (it can be tabbed to for that), and
 * for reduced motion it is a still, wrapped list. The second copy is hidden from screen readers.
 */
export function Marquee({ items, label }: { items: string[]; label: string }) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((item) => (
        <li key={item} className="flex items-center font-display text-[1.75rem] leading-none whitespace-nowrap text-cocoa md:text-[2.25rem]">
          <span className="px-5 md:px-8">{item}</span>
          <Asterisk size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-rose" />
        </li>
      ))}
    </ul>
  );
  return (
    // Focusable so keyboard users can pause it.
    <section aria-label={label} tabIndex={0} className="marquee overflow-hidden border-y border-line py-5 md:py-7">
      <div className="marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
