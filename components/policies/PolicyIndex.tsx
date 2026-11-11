import Link from "next/link";

import { getPolicyDefinition, policyStatusLabel, type ContactFacts, type ResolvedPolicy } from "@/src/lib/policies";

import { PolicyContact } from "./PolicyContact";
import { Accent } from "@/components/ui/Accent";

/** The /policies index. Each policy's status is shown on staging only. */
export function PolicyIndex({ policies, staging, contact }: { policies: ResolvedPolicy[]; staging: boolean; contact: ContactFacts }) {
  return (
    <div className="shell page max-w-[50rem]">
      <h1 className="mb-6 text-center">
        <Accent text="Policies" />
      </h1>
      <p className="mb-8 text-center text-lg">How pickup, cancellations, substitutions, damaged or missing items and privacy work at the shop.</p>
      <ul className="border-t border-line">
        {policies.map((policy) => (
          <li key={policy.slug} className="border-b border-line py-4">
            <h2 className="">
              <Link href={`/policies/${policy.slug}`} className="inline-flex min-h-11 items-center">
                {policy.title}
              </Link>
            </h2>
            <p>{getPolicyDefinition(policy.slug)?.summary}</p>
            {staging && (
              <p data-policy-status className="mt-1 text-sm text-muted">
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
