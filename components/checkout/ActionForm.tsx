"use client";

import { createContext, useActionState, useContext, useEffect, useRef } from "react";

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
  // Keyed on the state object, not the message: the same error twice in a row must still move focus.
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  return (
    <FormValuesContext value={state.values ?? NO_VALUES}>
      <form action={run}>
        {children}
        {state.error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="mb-4 border border-error p-3 text-error outline-offset-2">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          aria-disabled={pending || undefined}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          className={`${primaryButton} w-full`}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </form>
    </FormValuesContext>
  );
}
