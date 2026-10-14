/**
 * Member rules shared by the workspace service and the Better Auth organization hooks (Task 11,
 * carry note T8), so `/api/auth/organization/*` called directly is held to the same rules. Pure:
 * callers look up the facts (roles, owner count, whether the email is taken) and pass them in.
 */
import { DataError, type Role } from "@/data/contracts";
import { assertCan, memberActionFor, type ActorWith2fa } from "./matrix";

export const ALREADY_IN_TEAM = "This person is already in your team.";
export const ALREADY_INVITED = "This person has already been invited.";
export const NEEDS_AN_OWNER = "Your business needs at least one owner.";

/** Inviting as Owner is an Owner change (`member.changeOwner`); any other role is `member.invite`. */
export function assertInvite(
  actor: ActorWith2fa,
  role: Role,
  facts: { alreadyMember: boolean; alreadyInvited: boolean },
): void {
  assertCan(actor, role === "owner" ? "member.changeOwner" : "member.invite");
  if (facts.alreadyMember) throw new DataError("conflict", ALREADY_IN_TEAM);
  if (facts.alreadyInvited) throw new DataError("conflict", ALREADY_INVITED);
}

/** The matrix check for a role change, without the last-owner rule (see `assertKeepsAnOwner`). */
export function assertRoleChange(actor: ActorWith2fa, currentRole: Role, nextRole: Role): void {
  assertCan(actor, memberActionFor(currentRole, nextRole));
}

/** Refuses taking the Owner role away from the workspace's only Owner. */
export function assertKeepsAnOwner(currentRole: string, nextRole: string, ownerCount: number): void {
  if (currentRole === "owner" && nextRole !== "owner" && ownerCount <= 1) {
    throw new DataError("conflict", NEEDS_AN_OWNER);
  }
}
