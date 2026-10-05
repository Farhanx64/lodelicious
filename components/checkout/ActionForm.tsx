"use client";

import { useActionState } from "react";

import { primaryButton } from "./styles";

type State = { error: string | null };

/** A form bound to a server action, showing its error and disabling the button while it runs. */
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
  return (
    <form action={run}>
      {children}
      {state.error && (
        <p role="alert" className="mb-4 border border-error p-3 text-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={disabled || pending} className={`${primaryButton} w-full`}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
