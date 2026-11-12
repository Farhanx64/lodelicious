"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { addToBag, updateBagLine, type FormState } from "@/app/(frontend)/cart/actions";
import { MAX_LINE_QUANTITY } from "@/src/lib/checkout/cart";

/**
 * The order summary folds away behind "Show order summary · $X" on a phone and is always open from
 * the tablet width up (D56). Without JavaScript a phone starts with it folded; the totals are also
 * repeated above the Pay button.
 */
export function SummaryDisclosure({ id, totalLabel, children }: { id: string; totalLabel: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mb-4 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-2 text-left md:hidden"
      >
        <span className="flex items-center gap-2 font-semibold">
          {open ? "Hide order summary" : "Show order summary"}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className={`size-4 motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </span>
        <span className="font-semibold">{totalLabel}</span>
      </button>
      <div id={id} className={open ? "block" : "hidden md:block"}>
        {children}
      </div>
    </div>
  );
}

/**
 * A small "i" button that shows a note (the tax rate) on click, and hides it on Escape or when focus
 * leaves. The note is in a live region, so a screen reader reads it out when it appears.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="-my-3 inline-flex size-11 items-center justify-center text-ink-soft"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.2v4M8 4.8v.1" strokeLinecap="round" />
        </svg>
      </button>
      <span id={id} role="status">
        {open && <span className="absolute top-full left-0 z-30 mt-1 w-64 rounded-lg bg-ink p-3 text-sm font-normal text-paper shadow-lg">{text}</span>}
      </span>
    </span>
  );
}

function StepButton({ value, disabled, label, children }: { value: number; disabled: boolean; label: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="quantity"
      value={value}
      disabled={disabled}
      aria-disabled={pending || undefined}
      aria-label={label}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
      className="inline-flex size-11 items-center justify-center text-lg text-ink disabled:text-line aria-disabled:cursor-progress"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

/**
 * − quantity + on a bag line at checkout. Each press posts the bag's own update action (the same
 * one the bag page uses), so the summary and the Pay amount are re-priced on the server. The new
 * quantity is announced. Removing is the X, not "−" at 1.
 */
export function QtyStepper({ unitId, title, quantity }: { unitId: string; title: string; quantity: number }) {
  return (
    <form action={updateBagLine} role="group" aria-label={`Quantity of ${title}`} className="inline-flex items-center rounded-full border border-ink-soft bg-paper">
      <input type="hidden" name="unitId" value={unitId} />
      <StepButton value={quantity - 1} disabled={quantity <= 1} label={`One fewer ${title}`}>
        −
      </StepButton>
      <span aria-live="polite" className="min-w-6 text-center font-semibold">
        <span className="sr-only">Quantity </span>
        {quantity}
      </span>
      <StepButton value={quantity + 1} disabled={quantity >= MAX_LINE_QUANTITY} label={`One more ${title}`}>
        +
      </StepButton>
    </form>
  );
}

function RemoveButton({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="remove"
      value="1"
      aria-label={`Remove ${title}`}
      aria-disabled={pending || undefined}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
      className="inline-flex size-11 items-center justify-center text-ink"
    >
      <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full bg-ink text-paper">
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </span>
    </button>
  );
}

/** The X on a bag line at checkout: takes the line out of the bag (the last one sends the customer back to the empty bag). */
export function RemoveLine({ unitId, title }: { unitId: string; title: string }) {
  return (
    <form action={updateBagLine}>
      <input type="hidden" name="unitId" value={unitId} />
      <RemoveButton title={title} />
    </form>
  );
}

/**
 * "+ Add to your order" for the one suggested product. It uses the bag's add action and comes back
 * to checkout (same pickup or shipping choice) instead of the bag page; an error is shown here.
 */
export function AddOnButton({ unitId, title, next }: { unitId: string; title: string; next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addToBag, { error: null });
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);
  const visible = pending ? "Adding…" : "Add to your order";
  return (
    <form action={action}>
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="quantity" value="1" />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        aria-disabled={pending || undefined}
        // Visible words first, so the accessible name contains them (WCAG 2.5.3).
        aria-label={`${visible}: ${title}`}
        onClick={(e) => {
          if (pending) e.preventDefault();
        }}
        className="-ml-2 inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-coastal-deep"
      >
        <span aria-hidden="true" className="inline-flex size-5 items-center justify-center rounded-full border border-current leading-none">
          +
        </span>
        {visible}
      </button>
      {state.error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-error outline-offset-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
