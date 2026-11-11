import Link from "next/link";

import { DRAFT_BANNER_TITLE, PENDING_MESSAGE, formatReviewed, type ContactFacts, type ResolvedPolicy } from "@/src/lib/policies";

import { PolicyContact } from "./PolicyContact";
import { Accent } from "@/components/ui/Accent";

function DraftBanner({ policy }: { policy: ResolvedPolicy }) {
  return (
    <div role="note" data-policy-banner className="mb-8 note">
      <p className="font-medium">{DRAFT_BANNER_TITLE}</p>
      {policy.view === "draft" ? (
        <p className="mt-1 text-sm">
          This wording is built only from facts the shop has confirmed. It is not approved and does not appear on the live site. To replace it, save your own text in Admin → Policies.
        </p>
      ) : (
        <p className="mt-1 text-sm">
          This text is saved but not approved. The live site shows it only after Lody ticks Approved in Admin → Policies; until then it says the policy is being finalised.
        </p>
      )}
      {policy.openTerms.length > 0 && (
        <>
          <p className="mt-3 text-sm font-medium">Still to be decided</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {policy.openTerms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** One customer policy page: the resolved text, or the live "being finalised" message. */
export function PolicyDocument({ policy, contact, allergyNotice }: { policy: ResolvedPolicy; contact: ContactFacts; allergyNotice?: string | null }) {
  const reviewed = policy.view === "approved" ? formatReviewed(policy.lastReviewed) : null;
  const notice = policy.showsAllergyNotice ? allergyNotice?.trim() : "";
  return (
    <div className="shell page max-w-[50rem]">
      <h1 className="mb-10 text-center">
        <Accent text={policy.title} />
      </h1>
      {policy.banner && <DraftBanner policy={policy} />}
      {policy.view === "pending" ? (
        <p data-policy-pending className="mb-4 text-center text-lg">
          {PENDING_MESSAGE}
        </p>
      ) : (
        // Lody's own words (or the staging draft); a blank line starts a new paragraph.
        policy.paragraphs.map((paragraph, i) => (
          <p key={i} className="mb-4 text-lg whitespace-pre-line">
            {paragraph}
          </p>
        ))
      )}
      {notice && (
        <section aria-labelledby="policy-allergy" className="mt-8 note">
          <h2 id="policy-allergy" className="mb-2">
            Allergy notice
          </h2>
          <p className="whitespace-pre-line">{notice}</p>
        </section>
      )}
      {reviewed && <p className="mt-6 text-sm text-muted">Last reviewed {reviewed}</p>}
      <PolicyContact contact={contact} />
      <p className="mt-4 text-center">
        <Link href="/policies" className="inline-flex min-h-11 items-center">
          All policies
        </Link>
      </p>
    </div>
  );
}
