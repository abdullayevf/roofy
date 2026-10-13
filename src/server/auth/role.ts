import type { Role } from "@/data/contracts";
import { roleEnum } from "@/server/db/schema";

/** The Roofy roles, from the one list the member_role enum is built on. */
export const ROLES: readonly Role[] = roleEnum.enumValues;

/** Narrows a role string from Better Auth or the database to one Roofy `Role`, or throws. */
export function roleFrom(value: string): Role {
  const role = ROLES.find((r) => r === value);
  if (!role) throw new Error(`Unknown role "${value}".`);
  return role;
}

/** True when `value` is exactly one Roofy role: no list, no comma, nothing unknown. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.some((r) => r === value);
}
