import { APIError, ValidationError, type CollectionBeforeChangeHook, type CollectionBeforeValidateHook, type CollectionConfig } from "payload";

import { ROLES, canManageCommerce, hasRole, isOwner, isStaff, ownerField } from "../src/access/roles";
import { isPreviewEnv } from "../src/lib/app-env";
import { sameEmail } from "../src/lib/owner-setup";
import { passwordProblem } from "../src/lib/password-policy";
import { auditCollection, auditDelete } from "../src/hooks/audit";

/**
 * The very first account becomes the owner, whatever roles were submitted. Payload's
 * create-first-user screen bypasses access control, so without this the first account would
 * get the default "fulfillment" role and nobody could administer the store.
 */
const firstUserIsOwner: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== "create") return data;
  const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true, req });
  return totalDocs === 0 ? { ...data, roles: ["owner"] } : data;
};

/**
 * With FIRST_OWNER_EMAIL set, only that address can create the very first account (audit A03).
 * Payload's create-first-user screen and `/api/users/first-register` are open until the first
 * account exists, so on a new public host a bot could otherwise register first and become the
 * owner. Read at call time, so it can be set or changed with a restart and no rebuild. Once any
 * user exists it has no effect. `scripts/create-owner.ts` is the way to create the owner without
 * opening /admin at all.
 */
const onlyExpectedFirstOwner: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== "create") return data;
  const expected = process.env.FIRST_OWNER_EMAIL?.trim();
  if (!expected) return data;
  const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true, req });
  if (totalDocs > 0) return data;
  if (!sameEmail(expected, String(data?.email ?? ""))) {
    throw new APIError("This email address is not allowed to create the first account.", 403, null, true);
  }
  return data;
};

/**
 * Staff passwords: at least 12 characters and not trivially guessable (audit A23). Runs when a
 * password is set (create, or an owner or user changing it in /admin). Payload's own check allows
 * 3 characters. Limitation: Payload's reset-password-by-email flow does not pass the new password
 * through collection hooks, so it is not covered; that flow needs an email adapter, which the
 * store does not have yet.
 */
const enforcePasswordPolicy: CollectionBeforeValidateHook = ({ data }) => {
  const password = data?.password;
  if (typeof password !== "string" || password === "") return data;
  const problem = passwordProblem(password);
  if (problem) throw new ValidationError({ collection: "users", errors: [{ message: problem, path: "password" }] });
  return data;
};

/**
 * The login cookie is HTTPS-only unless this is explicitly a local, staging or test environment,
 * or the server is not running in production mode (audit A08). A plain-http first visit can no
 * longer leak a staff session. Evaluated when the server starts.
 */
const secureCookies = process.env.NODE_ENV === "production" || !isPreviewEnv();

export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Staff account", plural: "Staff accounts" },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["name", "email", "roles"],
    group: "Staff",
    description: "Who can sign in to this admin and what each person may do. Only the owner adds accounts or changes roles.",
  },
  auth: { cookies: { secure: secureCookies } },
  access: {
    admin: isStaff,
    create: isOwner,
    delete: isOwner,
    read: ({ req }) => {
      if (canManageCommerce(req.user)) return true;
      return req.user ? { id: { equals: req.user.id } } : false;
    },
    update: ({ req }) => {
      if (hasRole(req.user, "owner")) return true;
      return req.user ? { id: { equals: req.user.id } } : false;
    },
  },
  hooks: {
    beforeValidate: [onlyExpectedFirstOwner, enforcePasswordPolicy],
    beforeChange: [firstUserIsOwner],
    afterChange: [auditCollection(["roles", "email"])],
    afterDelete: [auditDelete(["roles", "email"])],
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      saveToJWT: true,
      defaultValue: ["fulfillment"],
      options: [
        { label: "Owner (full administration)", value: "owner" },
        { label: "Manager (orders, prices, refunds)", value: "manager" },
        { label: "Fulfillment (orders and assembly only)", value: "fulfillment" },
      ] satisfies { label: string; value: (typeof ROLES)[number] }[],
      access: {
        update: ownerField,
      },
      admin: {
        description: "Only the owner can change roles. Prices and refunds are limited to owner and manager.",
      },
    },
  ],
};
