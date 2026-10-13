import { describe, expect, it } from "vitest";
import type {
  Access,
  FieldAccess,
  Member,
  ProjectRowForeman,
  ProjectRowManager,
  Role,
} from "@/data/contracts";
import { expectNoMoney, scanForMoney } from "@/data/dto";
import { ROLES } from "@/server/auth/role";
import { ACTIONS, can, type ActorWith2fa } from "./matrix";
import {
  ACCESS_FLAGS,
  MEMBER_SUMMARY_KEYS,
  PROJECT_ROW_FOREMAN_KEYS,
  shapeAccess,
  shapeMember,
  shapeProjectRow,
} from "./shape";

const actor = (role: Role, twoFactorEnabled = true): ActorWith2fa => ({
  userId: `u-${role}`,
  workspaceId: "w-1",
  role,
  name: role,
  twoFactorEnabled,
});

/** Every generic money key plus the money fields a joined row could bring along. */
const MONEY_EXTRAS = {
  rate: 4500,
  rateCents: 4500,
  amount: 100,
  amountCents: 100,
  budget: 1,
  budgetCents: 1,
  margin: 2,
  marginCents: 2,
  balance: 3,
  balanceCents: 3,
  earnedCents: 4,
  totalCents: 5,
  payRunId: "pr-1",
  costCents: 6,
  gstCents: 7,
};

const MEMBER = {
  id: "m-1",
  userId: "u-9",
  name: "Dana",
  email: "dana@example.com",
  role: "foreman",
  twoFactorEnabled: false,
  projectIds: ["p-1"],
  ...MONEY_EXTRAS,
} as Member;

const PROJECT: ProjectRowManager = Object.assign(
  {
    id: "p-1",
    name: "Smith reroof",
    client: { id: "c-1", name: "Smith" },
    siteAddress: "1 Main St",
    jobType: "metal_reroof",
    status: "active",
    pctBp: 4200,
    currentStages: [{ stageId: "s-1", name: "Strip", status: "active", pauseReason: null }],
    daysSinceLastLog: 1,
    contractCents: 2_000_000,
    labourActualCents: 500_000,
    labourBudgetCents: 600_000,
    forecastMarginCents: 300_000,
    alert: { level: "over", severity: "over", byCents: 100 },
    alertStageName: "Strip",
    over: { kind: "labour", byCents: 100 },
  } as ProjectRowManager,
  MONEY_EXTRAS,
);

describe("shapeMember", () => {
  it("fixture really carries money (guards the tests below)", () => {
    expect(scanForMoney(MEMBER).length).toBeGreaterThanOrEqual(Object.keys(MONEY_EXTRAS).length);
  });

  it.each(["foreman", "accountant"] as const)(
    "%s gets a summary with no money and no contact details",
    (role) => {
      const out = shapeMember(actor(role), MEMBER);
      expectNoMoney(out, `shapeMember(${role})`);
      expect(Object.keys(out).sort()).toEqual([...MEMBER_SUMMARY_KEYS].sort());
      expect(out).toEqual({ id: "m-1", name: "Dana", role: "foreman" });
    },
  );

  it.each(["owner", "manager"] as const)("%s gets the whole member (shaper is role-dependent)", (role) => {
    const out = shapeMember(actor(role), MEMBER);
    expect(out).toEqual(MEMBER);
    expect(() => expectNoMoney(out, "x")).toThrow(/leaks money: .*rate/);
  });

  it("follows member.read for every role", () => {
    for (const role of ROLES) {
      const a = actor(role);
      const full = Object.keys(shapeMember(a, MEMBER)).length === Object.keys(MEMBER).length;
      expect(full, role).toBe(can(a, "member.read"));
    }
  });
});

describe("shapeProjectRow", () => {
  it("foreman row has exactly the ProjectRowForeman keys and passes expectNoMoney", () => {
    const out = shapeProjectRow(actor("foreman"), PROJECT);
    expectNoMoney(out, "shapeProjectRow(foreman)");
    expect(Object.keys(out).sort()).toEqual(Object.keys(PROJECT_ROW_FOREMAN_KEYS).sort());
    const expected: ProjectRowForeman = {
      id: "p-1",
      name: "Smith reroof",
      client: { id: "c-1", name: "Smith" },
      siteAddress: "1 Main St",
      jobType: "metal_reroof",
      status: "active",
      pctBp: 4200,
      currentStages: [{ stageId: "s-1", name: "Strip", status: "active", pauseReason: null }],
      daysSinceLastLog: 1,
    };
    expect(out).toEqual(expected);
  });

  it.each(["owner", "manager", "accountant"] as const)("%s keeps every money field", (role) => {
    const out = shapeProjectRow(actor(role), PROJECT);
    expect(out).toEqual(PROJECT);
    expect(scanForMoney(out)).toEqual(scanForMoney(PROJECT));
  });

  it("follows money.read for every role", () => {
    for (const role of ROLES) {
      const a = actor(role);
      expect(scanForMoney(shapeProjectRow(a, PROJECT)).length > 0, role).toBe(can(a, "money.read"));
    }
  });
});

describe("shapeAccess", () => {
  const FLAG_KEYS = [
    "canEdit",
    "canApprove",
    "canExport",
    "canAdminister",
  ] as const satisfies readonly Exclude<keyof Access, "role">[];

  it("ACCESS_FLAGS names every Access flag, exactly, with real actions", () => {
    expect(Object.keys(ACCESS_FLAGS).sort()).toEqual([...FLAG_KEYS].sort());
    for (const actions of Object.values(ACCESS_FLAGS)) {
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every((a) => ACTIONS.includes(a))).toBe(true);
    }
  });

  const cases = ROLES.filter((r) => r !== "foreman").flatMap((role) =>
    [true, false].map((twoFactorEnabled) => ({ role, twoFactorEnabled })),
  );

  it.each(cases)(
    "$role (2FA $twoFactorEnabled): every flag equals can() over its actions",
    ({ role, twoFactorEnabled }) => {
      const a = actor(role, twoFactorEnabled);
      const out = shapeAccess(a) as Access;
      expect(out.role).toBe(role);
      for (const flag of FLAG_KEYS) {
        expect(out[flag], flag).toBe(ACCESS_FLAGS[flag].every((x) => can(a, x)));
      }
    },
  );

  it("matches the contract's per-role expectations", () => {
    expect(shapeAccess(actor("owner", true))).toEqual({
      role: "owner",
      canEdit: true,
      canApprove: true,
      canExport: true,
      canAdminister: true,
    });
    expect(shapeAccess(actor("owner", false))).toMatchObject({
      canEdit: true,
      canApprove: false,
      canAdminister: true,
    });
    expect(shapeAccess(actor("manager", false))).toEqual({
      role: "manager",
      canEdit: true,
      canApprove: true,
      canExport: true,
      canAdminister: false,
    });
    expect(shapeAccess(actor("accountant"))).toEqual({
      role: "accountant",
      canEdit: false,
      canApprove: false,
      canExport: true,
      canAdminister: false,
    });
  });

  it("foreman gets FieldAccess scoped to the project, never Done", () => {
    const f = actor("foreman");
    const on: FieldAccess = { role: "foreman", canLog: true, canPause: true, canMarkDone: false };
    expect(shapeAccess(f, { projectId: "p-1", assignedProjectIds: ["p-1"] })).toEqual(on);
    expect(shapeAccess(f, { projectId: "p-2", assignedProjectIds: ["p-1"] })).toEqual({
      ...on,
      canLog: false,
      canPause: false,
    });
    expect(shapeAccess(f)).toEqual({ ...on, canLog: false, canPause: false });
  });
});
