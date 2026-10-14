// Task 11 run 1: the real workspace service for settings, crew levels, expense categories and stage
// templates, against roofy_test through withActor (roofy_app, row-level security on).
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError, type Actor, type Role, type WorkspaceSettingsInput } from "@/data/contracts";
import { createWorkspaceService } from "@/server/services/workspace";
import { withActor } from "@/server/db/with-actor";
import { closePools, makeWorkspace, pool, rows } from "./helpers";

const ws = createWorkspaceService();
let a: Actor; // Owner of Alpha
let b: Actor; // Owner of Bravo
let accountant: Actor; // Alpha
let foreman: Actor; // Alpha

async function addMember(workspaceId: string, role: Role): Promise<Actor> {
  const userId = uuidv7();
  const name = `${role} ${userId.slice(-4)}`;
  await pool("owner").query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [
    userId,
    name,
    `${role}-${userId}@example.test`,
  ]);
  await pool("owner").query(`insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, $4)`, [
    uuidv7(),
    workspaceId,
    userId,
    role,
  ]);
  return { userId, workspaceId, role, name };
}

async function refusal(p: Promise<unknown>): Promise<DataError> {
  return p.then(
    () => expect.fail("expected a refusal"),
    (e: unknown) => {
      expect(e).toBeInstanceOf(DataError);
      return e as DataError;
    },
  );
}

const SETTINGS: WorkspaceSettingsInput = {
  name: "Alpha Roofing Pty Ltd",
  abn: "51 824 753 556",
  gstRegistered: true,
  timezone: "Australia/Perth",
  payFrequency: "fortnightly",
  payWeekStart: 3,
  payAnchor: "2026-10-07",
  workingDays: [1, 2, 3, 4, 5, 6],
  standardDayHours: 750,
  onCostBp: 2350,
};

const ITEMS = [
  { name: "Strip", position: 1, defaultUnit: null, labourShareBp: 4000, materialsShareBp: 0 },
  { name: "Sheet", position: 2, defaultUnit: "m2" as const, labourShareBp: 6000, materialsShareBp: 10_000 },
];

const audits = (workspaceId: string, table: string, rowId: string) =>
  rows<{ action: string; actor_user_id: string | null }>(
    "owner",
    "select action, actor_user_id from audit_event where workspace_id = $1 and table_name = $2 and row_id = $3 order by at, id",
    [workspaceId, table, rowId],
  );

beforeAll(async () => {
  a = (await makeWorkspace("Alpha Roofing")).ownerActor;
  b = (await makeWorkspace("Bravo Roofing")).ownerActor;
  accountant = await addMember(a.workspaceId, "accountant");
  foreman = await addMember(a.workspaceId, "foreman");
});

afterAll(async () => {
  await closePools();
});

