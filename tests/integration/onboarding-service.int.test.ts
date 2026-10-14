// Task 12 run 1: the real set-up wizard against roofy_test (plan 04-db-auth.md lines 447-452).
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError, ONBOARDING_STEPS, type Actor, type OnboardingService } from "@/data/contracts";
import { expectNoMoney } from "@/data/dto";
import { todayIn } from "@/domain/dates";
import {
  ABN_DIGITS,
  NAME_BUSINESS,
  NAME_CREW,
  RATE_MISSING,
  RATE_MISSING_DAILY,
} from "@/lib/onboarding-input";
import { ROOFING_DEFAULTS } from "@/lib/roofing-defaults";
import { ONBOARDING_SCAN } from "@/server/services/foreman-scan";
import { createDbOnboarding } from "@/server/services/onboarding";
import { closePools, pool, rows } from "./helpers";

/** 23:30 UTC on Wednesday the 14th is already Thursday the 15th in Sydney; its pay week (Monday start) began the 12th. */
const NOW = new Date("2026-10-14T23:30:00Z");
const now = () => NOW;
const TODAY = todayIn("Australia/Sydney", NOW);
const BUSINESS = { name: "Lee Roofing", abn: "51 824 753 556", gstRegistered: true };
const MOVED_ON = "Set-up has moved on since this page opened. Reload to carry on.";

async function newUser(name: string): Promise<{ userId: string; sessionId: string }> {
  const userId = uuidv7();
  const sessionId = uuidv7();
  await pool("owner").query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [
    userId,
    name,
    `${userId}@example.test`,
  ]);
  await pool("owner").query(
    `insert into session (id, user_id, token, expires_at) values ($1, $2, $3, now() + interval '1 day')`,
    [sessionId, userId, `tok-${sessionId}`],
  );
  return { userId, sessionId };
}

const setUpActor = (userId: string): Actor => ({ userId, workspaceId: "", role: "owner", name: "" });

