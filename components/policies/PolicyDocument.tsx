import Link from "next/link";

import { Bow } from "@/components/brand/Bow";
import { DRAFT_BANNER_TITLE, PENDING_MESSAGE, formatReviewed, type ContactFacts, type ResolvedPolicy } from "@/src/lib/policies";

import { PolicyContact } from "./PolicyContact";

function DraftBanner({ policy }: { policy: ResolvedPolicy }) {
  return (
    <div role="note" data-policy-banner className="mb-8 border-l-4 border-gold bg-linen p-4">
      <p className="font-semibold">{DRAFT_BANNER_TITLE}</p>
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
          <p className="mt-3 text-sm font-semibold">Still to be decided</p>
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
    <div className="mx-auto w-[min(100%-2rem,44rem)]">
      <Bow className="mx-auto mb-4 w-14 text-gold" />
      <h1 className="mb-8 text-center text-[clamp(2rem,5vw,3rem)]">{policy.title}</h1>
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
        <section aria-labelledby="policy-allergy" className="mt-8 border-l-4 border-gold bg-paper p-4">
          <h2 id="policy-allergy" className="mb-2 text-xl">
            Allergy notice
          </h2>
          <p className="whitespace-pre-line">{notice}</p>
        </section>
      )}
      {reviewed && <p className="mt-6 text-sm text-ink-soft">Last reviewed {reviewed}</p>}
      <PolicyContact contact={contact} />
      <p className="mt-4 text-center">
        <Link href="/policies" className="inline-flex min-h-11 items-center">
          All policies
        </Link>
      </p>
    </div>
  );
}
