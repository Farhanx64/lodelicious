import type { Field, GlobalConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";
import { POLICIES, type PolicyDefinition } from "../src/lib/policies";

/** One fixed group per policy, so slugs can't change and nothing can be added by mistake. */
const policyGroup = (def: PolicyDefinition): Field => ({
  name: def.field,
  label: def.title,
  type: "group",
  admin: {
    description: `Page: /policies/${def.slug}. Until text is saved here and Approved is ticked, the staging site shows built-in draft wording (marked as a draft) and the live site shows “This policy is being finalised”.`,
  },
  fields: [
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
          "A blank line starts a new paragraph. While this is empty, staging shows the built-in draft. The live site shows this text only after you tick Approved, and until then it says the policy is being finalised.",
      },
    },
    {
      name: "approved",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "Tick when this text is final. Only approved text appears on the live site; unapproved text is shown on staging with a “Draft — awaiting Lody’s approval” banner.",
      },
      validate: (value: boolean | null | undefined, { siblingData }: { siblingData?: unknown }) => {
        const body = (siblingData as { body?: string | null } | undefined)?.body;
        return value && !body?.trim() ? "Write the policy text before approving it." : true;
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
  ],
});

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
  admin: { group: "Settings" },
  access: { read: isStaff, update: isCommerceManager },
  hooks: { afterChange: [auditGlobal(POLICIES.map((p) => p.field))] },
  fields: POLICIES.map(policyGroup),
};
