import { formatCents } from "@/src/lib/money";

export type SummaryLine = { key: string; title: string; detail?: string | null; quantity: number; totalCents: number };

/** Totals block shared by bag, checkout, reservation and confirmation pages. */
export function Summary({
  lines,
  subtotalCents,
  discountCents = 0,
  taxCents,
  totalCents,
  taxApproved,
  extra,
}: {
  lines: SummaryLine[];
  subtotalCents: number;
  /** A rewards discount, taken off before tax (D47). */
  discountCents?: number;
  taxCents: number;
  totalCents: number;
  taxApproved: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="panel">
      <h2 className="label-caps mb-4 text-muted">Summary</h2>
      <ul className="mb-5 divide-y divide-cocoa/15 border-y border-cocoa/15">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-4 py-3">
            <span>
              {l.quantity} × {l.title}
              {l.detail && <span className="block text-sm text-muted">{l.detail}</span>}
            </span>
            <span className="whitespace-nowrap">{formatCents(l.totalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
        <dt>Subtotal</dt>
        <dd className="text-right">{formatCents(subtotalCents)}</dd>
        {discountCents > 0 && (
          <>
            <dt>Reward</dt>
            <dd className="text-right">−{formatCents(discountCents)}</dd>
          </>
        )}
        <dt>{taxApproved ? "Tax" : "Estimated tax (to be confirmed)"}</dt>
        <dd className="text-right">{formatCents(taxCents)}</dd>
        <dt className="mt-2 border-t border-cocoa/15 pt-3 font-display text-2xl leading-none font-normal">Total</dt>
        <dd className="mt-2 border-t border-cocoa/15 pt-3 text-right font-display text-2xl leading-none">{formatCents(totalCents)}</dd>
        {extra}
      </dl>
    </div>
  );
}

export function TestModeNote() {
  return (
    <p role="note" className="mb-6 note">
      <strong>Test checkout.</strong> This preview uses a test payment — no card is needed and no money moves. Online payment will be connected
      before launch.
    </p>
  );
}
