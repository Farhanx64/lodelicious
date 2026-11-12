"use client";

import { useActionState, useEffect, useId, useRef, useSyncExternalStore } from "react";

import { addToBag, type FormState } from "@/app/(frontend)/cart/actions";
import { BAG_ADDED_EVENT } from "@/src/lib/checkout/receipt";
import { formatCents } from "@/src/lib/money";

import { field, label, primaryButton } from "./styles";

export type BagOption = { unitId: string; label: string | null; priceCents: number };

const noSubscribe = () => () => {};

/**
 * Add-to-bag form. After an error it keeps the option and quantity the customer chose, moves
 * focus to the message, and says which option the button adds, even when there is only one.
 * Once the page is interactive it stays on the page after adding and the floating receipt slides
 * in (D58); without JavaScript the action still goes to the bag.
 */
export function AddToBag({ options }: { options: BagOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addToBag, { error: null });
  const ids = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  // True only after hydration, so the server-rendered (no JavaScript) form never asks to stay.
  const interactive = useSyncExternalStore(noSubscribe, () => true, () => false);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
    if (state.added) window.dispatchEvent(new Event(BAG_ADDED_EVENT));
  }, [state]);

  const only = options.length === 1 ? options[0] : null;
  const chosenUnit = state.values?.unitId && options.some((o) => o.unitId === state.values?.unitId) ? state.values.unitId : undefined;
  const visibleLabel = pending ? "Adding…" : "Add to bag";
  return (
    <form action={action} className="mb-8 flex flex-wrap items-end gap-3 border border-gold bg-paper p-4">
      {interactive && <input type="hidden" name="stay" value="1" />}
      {options.length > 1 ? (
        <div className="min-w-[12rem] flex-1">
          <label htmlFor={`${ids}-unit`} className={label}>
            Option
          </label>
          <select id={`${ids}-unit`} name="unitId" defaultValue={chosenUnit} className={field}>
            {options.map((o) => (
              <option key={o.unitId} value={o.unitId}>
                {o.label} — {formatCents(o.priceCents)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <input type="hidden" name="unitId" value={options[0].unitId} />
          {only?.label && <p className="min-w-[12rem] flex-1">Option: {only.label}</p>}
        </>
      )}
      <div className="w-24">
        <label htmlFor={`${ids}-qty`} className={label}>
          Quantity
        </label>
        <input id={`${ids}-qty`} name="quantity" type="number" inputMode="numeric" min={1} max={20} defaultValue={state.values?.quantity ?? 1} className={field} />
      </div>
      <button
        type="submit"
        aria-disabled={pending || undefined}
        // The visible words come first so the accessible name contains them (WCAG 2.5.3).
        aria-label={only?.label ? `${visibleLabel}: ${only.label}` : undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
        className={primaryButton}
      >
        {visibleLabel}
      </button>
      {/* The receipt's own live region announces the new count; this confirms it beside the button. */}
      {state.added && !pending && <p className="w-full text-sm text-success">Added to your bag.</p>}
      {state.error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="w-full text-sm text-error outline-offset-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
