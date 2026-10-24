import type { Metadata } from "next";

import { PolicyIndex } from "@/components/policies/PolicyIndex";
import { resolveAllPolicies } from "@/src/lib/policies";
import { loadPolicyPage } from "@/src/lib/policies-data";

export const metadata: Metadata = {
  title: "Policies",
  description: "Pickup, delivery, cancellations, refunds, substitutions, damaged or missing items and privacy.",
};

export default async function PoliciesPage() {
  const { stored, env } = await loadPolicyPage();
  return <PolicyIndex policies={resolveAllPolicies(stored, env)} staging={env.staging} contact={env.contact} />;
}
