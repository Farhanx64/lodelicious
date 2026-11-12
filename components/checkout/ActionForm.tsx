"use client";

import { createContext, startTransition, useActionState, useCallback, useContext, useEffect, useRef, useState } from "react";

import { primaryButton } from "./styles";

type State = { error: string | null; values?: Record<string, string> };

const NO_VALUES: Record<string, string> = {};
export const FormValuesContext = createContext<Record<string, string>>(NO_VALUES);

/**
 * The entries the customer submitted last time, echoed back by the server action. Fields inside an
 * {@link ActionForm} read them as their `defaultValue`: React 19 resets a `<form action>` once the
 * action finishes, so without this an error would empty every field (WCAG 3.3.7).
 */
export function useFormValues(): Record<string, string> {
  return useContext(FormValuesContext);
}

/**
 * Runs in the browser just before the form is sent, and may add fields to it. Returns an error to
 * show instead of submitting, or null. The card fields use this to turn the card into a one-time
 * token from the payment provider (D54), so the card number itself is never part of the form.
 */
export type Preparer = (form: FormData) => Promise<string | null>;
const PreparerContext = createContext<((p: Preparer | null) => void) | null>(null);

/** Registers a {@link Preparer} with the surrounding ActionForm while the component is mounted. */
export function usePreparer(preparer: Preparer | null) {
  const register = useContext(PreparerContext);
  useEffect(() => {
    register?.(preparer);
    return () => register?.(null);
  }, [register, preparer]);
}

/**
 * A form bound to a server action. After an error it keeps the customer's entries, moves focus to
 * the message, and uses `aria-disabled` rather than `disabled` while the action runs, so keyboard
 * focus stays on the button and a second click is ignored instead of lost.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  disabled,
  children,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  submitLabel: string;
  pendingLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [state, run, pending] = useActionState<State, FormData>(action, { error: null });
  const errorRef = useRef<HTMLParagraphElement>(null);
  const preparer = useRef<Preparer | null>(null);
  const register = useCallback((p: Preparer | null) => {
    preparer.current = p;
  }, []);
  const [preparing, setPreparing] = useState(false);
  // An error from the browser step (the card), shown like the server's. It belongs to the server answer it
  // was raised after, so the next answer from the server replaces it.
  const [local, setLocal] = useState<{ error: string; after: State } | null>(null);
  const shown = local && local.after === state ? local : state;
  // Keyed on the state object, not the message: the same error twice in a row must still move focus.
  useEffect(() => {
    if (shown.error) errorRef.current?.focus();
  }, [shown]);
  const busy = pending || preparing;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!preparer.current) return; // nothing to do in the browser: the form posts to the action as usual
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setPreparing(true);
    let error: string | null;
    try {
      error = await preparer.current(form);
    } catch {
      error = "Your card details couldn't be checked. Please try again.";
    }
    setPreparing(false);
    if (error) {
      setLocal({ error, after: state });
      return;
    }
    setLocal(null);
    startTransition(() => run(form));
  }

  return (
    <PreparerContext value={register}>
    <FormValuesContext value={state.values ?? NO_VALUES}>
      <form action={run} onSubmit={onSubmit}>
        {children}
        {shown.error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="mb-4 border border-error p-3 text-error outline-offset-2">
            {shown.error}
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (busy) event.preventDefault();
          }}
          className={`${primaryButton} w-full`}
        >
          {busy ? pendingLabel : submitLabel}
        </button>
      </form>
    </FormValuesContext>
    </PreparerContext>
  );
}
