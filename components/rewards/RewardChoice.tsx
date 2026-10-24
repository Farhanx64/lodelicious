"use client";

import { useFormValues } from "@/components/checkout/ActionForm";

export type RewardChoiceOption = { id: string; label: string };

/** At checkout: which reward a signed-in member spends on this order, or none (D47). Keeps the choice after an error. */
export function RewardChoice({ options, balanceLabel, earnLabel }: { options: RewardChoiceOption[]; balanceLabel: string; earnLabel: string | null }) {
  const chosen = useFormValues().reward ?? "none";
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 font-display text-xl text-gold-text">Your points</legend>
      <p className="mb-3 text-sm">
        You have {balanceLabel}.{earnLabel ? ` ${earnLabel}` : ""}
      </p>
      {options.length > 0 ? (
        <div className="space-y-1">
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="reward" value="none" defaultChecked={chosen === "none" || !options.some((o) => o.id === chosen)} className="size-5" />
            Don&rsquo;t use points this time
          </label>
          {options.map((o) => (
            <label key={o.id} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="reward" value={o.id} defaultChecked={chosen === o.id} className="size-5" />
              {o.label}
            </label>
          ))}
          <p className="text-sm text-ink-soft">A reward comes off before tax. Your total is confirmed when you place the order.</p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Not enough points for a reward on this order yet.</p>
      )}
    </fieldset>
  );
}
