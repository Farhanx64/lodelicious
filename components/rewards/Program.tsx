import { formatCents } from "@/src/lib/money";
import { formatPoints, sortedOptions, type RewardsConfig } from "@/src/lib/rewards/program";

/** Staging only: the terms aren't approved, so nothing here is a promise yet (D47, like D39). */
export function DraftNotice() {
  return (
    <p role="note" className="mb-6 border border-gold bg-blush p-4">
      <strong>Draft program.</strong> The rewards terms haven&rsquo;t been approved yet, so this shows only on the preview site and may change.
    </p>
  );
}

export function EarnRate({ program }: { program: RewardsConfig }) {
  return (
    <p>
      Earn <strong>{formatPoints(program.pointsPerDollar ?? 0)}</strong> for every dollar you spend online before tax, on shop orders and basket reservations
      once they&rsquo;re paid in full.
    </p>
  );
}

export function RewardList({ program, balance }: { program: RewardsConfig; balance?: number }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {sortedOptions(program.options).map((o) => {
        const ready = balance !== undefined && balance >= o.pointsRequired;
        return (
          <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
            <span className="font-display text-xl text-gold-text">{formatCents(o.discountCents)} off</span>
            <span>
              {formatPoints(o.pointsRequired)}
              {ready && <span className="ml-2 border border-gold px-2 py-0.5 text-sm">Ready to use</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The terms as paragraphs (separated by blank lines). */
export function Terms({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="mb-3 whitespace-pre-line">
            {p}
          </p>
        ))}
    </>
  );
}
