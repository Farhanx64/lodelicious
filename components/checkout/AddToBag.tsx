"use client";

import { useActionState, useId } from "react";

import { addToBag, type FormState } from "@/app/(frontend)/cart/actions";
import { formatCents } from "@/src/lib/money";

import { field, label, primaryButton } from "./styles";

export type BagOption = { unitId: string; label: string | null; priceCents: number };

export function AddToBag({ options }: { options: BagOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addToBag, { error: null });
  const ids = useId();
  return (
    <form action={action} className="mb-8 flex flex-wrap items-end gap-3 border border-gold bg-paper p-4">
      {options.length > 1 ? (
        <div className="min-w-[12rem] flex-1">
          <label htmlFor={`${ids}-unit`} className={label}>
            Option
          </label>
          <select id={`${ids}-unit`} name="unitId" className={field}>
            {options.map((o) => (
              <option key={o.unitId} value={o.unitId}>
                {o.label} — {formatCents(o.priceCents)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="unitId" value={options[0].unitId} />
      )}
      <div className="w-24">
        <label htmlFor={`${ids}-qty`} className={label}>
          Quantity
        </label>
        <input id={`${ids}-qty`} name="quantity" type="number" inputMode="numeric" min={1} max={20} defaultValue={1} className={field} />
      </div>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Adding…" : "Add to bag"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
