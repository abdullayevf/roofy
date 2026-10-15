import { describe, expect, it } from "vitest";
import { DataError, type Actor, type Role } from "@/data/contracts";
import { ROLES as SESSION_ROLES } from "@/data/session";
import { ROLES } from "@/server/auth/role";
import { ACTIONS, assertCan, can, memberActionFor, type Action, type ActorWith2fa } from "./matrix";

const actor = (role: Role, twoFactorEnabled = true): ActorWith2fa => ({
  userId: `u-${role}`,
  workspaceId: "w-1",
  role,
  name: role,
  twoFactorEnabled,
});

const ASSIGNED = { projectId: "p-1", assignedProjectIds: ["p-1", "p-2"] } as const;

type Cell = "allow" | "assigned" | "twoFactor" | "deny";

/**
 * The expected matrix, written independently of `matrix.ts` (product spec §3 + plan Task 9 rows).
 * `allow` = always; `assigned` = only on an assigned project; `twoFactor` = only with 2FA on.
 * Owner and manager hold almost every power, so their rows are spelled out per action: adding an
 * Action fails typecheck here until someone decides it for both. Foreman and accountant are
 * allowlists (anything not listed is denied).
 */
const OWNER: Record<Action, Cell> = {
  "workspace.read": "allow",
  "workspace.edit": "allow",
  "workspace.delete": "twoFactor",
  "workspace.billing": "allow",
  "member.read": "allow",
  "member.invite": "allow",
  "member.setRole": "allow",
  "member.remove": "allow",
  "member.changeOwner": "twoFactor",
  "assignment.edit": "allow",
  "project.read": "allow",
  "project.edit": "allow",
  "stage.edit": "allow",
  "stage.markDone": "allow",
  "stage.pauseResume": "allow",
  "crew.read": "allow",
  "crew.edit": "allow",
  "rate.read": "allow",
  "rate.edit": "allow",
  "log.write": "allow",
  "progress.write": "allow",
  "expense.write": "allow",
  "expense.readAll": "allow",
  "payRun.read": "allow",
  "payRun.edit": "allow",
  "payRun.approve": "twoFactor",
  "payRun.export": "allow",
  "payout.read": "allow",
  "payout.edit": "allow",
  "report.read": "allow",
  "export.run": "allow",
  "money.read": "allow",
  "twoFactor.manage": "allow",
};

const MANAGER: Record<Action, Cell> = {
  "workspace.read": "allow",
  "workspace.edit": "allow",
  "workspace.delete": "deny",
  "workspace.billing": "deny",
  "member.read": "allow",
  "member.invite": "deny",
  "member.setRole": "deny",
  "member.remove": "deny",
  "member.changeOwner": "deny",
  "assignment.edit": "allow",
  "project.read": "allow",
  "project.edit": "allow",
  "stage.edit": "allow",
  "stage.markDone": "allow",
  "stage.pauseResume": "allow",
  "crew.read": "allow",
  "crew.edit": "allow",
  "rate.read": "allow",
  "rate.edit": "allow",
  "log.write": "allow",
  "progress.write": "allow",
  "expense.write": "allow",
  "expense.readAll": "allow",
  "payRun.read": "allow",
  "payRun.edit": "allow",
  "payRun.approve": "allow",
  "payRun.export": "allow",
  "payout.read": "allow",
  "payout.edit": "allow",
  "report.read": "allow",
  "export.run": "allow",
  "money.read": "allow",
  "twoFactor.manage": "allow",
};

const EXPECTED: Record<"foreman" | "accountant", { allow: Action[]; assigned?: Action[] }> = {
  foreman: {
    allow: ["workspace.read", "crew.read", "twoFactor.manage"],
    assigned: ["project.read", "stage.pauseResume", "log.write", "progress.write", "expense.write"],
  },
  accountant: {
    allow: [
      "workspace.read",
      "project.read",
      "crew.read",
      "expense.readAll",
      "payRun.read",
      "payRun.export",
      "payout.read",
      "report.read",
      "export.run",
      "money.read",
      "twoFactor.manage",
    ],
  },
};

const cellOf = (role: Role, action: Action): Cell => {
  if (role === "owner") return OWNER[action];
  if (role === "manager") return MANAGER[action];
  const e = EXPECTED[role];
  if (e.allow.includes(action)) return "allow";
  if (e.assigned?.includes(action)) return "assigned";
  return "deny";
};

const ROWS = ROLES.flatMap((role) => ACTIONS.map((action) => ({ role, action, cell: cellOf(role, action) })));

