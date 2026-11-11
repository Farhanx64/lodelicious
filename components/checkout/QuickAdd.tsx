"use client";

import { useActionState, useId, useRef } from "react";

import { addToBag, type FormState } from "@/app/(frontend)/cart/actions";
import { formatCents } from "@/src/lib/money";

import { field, label as labelClass } from "./styles";
import type { BagOption } from "./AddToBag";

const buttonClass =
  "label-caps inline-flex min-h-11 w-full items-center justify-center rounded-full border border-cocoa px-3 text-cocoa transition-colors hover:bg-cocoa hover:text-cream aria-disabled:cursor-not-allowed aria-disabled:opacity-70";

/**
 * "Add to bag" on a product card. One option: a single tap adds it. Several options: the tap opens
 * a small popup to choose the option, then adds it. Sits above the card's full-card link
 * (relative z-10) so the tap doesn't open the product page.
 */
export function QuickAdd({ options, title }: { options: BagOption[]; title: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addToBag, { error: null });
  const ids = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const many = options.length > 1;

  const error = state.error && (
    <p role="alert" className="mt-2 text-sm text-error">
      {state.error}
    </p>
  );

  if (!many) {
    return (
      <form action={action} className="relative z-10 mt-3">
        <input type="hidden" name="unitId" value={options[0].unitId} />
        <input type="hidden" name="quantity" value="1" />
        <button
          type="submit"
          aria-disabled={pending || undefined}
          aria-label={`${pending ? "Adding" : "Add to bag"}: ${title}`}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          className={buttonClass}
        >
          {pending ? "Adding…" : "Add to bag"}
        </button>
        {error}
      </form>
    );
  }

  return (
    <div className="relative z-10 mt-3">
      <button type="button" aria-haspopup="dialog" aria-label={`Add to bag: ${title}`} onClick={() => dialog.current?.showModal()} className={buttonClass}>
        Add to bag
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${ids}-title`}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="panel m-auto w-[min(100%-2rem,26rem)] text-cocoa backdrop:bg-cocoa/50"
      >
        <form action={action}>
          <h2 id={`${ids}-title`} className="mb-5 text-[1.75rem] leading-tight">
            {title}
          </h2>
          <label htmlFor={`${ids}-unit`} className={labelClass}>
            Choose an option
          </label>
          <select id={`${ids}-unit`} name="unitId" defaultValue={state.values?.unitId ?? options[0].unitId} className={`${field} mb-3`}>
            {options.map((o) => (
              <option key={o.unitId} value={o.unitId}>
                {o.label} — {formatCents(o.priceCents)}
              </option>
            ))}
          </select>
          <label htmlFor={`${ids}-qty`} className={labelClass}>
            Quantity
          </label>
          <input id={`${ids}-qty`} name="quantity" type="number" inputMode="numeric" min={1} max={20} defaultValue={1} className={`${field} mb-4 w-24`} />
          <div className="flex gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className="label-caps min-h-11 flex-1 rounded-full border border-cocoa px-3 text-cocoa">
              Cancel
            </button>
            <button
              type="submit"
              aria-disabled={pending || undefined}
              onClick={(event) => {
                if (pending) event.preventDefault();
              }}
              className="label-caps min-h-11 flex-1 rounded-full bg-gold px-3 text-cocoa transition-colors hover:bg-cocoa hover:text-cream aria-disabled:opacity-70"
            >
              {pending ? "Adding…" : "Add to bag"}
            </button>
          </div>
          {error}
        </form>
      </dialog>
    </div>
  );
}
