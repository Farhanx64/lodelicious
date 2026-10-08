import { APIError, type Field, type GlobalBeforeChangeHook, type GlobalConfig, type Tab } from "payload";

import { hasRole, isCommerceManager, isStaff } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";
import { POLICIES, type PolicyDefinition } from "../src/lib/policies";

type StoredGroup = { title?: string | null; body?: string | null; approved?: boolean | null };

const text = (value: string | null | undefined) => value?.trim() ?? "";

/**
 * Approval is Lody's. Faisal (manager) can write and save policy text, but:
 * - only the owner can tick Approved;
 * - changing the title or text of an approved policy clears the tick unless the owner saved it,
 *   so an edit never goes live without her approval;
 * - nobody can approve a policy with no text.
 * Works on partial updates too: missing fields fall back to what is stored.
 */
const guardApproval: GlobalBeforeChangeHook = ({ data, originalDoc, req }) => {
  const owner = hasRole(req.user as Parameters<typeof hasRole>[0], "owner");
  for (const def of POLICIES) {
    const incoming = (data as Record<string, StoredGroup | null | undefined>)[def.field];
    if (!incoming) continue;
    const before = (originalDoc as Record<string, StoredGroup | null | undefined> | undefined)?.[def.field] ?? {};

    let approved = incoming.approved === undefined ? before.approved === true : incoming.approved === true;
    if (!owner) {
      if (approved && before.approved !== true) throw new APIError(`Only the owner can approve a policy (${def.title}).`, 403, undefined, true);
      const changed =
        (incoming.body !== undefined && text(incoming.body) !== text(before.body)) || (incoming.title !== undefined && text(incoming.title) !== text(before.title));
      if (changed) approved = false;
    }
    const body = incoming.body === undefined ? before.body : incoming.body;
    if (approved && !text(body)) throw new APIError(`Write the policy text before approving it (${def.title}).`, 400, undefined, true);
    incoming.approved = approved;
  }
  return data;
};

/**
 * One fixed group per policy, so slugs can't change and nothing can be added by mistake. Each sits
 * on its own tab; the tab carries the title, so the group's own heading is hidden.
 */
const policyTab = (def: PolicyDefinition): Tab => ({
  label: def.title,
  admin: {
    description: `Page: /policies/${def.slug}. Until text is saved here and approved, the staging site shows built-in draft wording (marked as a draft) and the live site shows “This policy is being finalised”.`,
  },
  fields: [{ name: def.field, label: false, type: "group", admin: { hideGutter: true }, fields: policyFields(def) }],
});

function policyFields(def: PolicyDefinition): Field[] {
  return [
    {
      name: "title",
      type: "text",
      admin: { placeholder: def.title, description: `Optional. Leave blank to use “${def.title}”.` },
    },
    {
      name: "body",
      label: "Policy text",
      type: "textarea",
      admin: {
        rows: 12,
        description:
          "A blank line starts a new paragraph. While this is empty, staging shows the built-in draft. The live site shows this text only once it is approved, and until then it says the policy is being finalised.",
      },
    },
    {
      name: "approved",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "Only the owner can tick this, when the text is final. Only approved text appears on the live site; unapproved text is shown on staging with a “Draft — awaiting Lody’s approval” banner. If anyone else changes the title or text of an approved policy, the tick is cleared until the owner approves it again.",
      },
    },
    {
      name: "lastReviewed",
      label: "Last reviewed",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayOnly", displayFormat: "MMM d, yyyy" },
        description: "Optional. Shown to customers as “Last reviewed …” beneath approved text.",
      },
    },
  ];
}

/**
 * Customer policy pages (D39). The text is Lody's to write and approve; nothing here is a default.
 * The built-in draft wording lives in code (src/lib/policies.ts), is shown on staging only, and is
 * never saved into this global, so it can't drift into the database or onto the live site.
 *
 * Read is staff-only so unapproved text is not exposed through the REST/GraphQL API on the live
 * site; the storefront reads this global server-side through the Local API.
 */
export const Policies: GlobalConfig = {
  slug: "policies",
  label: "Policies",
  admin: { group: "Website", description: "The customer policy pages, one per tab. The owner or a manager writes the text; only the owner approves it, and only approved text appears on the live site." },
  access: { read: isStaff, update: isCommerceManager },
  hooks: {
    beforeChange: [guardApproval],
    afterChange: [auditGlobal(POLICIES.map((p) => p.field))],
  },
  fields: [{ type: "tabs", tabs: POLICIES.map(policyTab) }],
};
