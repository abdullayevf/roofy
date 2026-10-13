import type { Role } from "@/data/contracts";

const ROLES: readonly Role[] = ["owner", "manager", "foreman", "accountant"];

/** Narrows a role string from Better Auth or the database to one Roofy `Role`, or throws. */
export function roleFrom(value: string): Role {
  const role = ROLES.find((r) => r === value);
  if (!role) throw new Error(`Unknown role "${value}".`);
  return role;
}