describe("permission matrix — every role × every action", () => {
  it("has the plan's action list, exactly", () => {
    const plan = [
      ...["read", "edit", "delete", "billing"].map((x) => `workspace.${x}`),
      ...["read", "invite", "setRole", "remove", "changeOwner"].map((x) => `member.${x}`),
      "assignment.edit",
      "project.read",
      "project.edit",
      "stage.edit",
      "stage.markDone",
      "stage.pauseResume",
      "crew.read",
      "crew.edit",
      "rate.read",
      "rate.edit",
      "log.write",
      "progress.write",
      "expense.write",
      "expense.readAll",
      ...["read", "edit", "approve", "export"].map((x) => `payRun.${x}`),
      "payout.read",
      "payout.edit",
      "report.read",
      "export.run",
      "money.read",
      "twoFactor.manage",
    ];
    expect([...ACTIONS].sort()).toEqual(plan.sort());
    expect(new Set(ACTIONS).size).toBe(ACTIONS.length);
  });

  it("has one row per Action × Role, built from the runtime lists", () => {
    expect(ROWS.map((r) => `${r.role}:${r.action}`).sort()).toEqual(
      ROLES.flatMap((role) => ACTIONS.map((a) => `${role}:${a}`)).sort(),
    );
    for (const table of [OWNER, MANAGER]) {
      expect(Object.keys(table).sort()).toEqual([...ACTIONS].sort());
    }
    for (const role of ["foreman", "accountant"] as const) {
      const e = EXPECTED[role];
      const listed = [...e.allow, ...(e.assigned ?? [])];
      expect(new Set(listed).size, `${role} lists an action twice`).toBe(listed.length);
      expect(listed.every((a) => (ACTIONS as readonly string[]).includes(a))).toBe(true);
    }
  });

  it("src/data/session ROLES equals the server role list exactly", () => {
    expect([...SESSION_ROLES]).toEqual([...ROLES]);
  });

  it.each(ROWS)("$role $action → $cell", ({ role, action, cell }) => {
    const off = actor(role, false);
    const on = actor(role, true);
    switch (cell) {
      case "allow":
        expect(can(on, action)).toBe(true);
        expect(can(off, action, ASSIGNED)).toBe(true);
        break;
      case "deny":
        expect(can(on, action)).toBe(false);
        expect(can(on, action, ASSIGNED)).toBe(false);
        break;
      case "assigned":
        expect(can(on, action, ASSIGNED)).toBe(true);
        expect(can(on, action)).toBe(false);
        break;
      case "twoFactor":
        expect(can(on, action)).toBe(true);
        expect(can(off, action)).toBe(false);
        expect(can(off, action, ASSIGNED)).toBe(false);
        break;
    }
  });
});

describe("permission matrix — named rows", () => {
  it.each([
    "workspace.billing",
    "workspace.delete",
    "member.changeOwner",
    "member.invite",
    "member.setRole",
    "member.remove",
  ] as const)(
    "manager is denied %s (managing members is the Owner's, product spec §3)",
    (a) => {
      expect(can(actor("manager"), a)).toBe(false);
    },
  );

  it.each(["stage.markDone", "money.read", "rate.read", "payRun.read"] as const)(
    "foreman is denied %s",
    (a) => {
      expect(can(actor("foreman"), a, ASSIGNED)).toBe(false);
    },
  );

  it.each(["log.write", "progress.write"] as const)(
    "foreman %s is allowed only on an assigned project",
    (a) => {
      const f = actor("foreman");
      expect(can(f, a, ASSIGNED)).toBe(true);
      expect(can(f, a, { projectId: "p-2", assignedProjectIds: ["p-1", "p-2"] })).toBe(true);
      expect(can(f, a, { projectId: "p-9", assignedProjectIds: ["p-1", "p-2"] })).toBe(false);
      expect(can(f, a)).toBe(false);
      expect(can(f, a, {})).toBe(false);
      expect(can(f, a, { assignedProjectIds: ["p-1"] })).toBe(false);
      expect(can(f, a, { projectId: "p-1" })).toBe(false);
      expect(can(f, a, { projectId: "p-1", assignedProjectIds: [] })).toBe(false);
      expect(can(f, a, { projectId: "", assignedProjectIds: [""] })).toBe(false);
    },
  );

  it.each(["payRun.read", "payRun.export", "payout.read", "report.read", "export.run"] as const)(
    "accountant is allowed %s",
    (a) => {
      expect(can(actor("accountant"), a)).toBe(true);
    },
  );

  it.each(ACTIONS.filter((a) => /\.(edit|write)$/.test(a)))("accountant is denied %s", (a) => {
    expect(can(actor("accountant"), a, ASSIGNED)).toBe(false);
  });

  it("owner without 2FA is denied payRun.approve; owner with 2FA is allowed", () => {
    expect(can(actor("owner", false), "payRun.approve")).toBe(false);
    expect(can(actor("owner", true), "payRun.approve")).toBe(true);
  });

  it.each([undefined, null])("owner with twoFactorEnabled %s is denied payRun.approve", (flag) => {
    const o = { ...actor("owner"), twoFactorEnabled: flag as unknown as boolean };
    expect(can(o, "payRun.approve")).toBe(false);
    expect(can(o, "workspace.delete")).toBe(false);
    expect(can(o, "member.changeOwner")).toBe(false);
    expect(() => assertCan(o, "payRun.approve")).toThrow(DataError);
  });

  it("a truthy non-boolean twoFactorEnabled is denied payRun.approve", () => {
    expect(can({ ...actor("owner"), twoFactorEnabled: "yes" as unknown as boolean }, "payRun.approve")).toBe(false);
  });

  it("manager may read the members list but not change it", () => {
    const m = actor("manager");
    expect(can(m, "member.read")).toBe(true);
    for (const a of ["member.invite", "member.setRole", "member.remove", "member.changeOwner"] as const) {
      expect(can(m, a)).toBe(false);
    }
  });

  it("manager payRun.approve is allowed (with or without 2FA)", () => {
    expect(can(actor("manager", false), "payRun.approve")).toBe(true);
    expect(can(actor("manager", true), "payRun.approve")).toBe(true);
  });

  it("owner without 2FA can still set up 2FA, invite and edit (sign-up works without 2FA)", () => {
    const o = actor("owner", false);
    for (const a of ["twoFactor.manage", "member.invite", "workspace.edit", "workspace.billing"] as const) {
      expect(can(o, a)).toBe(true);
    }
  });

  it("an unknown role is denied everything", () => {
    const ghost = { ...actor("owner"), role: "admin" as Role };
    expect(ACTIONS.filter((a) => can(ghost, a, ASSIGNED))).toEqual([]);
  });

  it("an unknown action is denied", () => {
    expect(can(actor("owner"), "workspace.everything" as Action)).toBe(false);
  });
});

