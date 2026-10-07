import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";

import type { Policy, StoreSetting } from "@/payload-types";

import type { ContactFacts, ResolveEnv } from "./policies";
import { getStoreSettings, isStaging } from "./store";

/** The admin-edited policy text. Read through the Local API; the REST/GraphQL read is staff-only. */
export async function getPolicies(): Promise<Policy> {
  const payload = await getPayload({ config });
  return payload.findGlobal({ slug: "policies", depth: 0 });
}

export function contactFacts(store: StoreSetting): ContactFacts {
  return { street: store.street, locality: store.locality, phone: store.phone, email: store.email, doordashUrl: store.doordashUrl };
}

/** Everything a policy page needs: the stored text, the store, and the staging/live decision. */
export async function loadPolicyPage(): Promise<{ stored: Policy; store: StoreSetting; env: ResolveEnv }> {
  const [stored, store] = await Promise.all([getPolicies(), getStoreSettings()]);
  return { stored, store, env: { staging: isStaging(), contact: contactFacts(store) } };
}
