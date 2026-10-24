import Link from "next/link";

/**
 * A quiet pointer to the pickup and cancellation policies on the checkout and reservation pages.
 * Informational only: it never asks the customer to agree to policies Lody has not approved.
 */
export function PolicyLinks({ action }: { action: "order" | "reserve" }) {
  return (
    <p className="mt-6 text-sm">
      Before you {action}, see our <Link href="/policies/pickup-and-delivery">pickup and delivery</Link> and{" "}
      <Link href="/policies/cancellations-and-refunds">cancellations and refunds</Link> policies.
    </p>
  );
}