describe("settings / updateSettings", () => {
  it("round-trip timezone, pay period, working days, standard hours (hundredths) and on-cost (basis points)", async () => {
    const saved = await ws.updateSettings(a, SETTINGS);
    expect(saved).toEqual({ id: a.workspaceId, ...SETTINGS });
    const view = await ws.settings(a);
    expect(view.view).toBe("manager");
    if (view.view !== "manager") return;
    expect(view.settings).toEqual({ id: a.workspaceId, ...SETTINGS });
    expect(Number.isInteger(view.settings.standardDayHours) && Number.isInteger(view.settings.onCostBp)).toBe(
      true,
    );
    expect(view.ownerTwoFactor).toBe(false);
    expect(view.access.role).toBe("owner");
    const [db] = await rows<{ standard_day_hours: string; on_cost_bp: number }>(
      "owner",
      "select standard_day_hours, on_cost_bp from workspace where id = $1",
      [a.workspaceId],
    );
    expect(db).toEqual({ standard_day_hours: "7.50", on_cost_bp: 2350 });
    expect((await audits(a.workspaceId, "workspace", a.workspaceId)).at(-1)).toEqual({
      action: "update",
      actor_user_id: a.userId,
    });
  });

  it("refuses a pay period start that isn't on the start day, and an unknown timezone", async () => {
    const e1 = await refusal(ws.updateSettings(a, { ...SETTINGS, payAnchor: "2026-10-08" }));
    expect([e1.code, e1.message]).toEqual(["invalid", "The pay period start date must be a Wednesday."]);
    const e2 = await refusal(ws.updateSettings(a, { ...SETTINGS, timezone: "Mars/Olympus" }));
    expect([e2.code, e2.message]).toEqual(["invalid", "Pick a timezone from the list."]);
    const e3 = await refusal(ws.updateSettings(a, { ...SETTINGS, standardDayHours: 7.5 }));
    expect(e3.code).toBe("invalid");
  });

  it("a foreman gets the basics only: no pay settings, no on-cost", async () => {
    const view = await ws.settings(foreman);
    expect(view).toEqual({
      view: "foreman",
      access: { role: "foreman", canLog: true, canPause: true, canMarkDone: false },
      workspace: {
        id: a.workspaceId,
        name: SETTINGS.name,
        timezone: "Australia/Perth",
        workingDays: [1, 2, 3, 4, 5, 6],
        standardDayHours: 750,
      },
    });
  });

  it("workspace B's settings and update never touch A", async () => {
    await ws.updateSettings(b, { ...SETTINGS, name: "Bravo", onCostBp: 100 });
    const view = await ws.settings(a);
    expect(view.view === "manager" && [view.settings.name, view.settings.onCostBp]).toEqual([
      SETTINGS.name,
      2350,
    ]);
  });

  it("a set-up actor (no workspace yet) never reaches withActor", async () => {
    const setup: Actor = { ...a, workspaceId: "" };
    const e = await refusal(withActor(setup, async () => "ran"));
    expect([e.code, e.message]).toEqual(["forbidden", "Set up your business first."]);
    expect((await refusal(ws.settings(setup))).code).toBe("forbidden");
  });
});

describe("levels / saveLevel", () => {
  it("adds and changes a level, audited, with crew counts", async () => {
    const added = await ws.saveLevel(a, { id: null, name: "Roofer", floorRateCents: 3200 });
    expect(added).toMatchObject({ name: "Roofer", floorRateCents: 3200, position: 1, crewCount: 0 });
    const changed = await ws.saveLevel(a, { id: added.id, name: "Roofer", floorRateCents: 3350 });
    expect(changed).toEqual({ ...added, floorRateCents: 3350 });
    const second = await ws.saveLevel(a, { id: null, name: "Leading hand", floorRateCents: 3800 });
    expect(second.position).toBe(2);
    expect((await ws.levels(a)).map((l) => [l.name, l.floorRateCents])).toEqual([
      ["Roofer", 3350],
      ["Leading hand", 3800],
    ]);
    expect(await audits(a.workspaceId, "crew_level", added.id)).toEqual([
      { action: "insert", actor_user_id: a.userId },
      { action: "update", actor_user_id: a.userId },
    ]);
  });

  it("refuses a duplicate name and an unknown id", async () => {
    const e = await refusal(ws.saveLevel(a, { id: null, name: " roofer ", floorRateCents: 3000 }));
    expect([e.code, e.message]).toEqual(["invalid", "There's already a level called  roofer ."]);
    const nf = await refusal(ws.saveLevel(a, { id: "not-a-uuid", name: "X", floorRateCents: 1 }));
    expect([nf.code, nf.message]).toEqual([
      "not_found",
      "We couldn't find this level. It may have been removed.",
    ]);
  });

  it("a foreman can't read levels (floor rates are money)", async () => {
    expect((await refusal(ws.levels(foreman))).code).toBe("forbidden");
  });
});

describe("categories / saveCategory", () => {
  it("adds, renames and lists categories in order; a foreman can read them", async () => {
    const tools = await ws.saveCategory(a, { id: null, name: "Tools", position: 2 });
    await ws.saveCategory(a, { id: null, name: "Materials", position: 1 });
    expect(await ws.saveCategory(a, { id: tools.id, name: "Tools & hire", position: 3 })).toEqual({
      id: tools.id,
      name: "Tools & hire",
      position: 3,
    });
    expect((await ws.categories(foreman)).map((c) => c.name)).toEqual(["Materials", "Tools & hire"]);
    const e = await refusal(ws.saveCategory(a, { id: null, name: "materials", position: 4 }));
    expect([e.code, e.message]).toEqual(["invalid", "There's already a category called materials."]);
  });
});

