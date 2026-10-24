import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PolicyDocument } from "@/components/policies/PolicyDocument";
import { getPolicyDefinition, resolvePolicy } from "@/src/lib/policies";
import { loadPolicyPage } from "@/src/lib/policies-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const def = getPolicyDefinition(slug);
  if (!def) return {};
  const { stored, env } = await loadPolicyPage();
  const policy = resolvePolicy(slug, stored, env);
  return {
    title: policy?.title ?? def.title,
    description: def.summary,
    // Only approved text is for search engines; a "being finalised" page or a draft is not.
    robots: policy?.view === "approved" ? undefined : { index: false },
  };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  if (!getPolicyDefinition(slug)) notFound();
  const { stored, store, env } = await loadPolicyPage();
  const policy = resolvePolicy(slug, stored, env);
  if (!policy) notFound();
  return <PolicyDocument policy={policy} contact={env.contact} allergyNotice={store.allergyNotice} />;
}
