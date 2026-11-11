import Link from "next/link";

import { Bow } from "@/components/brand/Bow";
import { getPolicyDefinition, policyStatusLabel, type ContactFacts, type ResolvedPolicy } from "@/src/lib/policies";

import { PolicyContact } from "./PolicyContact";

/** The /policies index. Each policy's status is shown on staging only. */
export function PolicyIndex({ policies, staging, contact }: { policies: ResolvedPolicy[]; staging: boolean; contact: ContactFacts }) {
  return (
    <div className="mx-auto w-[min(100%-2rem,44rem)]">
      <Bow className="mx-auto mb-4 w-14 text-gold" />
      <h1 className="mb-4 text-center text-[clamp(2rem,5vw,3rem)]">Policies</h1>
      <p className="mb-8 text-center text-lg">How pickup, cancellations, substitutions, damaged or missing items and privacy work at the shop.</p>
      <ul className="border-t border-line">
        {policies.map((policy) => (
          <li key={policy.slug} className="border-b border-line py-4">
            <h2 className="text-xl">
              <Link href={`/policies/${policy.slug}`} className="inline-flex min-h-11 items-center">
                {policy.title}
              </Link>
            </h2>
            <p>{getPolicyDefinition(policy.slug)?.summary}</p>
            {staging && (
              <p data-policy-status className="mt-1 text-sm text-ink-soft">
                {policyStatusLabel(policy.view)}
              </p>
            )}
          </li>
        ))}
      </ul>
      <PolicyContact contact={contact} />
    </div>
  );
}