describe("templates / saveTemplate", () => {
  it("replaces a job type's stages and lists them", async () => {
    const t = await ws.saveTemplate(a, { jobType: "metal_reroof", items: ITEMS });
    expect(t).toMatchObject({ jobType: "metal_reroof", name: "Metal re-roof", items: ITEMS });
    const again = await ws.saveTemplate(a, {
      jobType: "metal_reroof",
      items: [{ ...ITEMS[0]!, labourShareBp: 10_000 }],
    });
    expect(again.id).toBe(t.id);
    expect((await ws.templates(a)).find((x) => x.id === t.id)!.items).toHaveLength(1);
  });

  it("refuses shares that don't add up", async () => {
    const e = await refusal(ws.saveTemplate(a, { jobType: "repair", items: [{ ...ITEMS[0]! }] }));
    expect([e.code, e.message]).toEqual(["invalid", "Labour shares must add up to 100%."]);
    const m = await refusal(
      ws.saveTemplate(a, {
        jobType: "repair",
        items: [{ ...ITEMS[1]!, labourShareBp: 10_000, materialsShareBp: 500 }],
      }),
    );
    expect([m.code, m.message]).toEqual(["invalid", "Materials shares must add up to 100%, or all be 0%."]);
  });
});

describe("tenant isolation and roles", () => {
  it("workspace B on A's ids rejects not_found and sees none of A's rows", async () => {
    const level = await ws.saveLevel(a, { id: null, name: "Apprentice", floorRateCents: 2000 });
    const cat = await ws.saveCategory(a, { id: null, name: "Fuel", position: 9 });
    const tpl = (await ws.templates(a))[0]!;
    for (const p of [
      ws.saveLevel(b, { id: level.id, name: "Stolen", floorRateCents: 1 }),
      ws.saveCategory(b, { id: cat.id, name: "Stolen", position: 1 }),
    ]) {
      expect((await refusal(p)).code).toBe("not_found");
    }
    await ws.saveTemplate(b, { jobType: "metal_reroof", items: [{ ...ITEMS[0]!, labourShareBp: 10_000 }] });
    const ids = new Set([level.id, cat.id, tpl.id, a.workspaceId]);
    const seen = [...(await ws.levels(b)), ...(await ws.categories(b)), ...(await ws.templates(b))].map(
      (x) => x.id,
    );
    expect(seen.filter((id) => ids.has(id))).toEqual([]);
    expect((await ws.templates(a)).find((x) => x.id === tpl.id)).toEqual(tpl);
    const [row] = await rows<{ name: string }>("owner", "select name from crew_level where id = $1", [
      level.id,
    ]);
    expect(row!.name).toBe("Apprentice");
  });

  it("accountant writes reject forbidden; accountant reads work", async () => {
    const level = (await ws.levels(accountant))[0]!;
    const writes = [
      ws.updateSettings(accountant, SETTINGS),
      ws.saveLevel(accountant, { id: level.id, name: "X", floorRateCents: 1 }),
      ws.saveCategory(accountant, { id: null, name: "X", position: 1 }),
      ws.saveTemplate(accountant, { jobType: "repair", items: [{ ...ITEMS[0]!, labourShareBp: 10_000 }] }),
    ];
    for (const p of writes) {
      const e = await refusal(p);
      expect([e.code, e.message]).toEqual(["forbidden", "You don't have access to this."]);
    }
    expect((await ws.templates(accountant)).length).toBeGreaterThan(0);
    expect((await ws.settings(accountant)).view).toBe("manager");
  });

  it("foreman writes reject forbidden", async () => {
    for (const p of [
      ws.updateSettings(foreman, SETTINGS),
      ws.saveLevel(foreman, { id: null, name: "X", floorRateCents: 1 }),
      ws.saveCategory(foreman, { id: null, name: "X", position: 1 }),
      ws.saveTemplate(foreman, { jobType: "repair", items: [{ ...ITEMS[0]!, labourShareBp: 10_000 }] }),
      ws.templates(foreman),
    ]) {
      expect((await refusal(p)).code).toBe("forbidden");
    }
  });
});
