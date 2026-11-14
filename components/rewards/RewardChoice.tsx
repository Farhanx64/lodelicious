"use client";

import { useFormValues } from "@/components/checkout/ActionForm";
import { useShipTax } from "@/components/checkout/ShipTax";

/** `labels`: the label for each ship-to tax version (D65), since the total in it depends on the state. */
export type RewardChoiceOption = { id: string; label: string; labels?: Record<string, string> };

/**
 * At checkout: which reward a signed-in member spends on this order, or none (D47). Keeps the choice
 * after an error. It sits in the order summary, outside the checkout form, so each radio joins the
 * form through `form` (D56).
 */
export function RewardChoice({
  options,
  balanceLabel,
  earnLabel,
  formId,
}: {
  options: RewardChoiceOption[];
  balanceLabel: string;
  earnLabel: string | null;
  /** The id of the checkout form the radios belong to. */
  formId?: string;
}) {
  const chosen = useFormValues().reward ?? "none";
  const { variant } = useShipTax();
  return (
    <fieldset>
      <legend className="mb-1 font-semibold">Your points</legend>
      <p className="mb-2 text-sm text-ink-soft">
        You have {balanceLabel}.{earnLabel ? ` ${earnLabel}` : ""}
      </p>
      {options.length > 0 ? (
        <div className="space-y-1">
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" form={formId} name="reward" value="none" defaultChecked={chosen === "none" || !options.some((o) => o.id === chosen)} className="size-5 shrink-0 accent-coastal-deep" />
            Don&rsquo;t use points this time
          </label>
          {options.map((o) => (
            <label key={o.id} className="flex min-h-11 items-center gap-3">
              <input type="radio" form={formId} name="reward" value={o.id} defaultChecked={chosen === o.id} className="size-5 shrink-0 accent-coastal-deep" />
              {o.labels?.[variant] ?? o.label}
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
