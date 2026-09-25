/**
 * Staff roles (PRD OPS 01).
 *
 * - owner: Lody. Full administration, including staff accounts.
 * - manager: Faisal. Orders, approved business changes, prices and refunds.
 * - fulfillment: other staff. Orders and assembly only; never prices, refunds or settings.
 */
import type { Access, FieldAccess, PayloadRequest } from "payload";

export const ROLES = ["owner", "manager", "fulfillment"] as const;
export type Role = (typeof ROLES)[number];

type MaybeUser = { roles?: Role[] | null } | null | undefined;

export function hasRole(user: MaybeUser, ...roles: Role[]): boolean {
  return Boolean(user?.roles?.some((r) => roles.includes(r)));
}

/** Price changes and refunds: Lody and Faisal only. */
export function canManageCommerce(user: MaybeUser): boolean {
  return hasRole(user, "owner", "manager");
}

export const isOwner: Access = ({ req }) => hasRole(req.user as MaybeUser, "owner");
// Boolean-only so it also satisfies `access.admin`, which cannot return a query.
export const isStaff = ({ req }: { req: PayloadRequest }): boolean => hasRole(req.user as MaybeUser, ...ROLES);
export const isCommerceManager: Access = ({ req }) => canManageCommerce(req.user as MaybeUser);
export const commerceField: FieldAccess = ({ req }) => canManageCommerce(req.user as MaybeUser);
export const ownerField: FieldAccess = ({ req }) => hasRole(req.user as MaybeUser, "owner");
export const nobody: Access = () => false;
export const anyone: Access = () => true;