describe("assertCan", () => {
  it("returns quietly when allowed", () => {
    expect(() => assertCan(actor("foreman"), "log.write", ASSIGNED)).not.toThrow();
  });

  it("throws DataError forbidden with the plain message when denied", () => {
    let caught: unknown;
    try {
      assertCan(actor("foreman"), "log.write", { projectId: "p-9", assignedProjectIds: ["p-1"] });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DataError);
    expect((caught as DataError).code).toBe("forbidden");
    expect((caught as DataError).message).toBe("You don't have access to this.");
  });

  it("accepts a plain Actor plus twoFactorEnabled (what a Better Auth hook has)", () => {
    const a: Actor = { userId: "u", workspaceId: "w", role: "owner", name: "O" };
    expect(() => assertCan({ ...a, twoFactorEnabled: false }, "payRun.approve")).toThrow(DataError);
    expect(() => assertCan({ ...a, twoFactorEnabled: true }, "payRun.approve")).not.toThrow();
  });
});

describe("memberActionFor", () => {
  const others = ROLES.filter((r) => r !== "owner");

  it.each(others)("owner -> %s is member.changeOwner", (next) => {
    expect(memberActionFor("owner", next)).toBe("member.changeOwner");
  });

  it.each(others)("%s -> owner is member.changeOwner", (current) => {
    expect(memberActionFor(current, "owner")).toBe("member.changeOwner");
  });

  it("owner -> owner is member.changeOwner", () => {
    expect(memberActionFor("owner", "owner")).toBe("member.changeOwner");
  });

  it.each(others.flatMap((a) => others.map((b) => [a, b] as const)))(
    "%s -> %s is member.setRole",
    (current, next) => {
      expect(memberActionFor(current, next)).toBe("member.setRole");
    },
  );

  it("removing an owner is member.changeOwner; removing anyone else is member.remove", () => {
    expect(memberActionFor("owner", null)).toBe("member.changeOwner");
    for (const r of others) expect(memberActionFor(r, null)).toBe("member.remove");
  });

  it("a manager can never change or remove anyone, the owner or not", () => {
    const m = actor("manager");
    expect(can(m, memberActionFor("owner", "manager"))).toBe(false);
    expect(can(m, memberActionFor("foreman", "owner"))).toBe(false);
    expect(can(m, memberActionFor("owner", null))).toBe(false);
    expect(can(m, memberActionFor("foreman", "accountant"))).toBe(false);
    expect(can(m, memberActionFor("foreman", null))).toBe(false);
    expect(can(actor("owner"), memberActionFor("foreman", "accountant"))).toBe(true);
  });
});
