import { formatCents } from "@/src/lib/money";

export type SummaryLine = { key: string; title: string; detail?: string | null; quantity: number; totalCents: number };

/** Totals block shared by bag, checkout, reservation and confirmation pages. */
export function Summary({
  lines,
  subtotalCents,
  taxCents,
  totalCents,
  taxApproved,
  extra,
}: {
  lines: SummaryLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxApproved: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="border border-gold bg-paper p-5">
      <ul className="mb-4 divide-y divide-line">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-4 py-2">
            <span>
              {l.quantity} × {l.title}
              {l.detail && <span className="block text-sm text-ink-soft">{l.detail}</span>}
            </span>
            <span className="whitespace-nowrap">{formatCents(l.totalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>Subtotal</dt>
        <dd className="text-right">{formatCents(subtotalCents)}</dd>
        <dt>{taxApproved ? "Tax" : "Estimated tax (to be confirmed)"}</dt>
        <dd className="text-right">{formatCents(taxCents)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold">{formatCents(totalCents)}</dd>
        {extra}
      </dl>
    </div>
  );
}

export function TestModeNote() {
  return (
    <p role="note" className="mb-6 border border-gold bg-blush p-4">
      <strong>Test checkout.</strong> This preview uses a test payment — no card is needed and no money moves. Online payment will be connected
      before launch.
    </p>
  );
}
