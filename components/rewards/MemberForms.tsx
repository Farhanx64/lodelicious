"use client";

import Link from "next/link";

import { forgotAction, joinAction, resetAction, signInAction } from "@/app/(frontend)/account/actions";
import { ActionForm, useFormValues } from "@/components/checkout/ActionForm";
import { field, label } from "@/components/checkout/styles";

const PASSWORD_HINT = "At least 12 characters. Under 16, mix three of: lowercase, capitals, numbers, symbols. A few unrelated words works well.";

function Input({
  id,
  name,
  text,
  type = "text",
  autoComplete,
  required = true,
  maxLength,
  hint,
  keep = true,
}: {
  id: string;
  name: string;
  text: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  /** Show the member's previous entry after an error. Never for passwords. */
  keep?: boolean;
}) {
  const values = useFormValues();
  return (
    <div className="mb-4">
      <label htmlFor={id} className={label}>
        {text}
        {!required && <span className="font-normal text-ink-soft"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mb-1 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        defaultValue={keep ? values[name] : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={field}
      />
    </div>
  );
}

function Next({ next }: { next?: string }) {
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signInAction} submitLabel="Sign in" pendingLabel="Signing in…">
      <Next next={next} />
      <Input id="signin-email" name="email" text="Email" type="email" autoComplete="email" maxLength={200} />
      <Input id="signin-password" name="password" text="Password" type="password" autoComplete="current-password" maxLength={200} keep={false} />
      <p className="mb-4 text-sm">
        <Link href="/account/forgot">Forgotten your password?</Link>
      </p>
    </ActionForm>
  );
}

export function JoinForm({ next, programName }: { next?: string; programName: string }) {
  return (
    <ActionForm action={joinAction} submitLabel={`Join ${programName}`} pendingLabel="Creating your account…">
      <Next next={next} />
      <Input id="join-name" name="name" text="Name" autoComplete="name" maxLength={100} />
      <Input id="join-email" name="email" text="Email" type="email" autoComplete="email" maxLength={200} />
      <Input id="join-phone" name="phone" text="Phone" type="tel" autoComplete="tel" required={false} maxLength={30} hint="We fill it in at checkout for you." />
      <Input id="join-password" name="password" text="Password" type="password" autoComplete="new-password" maxLength={128} hint={PASSWORD_HINT} keep={false} />
      <div className="mb-4 flex items-start gap-3">
        <input id="join-agree" name="agree" type="checkbox" value="yes" required className="mt-1 size-5 shrink-0" />
        <label htmlFor="join-agree">
          I agree to the <Link href="/rewards#terms">{programName} terms</Link>.
        </label>
      </div>
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={forgotAction} submitLabel="Email me a link" pendingLabel="Sending…">
      <Input id="forgot-email" name="email" text="Email" type="email" autoComplete="email" maxLength={200} />
    </ActionForm>
  );
}

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetAction} submitLabel="Save new password" pendingLabel="Saving…">
      <input type="hidden" name="token" value={token} />
      <Input id="reset-password" name="password" text="New password" type="password" autoComplete="new-password" maxLength={128} hint={PASSWORD_HINT} keep={false} />
    </ActionForm>
  );
}
