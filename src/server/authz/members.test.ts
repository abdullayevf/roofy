import { describe, expect, it } from "vitest";
import { DataError, type Role } from "@/data/contracts";
import type { ActorWith2fa } from "./matrix";
import { ALREADY_IN_TEAM, ALREADY_INVITED, NEEDS_AN_OWNER, assertInvite, assertKeepsAnOwner, assertRemoval, assertRoleChange } from "./members";

const as = (role: Role, twoFactorEnabled = false): ActorWith2fa => ({ userId: "u", workspaceId: "w", role, name: "n", twoFactorEnabled });
const none = { alreadyMember: false, alreadyInvited: false };
const code = (fn: () => void): string => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    return `${(e as DataError).code}: ${(e as DataError).message}`;
  }
  return "ok";
};

describe("member rules", () => {
  it("lets only the Owner invite non-owners; manager, foreman and accountant are forbidden", () => {
    expect(code(() => assertInvite(as("owner"), "foreman", none))).toBe("ok");
    expect(code(() => assertInvite(as("manager"), "accountant", none))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertInvite(as("foreman"), "foreman", none))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertInvite(as("accountant"), "manager", none))).toBe("forbidden: You don't have access to this.");
  });
  it("treats inviting as Owner as an Owner change: manager never, owner only with 2FA", () => {
    expect(code(() => assertInvite(as("manager", true), "owner", none))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertInvite(as("owner"), "owner", none))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertInvite(as("owner", true), "owner", none))).toBe("ok");
  });
  it("refuses an email already in the team, then one already invited", () => {
    expect(code(() => assertInvite(as("owner"), "foreman", { alreadyMember: true, alreadyInvited: true }))).toBe(`conflict: ${ALREADY_IN_TEAM}`);
    expect(code(() => assertInvite(as("owner"), "foreman", { alreadyMember: false, alreadyInvited: true }))).toBe(`conflict: ${ALREADY_INVITED}`);
  });
  it("forbids a Manager every role change, to or from Owner or not", () => {
    expect(code(() => assertRoleChange(as("manager", true), "owner", "manager"))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertRoleChange(as("manager", true), "foreman", "owner"))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertRoleChange(as("manager"), "foreman", "accountant"))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertRoleChange(as("owner"), "foreman", "accountant"))).toBe("ok");
    expect(code(() => assertRoleChange(as("owner", true), "owner", "manager"))).toBe("ok");
  });
  it("refuses demoting the last Owner only", () => {
    expect(code(() => assertKeepsAnOwner("owner", "manager", 1))).toBe(`conflict: ${NEEDS_AN_OWNER}`);
    expect(code(() => assertKeepsAnOwner("owner", "manager", 2))).toBe("ok");
    expect(code(() => assertKeepsAnOwner("foreman", "manager", 1))).toBe("ok");
    expect(code(() => assertKeepsAnOwner("owner", "owner", 1))).toBe("ok");
  });
  it("lets only the Owner remove non-owners; an owner needs the Owner with two-factor; manager, accountant and foreman never", () => {
    expect(code(() => assertRemoval(as("owner"), "foreman"))).toBe("ok");
    expect(code(() => assertRemoval(as("manager"), "accountant"))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertRemoval(as("manager", true), "owner"))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertRemoval(as("owner"), "owner"))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertRemoval(as("owner", true), "owner"))).toBe("ok");
    expect(code(() => assertRemoval(as("accountant"), "foreman"))).toBe("forbidden: You don't have access to this.");
    expect(code(() => assertRemoval(as("foreman"), "foreman"))).toBe("forbidden: You don't have access to this.");
  });
});
