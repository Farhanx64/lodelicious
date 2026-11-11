// Shared control styles (D49). Buttons are pills with the small spaced-capital label; filled ones
// are gold with cocoa labels.
export const primaryButton =
  "label-caps inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-8 text-center text-cocoa no-underline transition-colors hover:bg-cocoa hover:text-cream disabled:cursor-not-allowed disabled:bg-line disabled:text-cocoa aria-disabled:cursor-not-allowed aria-disabled:bg-line aria-disabled:text-cocoa";
export const secondaryButton =
  "label-caps inline-flex min-h-12 items-center justify-center rounded-full border border-cocoa px-8 text-center text-cocoa no-underline transition-colors hover:bg-cocoa hover:text-cream";
// The muted border is 5.6:1 on the page, so a field's edge is clear without relying on its fill.
export const field = "min-h-12 w-full rounded-xl border border-muted bg-cream px-4 py-2.5 text-cocoa";
export const label = "label-caps mb-2 block text-cocoa";
/** Legend of a form section. */
export const legend = "mb-4 font-display text-[1.75rem] leading-tight text-cocoa";