async function refusal(p: Promise<unknown>): Promise<DataError> {
  const e = await p.then(
    () => expect.fail("expected a refusal"),
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(DataError);
  return e as DataError;
}

/** A new user's workspace, walked to `step` through the real service. */
async function walkTo(
  step: (typeof ONBOARDING_STEPS)[number] | "done",
  name = "Walker",
): Promise<{ actor: Actor; o: OnboardingService }> {
  const { userId } = await newUser(name);
  const first = createDbOnboarding({ userId }, now);
  await first.saveBusiness(setUpActor(userId), BUSINESS);
  const [m] = await rows<{ workspace_id: string }>(
    "owner",
    "select workspace_id from member where user_id = $1",
    [userId],
  );
  const actor: Actor = { userId, workspaceId: m!.workspace_id, role: "owner", name };
  const o = createDbOnboarding(actor, now);
  const order = ["trade", "defaults", "crew", "install", "done"] as const;
  const moves = {
    trade: () => o.chooseTrade(actor, "roofing"),
    defaults: () => o.acceptDefaults(actor),
    crew: () => o.finishCrew(actor),
    install: () => o.finish(actor),
  };
  for (const s of order) {
    if (s === step) break;
    await moves[s as keyof typeof moves]();
  }
  return { actor, o };
}

beforeAll(() => undefined);
afterAll(closePools);

describe("db onboarding: saveBusiness for a user with no workspace", () => {
  it("creates the workspace with the user as Owner, sets it active, stores name/ABN/GST, Sydney time and the pay anchor", async () => {
    const { userId, sessionId } = await newUser("Ann Lee");
    const o = createDbOnboarding({ userId }, now);
    const before = await o.state(setUpActor(userId));
    expect(before.step).toBe("business");
    expect(before.business).toEqual({ name: "", abn: "", gstRegistered: false });
    const after = await o.saveBusiness(setUpActor(userId), BUSINESS);
    expect(after.step).toBe("trade");
    expect(after.business).toEqual({ name: "Lee Roofing", abn: "51824753556", gstRegistered: true });
    const [m] = await rows<{ workspace_id: string; role: string }>(
      "owner",
      "select workspace_id, role from member where user_id = $1",
      [userId],
    );
    expect(m!.role).toBe("owner");
    const [w] = await rows<Record<string, unknown>>(
      "owner",
      "select name, abn, gst_registered, timezone, onboarding_step, pay_anchor::text as pay_anchor from workspace where id = $1",
      [m!.workspace_id],
    );
    expect(w).toEqual({
      name: "Lee Roofing",
      abn: "51824753556",
      gst_registered: true,
      timezone: "Australia/Sydney",
      onboarding_step: "trade",
      pay_anchor: "2026-10-12",
    });
    const [s] = await rows<{ active_workspace_id: string }>(
      "owner",
      "select active_workspace_id from session where id = $1",
      [sessionId],
    );
    expect(s!.active_workspace_id).toBe(m!.workspace_id);
    const audit = await rows<{ actor_user_id: string | null }>(
      "owner",
      "select actor_user_id from audit_event where table_name = 'workspace' and row_id = $1 and action = 'insert'",
      [m!.workspace_id],
    );
    expect(audit.map((a) => a.actor_user_id)).toEqual([userId]);
  });

  it("a second save from the same set-up service (double submit) is refused and makes no second workspace", async () => {
    const { userId } = await newUser("Twice");
    const o = createDbOnboarding({ userId }, now);
    await o.saveBusiness(setUpActor(userId), BUSINESS);
    const again = createDbOnboarding({ userId }, now);
    const e = await refusal(again.saveBusiness(setUpActor(userId), BUSINESS));
    expect([e.code, e.message]).toEqual(["conflict", MOVED_ON]);
    expect(await rows("owner", "select 1 from member where user_id = $1", [userId])).toHaveLength(1);
  });

  it("refuses a blank name and a bad ABN field by field with the fake's words, and creates nothing", async () => {
    const { userId } = await newUser("Bad Input");
    const e = await refusal(
      createDbOnboarding({ userId }, now).saveBusiness(setUpActor(userId), {
        name: " ",
        abn: "123",
        gstRegistered: false,
      }),
    );
    expect([e.code, e.message, e.issues]).toEqual([
      "invalid",
      NAME_BUSINESS,
      [
        { field: "name", message: NAME_BUSINESS },
        { field: "abn", message: ABN_DIGITS },
      ],
    ]);
    expect(await rows("owner", "select 1 from member where user_id = $1", [userId])).toHaveLength(0);
  });

  it("before the business is saved every later step is refused as moved on", async () => {
    const { userId } = await newUser("Too Early");
    const e = await refusal(createDbOnboarding({ userId }, now).chooseTrade(setUpActor(userId), "roofing"));
    expect([e.code, e.message]).toEqual(["conflict", MOVED_ON]);
  });
});

describe("db onboarding: the steps", () => {
  it("chooseTrade then acceptDefaults copies the roofing templates, categories and levels once", async () => {
    const { actor, o } = await walkTo("defaults");
    expect((await o.state(actor)).trade).toBe("roofing");
    const s = await o.acceptDefaults(actor);
    expect(s.step).toBe("crew");
    const count = async (t: string) =>
      (await rows("owner", `select 1 from ${t} where workspace_id = $1`, [actor.workspaceId])).length;
    const want = {
      stage_template: Object.keys(ROOFING_DEFAULTS.templates).length,
      expense_category: ROOFING_DEFAULTS.categories.length,
      crew_level: ROOFING_DEFAULTS.levels.length,
    };
    const items = Object.values(ROOFING_DEFAULTS.templates).reduce((n, t) => n + t.items.length, 0);
    expect({
      stage_template: await count("stage_template"),
      expense_category: await count("expense_category"),
      crew_level: await count("crew_level"),
    }).toEqual(want);
    expect(await count("stage_template_item")).toBe(items);
    expect(s.levels.map((l) => l.name)).toEqual(ROOFING_DEFAULTS.levels.map((l) => l.name));
    expect(s.defaults.categories).toEqual([...ROOFING_DEFAULTS.categories]);
    await o.back(actor);
    await o.acceptDefaults(actor);
    expect(await count("stage_template")).toBe(want.stage_template);
    expect(await count("crew_level")).toBe(want.crew_level);
    expect(await count("expense_category")).toBe(want.expense_category);
  });

  it("addCrew writes one crew member and one rate from today in the workspace timezone, no project", async () => {
    const { actor, o } = await walkTo("crew");
    const level = (await o.state(actor)).levels[0]!;
    const s = await o.addCrew(actor, {
      name: " Sam Hill ",
      type: "employee",
      levelId: level.id,
      basis: "hourly",
      rateCents: 4250,
    });
    expect(s.crew).toEqual([
      {
        id: expect.any(String),
        name: "Sam Hill",
        type: "employee",
        levelName: level.name,
        basis: "hourly",
        rateCents: 4250,
      },
    ]);
    const crew = await rows<{ id: string; active_from: string }>(
      "owner",
      "select id, active_from::text from crew_member where workspace_id = $1",
      [actor.workspaceId],
    );
    expect(crew).toHaveLength(1);
    const rates = await rows(
      "owner",
      "select basis, amount_cents::int as amount_cents, effective_from::text as effective_from, project_id from rate where crew_member_id = $1",
      [crew[0]!.id],
    );
    expect(rates).toEqual([{ basis: "hourly", amount_cents: 4250, effective_from: TODAY, project_id: null }]);
    expect(TODAY).toBe("2026-10-15");
    expect(crew[0]!.active_from).toBe(TODAY);
  });

  it("refuses a bad crew row field by field with the fake's words", async () => {
    const { actor, o } = await walkTo("crew");
    const e = await refusal(
      o.addCrew(actor, { name: "", type: "contractor", levelId: null, basis: "daily", rateCents: 0 }),
    );
    expect([e.code, e.issues]).toEqual([
      "invalid",
      [
        { field: "name", message: NAME_CREW },
        { field: "rate", message: RATE_MISSING_DAILY },
      ],
    ]);
    const h = await refusal(
      o.addCrew(actor, { name: "Jo", type: "contractor", levelId: null, basis: "hourly", rateCents: 0 }),
    );
    expect(h.issues).toEqual([{ field: "rate", message: RATE_MISSING }]);
    expect(
      await rows("owner", "select 1 from crew_member where workspace_id = $1", [actor.workspaceId]),
    ).toHaveLength(0);
  });

  it("back and a reload resume at the saved step; finish makes it done", async () => {
    const { actor, o } = await walkTo("install");
    expect((await o.back(actor)).step).toBe("crew");
    expect((await createDbOnboarding(actor, now).state(actor)).step).toBe("crew");
    await o.finishCrew(actor);
    const done = await o.finish(actor);
    expect(done.step).toBe("done");
    const [w] = await rows<{ onboarding_step: string }>(
      "owner",
      "select onboarding_step from workspace where id = $1",
      [actor.workspaceId],
    );
    expect(w!.onboarding_step).toBe("done");
  });

  it("a stale step is refused and keeps the step (F6)", async () => {
    const { actor, o } = await walkTo("crew");
    const e = await refusal(o.chooseTrade(actor, "roofing"));
    expect([e.code, e.message]).toEqual(["conflict", MOVED_ON]);
    expect((await o.state(actor)).step).toBe("crew");
  });

  it("a second user cannot call these on the first user's workspace", async () => {
    const { actor: first } = await walkTo("crew", "First");
    const { userId } = await newUser("Second");
    const forged: Actor = { userId, workspaceId: first.workspaceId, role: "owner", name: "Second" };
    const o = createDbOnboarding(forged, now);
    for (const call of [
      () => o.state(forged),
      () => o.finishCrew(forged),
      () => o.back(forged),
      () => o.saveBusiness(forged, BUSINESS),
    ]) {
      expect((await refusal(call())).code).toBe("forbidden");
    }
    const [w] = await rows<{ onboarding_step: string }>(
      "owner",
      "select onboarding_step from workspace where id = $1",
      [first.workspaceId],
    );
    expect(w!.onboarding_step).toBe("crew");
  });
});

describe("foreman scan: onboarding", () => {
  let foreman: Actor;
  beforeAll(async () => {
    const { actor } = await walkTo("crew", "Scan Owner");
    const { userId } = await newUser("Scan foreman");
    await pool("owner").query(
      `insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, 'foreman')`,
      [uuidv7(), actor.workspaceId, userId],
    );
    foreman = { userId, workspaceId: actor.workspaceId, role: "foreman", name: "Scan foreman" };
  });
  for (const [method, entry] of Object.entries(ONBOARDING_SCAN)) {
    if ("reach" in entry) {
      it(`${method} carries no money for a foreman`, async () => {
        expectNoMoney(
          await entry.reach(createDbOnboarding(foreman, now), foreman, {
            foremanMemberId: "",
            projectId: "",
          }),
          `onboarding.${method}`,
        );
      });
    } else {
      it(`${method} is refused to a foreman`, async () => {
        const e = await refusal(
          entry.refused(createDbOnboarding(foreman, now), foreman, { foremanMemberId: "", projectId: "" }),
        );
        expect(e.code).toBe("forbidden");
      });
    }
  }
});
