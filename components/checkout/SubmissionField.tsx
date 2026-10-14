import { newSubmission, type SubmissionKind } from "@/src/lib/checkout/submission";

/**
 * The signed nonce that identifies this one rendered form (A11, D42). It is created when the page
 * is rendered on the server, so a double submit of this form is one order and a fresh form is a new one.
 */
export function SubmissionField({ kind }: { kind: SubmissionKind }) {
  return <input type="hidden" name="submission" value={newSubmission(kind)} readOnly />;
}
