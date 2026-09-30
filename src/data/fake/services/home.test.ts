import { describe, expect, it } from "vitest";
import { expenseCost, labourCost } from "@/domain/costing";
import { sum } from "@/domain/money";
import {
  budgetAlert,
  forecastLabour,
  projectMargins,
  projectPercentBp,
  stagePercentBp,
} from "@/domain/progress";
import type { DemoState, HomeForeman, HomeManager } from "../../contracts";
import { getSeed } from "../store";
import { fake, fakeSession } from "./testing";

const seed = getSeed();
const live = seed.workLogs.filter((l) => l.deletedAt === null);
const ctx = { workspaceGstRegistered: true, onCostBp: 2500 };
const crew = (id: string) => seed.crewMembers.find((c) => c.id === id)!;
const cost = (logs: typeof live) =>
  sum(logs.map((l) => labourCost(l.amountCents, crew(l.crewMemberId), ctx)));

/** An independent oracle: the project's figures straight from src/domain over the seed rows. */
function oracle(projectId: string) {
  const stages = seed.stages.filter((s) => s.projectId === projectId);
  const figs = stages.map((st) => {
    const measured = sum(seed.progressEntries.filter((p) => p.stageId === st.id).map((p) => p.quantity));
    const pct = stagePercentBp({ ...st, measuredQty: measured });
    const actual = cost(live.filter((l) => l.stageId === st.id));
    const forecast = forecastLabour(st.status, pct, actual);
    return { st, pct, actual, forecast, alert: budgetAlert(actual, forecast, st.labourBudgetCents) };
  });
  const expenses = seed.expenses.filter((e) => e.projectId === projectId);
  const materialsId = seed.expenseCategories.find((c) => c.name === "Materials")!.id;
  const pct = projectPercentBp(
    figs.map((f) => ({ pctBp: f.pct, labourBudgetCents: f.st.labourBudgetCents })),
  );
  const expenseCents = sum(expenses.map((e) => expenseCost(e.amountExGstCents, e.gstCents, true)));
  const margins = projectMargins({
    contractCents: seed.projects.find((p) => p.id === projectId)!.contractValueCents,
    projectPctBp: pct,
    labourCostCents: sum(figs.map((f) => f.actual)),
    expenseCostCents: expenseCents,
    materialsBudgetCents: sum(stages.map((s) => s.materialsBudgetCents)),
    materialsExpenseCents: sum(
      expenses
        .filter((e) => e.categoryId === materialsId)
        .map((e) => expenseCost(e.amountExGstCents, e.gstCents, true)),
    ),
    stages: figs.map((f) => ({
      forecastCents: f.forecast,
      labourBudgetCents: f.st.labourBudgetCents,
      actualLabourCents: f.actual,
    })),
  });
  return { figs, pct, margins, expenseCents, labour: sum(figs.map((f) => f.actual)) };
}

async function managerHome(demo: DemoState | null = null): Promise<HomeManager> {
  const { data, actor } = fake("manager", { demo });
  const home = await data.home.get(actor);
  if (home.view !== "manager") throw new Error("expected the manager home");
  return home;
}

describe("home (manager)", () => {
  it("is Mon 28 Sep 2026 in Sydney at the default fake clock", async () => {
    expect((await managerHome()).today).toBe("2026-09-28");
  });

  it("Smith job: sheet install 30%, $1,432.50 actual, $4,775.00 forecast, trending $775.00 — equal to src/domain", async () => {
    const home = await managerHome();
    const smith = home.activeJobs.find((j) => j.projectId === seed.meta.projects.smith)!;
    const o = oracle(seed.meta.projects.smith);
    const sheet = o.figs.find((f) => f.st.id === seed.meta.stages.smithSheetInstall)!;
    expect([sheet.pct, sheet.actual, sheet.forecast]).toEqual([3000, 143250, 477500]);
    expect(smith).toMatchObject({
      name: "Smith job — Ryde re-roof",
      pctBp: o.pct,
      labourActualCents: o.labour,
      labourBudgetCents: sum(o.figs.map((f) => f.st.labourBudgetCents)),
      forecastMarginCents: o.margins.forecastMarginCents,
      alert: { level: "trending", severity: "watch", byCents: 77500 },
      alertStageName: "Sheet install",
      daysSinceLastLog: 3,
      href: `/jobs/${seed.meta.projects.smith}`,
    });
    expect(smith.currentStages.map((s) => [s.name, s.status])).toEqual([["Sheet install", "active"]]);
  });

  it("the forecast marker is the job's expected labour ÷ its labour budget, for every job; the stage line has the stage's own figures", async () => {
    const home = await managerHome();
    const smith = home.activeJobs.find((j) => j.projectId === seed.meta.projects.smith)!;
    // 22,795.00 expected (done stages at cost, sheet install at its forecast, the rest at budget) of 24,600.00.
    expect(smith.forecastBp).toBe(Math.round((2279500 * 10_000) / 2460000));
    for (const row of home.activeJobs) expect(row.forecastBp).not.toBeNull();
    // Sheet install: $4,775.00 forecast of a $4,000.00 stage budget (trending $775.00 over).
    expect([smith.alertStageForecastCents, smith.alertStageBudgetCents]).toEqual([477500, 400000]);
    for (const row of home.activeJobs) expect(row.alertStageForecastCents === null).toBe(row.alert === null);
  });

  it("Ryde heritage's re-bed stage carries its progress, so the job's % done and spend add up", async () => {
    const row = (await managerHome()).activeJobs.find((j) => j.name === "Ryde heritage")!;
    const spent = row.labourActualCents / row.labourBudgetCents;
    expect(Math.abs(row.pctBp / 10_000 - spent)).toBeLessThan(0.15);
  });

  it("more than 7 items: 6 rows plus the rest behind Show N more, so never more than 7 rows", async () => {
    const home = await managerHome("attention");
    expect(home.needsAttention).toHaveLength(6);
    expect(home.moreAttention.map((i) => i.kind)).toEqual(["logging_gaps", "unpaid_too_long", "below_floor"]);
    expect((await managerHome()).moreAttention.map((i) => i.kind)).toEqual(["unpaid_too_long", "below_floor"]);
  });

  it("figures are as of now, or 40 minutes earlier when offline, in the workspace timezone", async () => {
    const online = await managerHome();
    expect(online).toMatchObject({ asOf: "2026-09-27T21:00:00.000Z", timeZone: "Australia/Sydney" });
    expect((await managerHome("offline")).asOf).toBe("2026-09-27T20:20:00.000Z");
  });

  it("every active job row equals its src/domain figures", async () => {
    for (const row of (await managerHome()).activeJobs) {
      const o = oracle(row.projectId);
      expect([row.pctBp, row.labourActualCents, row.forecastMarginCents]).toEqual([
        o.pct,
        o.labour,
        o.margins.forecastMarginCents,
      ]);
    }
  });

  it("only active jobs feed Home (the on-hold Kelly job's long pause is not listed)", async () => {
    const home = await managerHome();
    const active = seed.projects.filter((p) => p.status === "active").map((p) => p.id);
    expect(home.activeJobs.map((j) => j.projectId).sort()).toEqual([...active].sort());
    for (const item of home.needsAttention) if ("projectId" in item) expect(active).toContain(item.projectId);
    expect(
      home.needsAttention.some((i) => "projectId" in i && i.projectId === seed.meta.projects.kelly),
    ).toBe(false);
  });

  it("needs attention: product spec §5.9 order (over budget red, then amber kinds), at most 7", async () => {
    const home = await managerHome();
    const name = (id: string) => crew(id).name;
    expect(
      home.needsAttention.map((i) => {
        switch (i.kind) {
          case "over_budget":
          case "trending_over":
            return [i.kind, i.severity, i.stageName, i.byCents];
          case "paused_too_long":
            return [i.kind, i.severity, i.stageName, i.reason];
          case "logging_gaps":
            return [i.kind, i.severity, i.gaps.map((g) => `${g.name} ${g.dates.join(",")}`)];
          case "unpaid_too_long":
            return [i.kind, i.severity, name(i.crewMemberId), i.since];
          case "below_floor":
            return [i.kind, i.severity, name(i.crewMemberId), i.shortfallCents];
          case "pay_blocked":
            return [i.kind, i.severity, i.name, i.href];
          default:
            return [i.kind];
        }
      }),
    ).toEqual([
      ["over_budget", "over", "Clean-up", 10000],
      ["pay_blocked", "over", expect.any(String), expect.stringMatching(/^\/pay\//)],
      ["trending_over", "watch", "Sheet install", 77500],
      ["trending_over", "watch", "Repairs & replacements", 30000],
      ["paused_too_long", "watch", "Coat / paint", "materials"],
      ["logging_gaps", "watch", ["Jake 2026-09-25", "Ravi 2026-09-25", "Nick 2026-09-24,2026-09-25"]],
    ]);
    // 8 items: six rows, then Show 2 more (Kev's balance and Tom's award floor).
    expect(home.moreAttention.map((i) => [i.kind, "name" in i ? i.name : ""])).toEqual([
      ["unpaid_too_long", "Kev"],
      ["below_floor", "Tom"],
    ]);
    const smith = home.needsAttention[2]!;
    expect(smith.href).toBe(`/jobs/${seed.meta.projects.smith}/stages/${seed.meta.stages.smithSheetInstall}`);
  });

  it("red rows first: an outbox entry needing attention follows the over-budget row, ahead of the amber kinds", async () => {
    const home = await managerHome("attention");
    expect(home.needsAttention.map((i) => i.kind)).toEqual([
      "over_budget",
      "pay_blocked",
      "outbox_attention",
      "trending_over",
      "trending_over",
      "paused_too_long",
    ]);
    expect(home.needsAttention[2]).toMatchObject({ severity: "over", count: 1, href: "/outbox" });
  });

  it("the outbox row names the entry: what it is, whose, and which job (from the device's own outbox item)", async () => {
    const home = await managerHome("attention");
    const row = home.needsAttention.find((i) => i.kind === "outbox_attention");
    expect(row).toMatchObject({
      count: 1,
      entries: [{ type: "crew_day", crewNames: ["Sam", "Dima"], jobName: expect.stringContaining("Smith") }],
    });
  });

  it("a pay run that can't be approved is a red row linking to the pay run, named for the person with no rate", async () => {
    const home = await managerHome();
    const pay = home.payPeriod!;
    const row = home.needsAttention.find((i) => i.kind === "pay_blocked");
    expect(row).toMatchObject({ severity: "over", name: pay.blockers[0]!.crewName, href: pay.href, payRunId: pay.payRunId });
    expect(home.needsAttention.findIndex((i) => i === row)).toBe(1);
  });

  it("the pay period names what blocks approval", async () => {
    const pay = (await managerHome()).payPeriod!;
    expect(pay.blocking).toBe(true);
    expect(pay.blockers).toEqual([{ kind: "missing_rate", crewName: expect.any(String) }]);
  });

  it("last week: figures from src/domain over 21–27 Sep", async () => {
    const { lastWeek } = await managerHome();
    const inWeek = live.filter((l) => l.date >= "2026-09-21" && l.date <= "2026-09-27");
    const progress = seed.progressEntries.filter((p) => p.date >= "2026-09-21" && p.date <= "2026-09-27");
    expect(lastWeek).toMatchObject({
      period: { start: "2026-09-21", end: "2026-09-27" },
      labourCostCents: cost(inWeek),
      hours: sum(inWeek.map((l) => l.hours)),
      crewDays: new Set(inWeek.map((l) => `${l.crewMemberId}|${l.date}`)).size,
      expensesCents: sum(
        seed.expenses
          .filter((e) => e.date >= "2026-09-21" && e.date <= "2026-09-27")
          .map((e) => expenseCost(e.amountExGstCents, e.gstCents, true)),
      ),
      gaps: 4,
    });
    expect(lastWeek.installed).toEqual([
      {
        unit: "m2",
        quantity: sum(
          progress
            .filter((p) => seed.stages.find((s) => s.id === p.stageId)!.unit === "m2")
            .map((p) => p.quantity),
        ),
      },
      { unit: "lm", quantity: 8000 },
    ]);
    expect(lastWeek.utilisationBp).toBeGreaterThan(0);
  });

  it("this pay period: last week's draft, its flags and outstanding balances", async () => {
    const { payPeriod } = await managerHome();
    expect(payPeriod).toMatchObject({
      payRunId: seed.meta.payRuns.review,
      period: { start: "2026-09-21", end: "2026-09-27" },
      status: "draft",
      blocking: true,
      href: `/pay/${seed.meta.payRuns.review}`,
    });
    expect(payPeriod!.draftTotalCents).toBe(sum([payPeriod!.employeesCents, payPeriod!.contractorsCents]));
    expect(payPeriod!.outstandingBalancesCents).toBeGreaterThan(0);
  });

  it("accountant gets the manager view with editing off", async () => {
    const { data, actor } = fake("accountant");
    const home = await data.home.get(actor);
    expect(home.view).toBe("manager");
    if (home.view === "manager")
      expect(home.access).toMatchObject({ canEdit: false, canApprove: false, canExport: true });
  });

  it("a new workspace (?demo=empty) has an empty Home", async () => {
    const home = await managerHome("empty");
    expect([home.needsAttention, home.activeJobs, home.payPeriod]).toEqual([[], [], null]);
    expect(home.lastWeek).toMatchObject({ labourCostCents: 0, hours: 0, gaps: 0, installed: [] });
  });

  it("reads fast: Home on the seed in under 50 ms (best of 3, after the first index build)", async () => {
    const { data, actor } = fake("manager");
    await data.home.get(actor);
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { data: fresh } = fake("manager");
      const t0 = performance.now();
      await fresh.home.get(actor);
      times.push(Math.round(performance.now() - t0));
    }
    expect(Math.min(...times), `home reads: ${times.join(", ")} ms`).toBeLessThan(50);
  });
});

describe("home (foreman)", () => {
  it("lists only the foreman's assigned active jobs, no money", async () => {
    const { data, actor } = fake("foreman");
    const home = (await data.home.get(actor)) as HomeForeman;
    expect(home.view).toBe("foreman");
    expect(home.jobs.map((j) => j.name).sort()).toEqual([
      "Patel job — Epping re-roof",
      "Smith job — Ryde re-roof",
    ]);
    expect(home.jobs.every((j) => !j.loggedToday)).toBe(true);
    expect(home.logToday).toEqual({ href: "/log", projectId: null });
    expect(home.access).toEqual({ role: "foreman", canLog: true, canPause: true, canMarkDone: false });
  });

  it("jobs are as of now, or 40 minutes earlier when offline", async () => {
    const online = (await fake("foreman").data.home.get(fake("foreman").actor)) as HomeForeman;
    expect(online).toMatchObject({ asOf: "2026-09-27T21:00:00.000Z", timeZone: "Australia/Sydney" });
    const off = fake("foreman", { demo: "offline" });
    expect(((await off.data.home.get(off.actor)) as HomeForeman).asOf).toBe("2026-09-27T20:20:00.000Z");
  });

  it("nothing logged yet today, then the job and the number of people once a day is saved", async () => {
    const { data, actor, as } = fakeSession("foreman");
    const first = (await data.home.get(actor)) as HomeForeman;
    expect(first.loggedToday).toEqual({ jobs: [], crewCount: 0 });
    const { crew, projects, stages } = seed.meta;
    await as("manager").data.logs.saveCrewDay(as("manager").actor, {
      date: "2026-09-28",
      projectId: projects.smith,
      stageId: stages.smithSheetInstall,
      entries: [crew.sam, crew.dima].map((crewMemberId) => ({
        crewMemberId,
        basis: "time_only" as const,
        days: null,
        hours: 800,
        multiplier: null,
      })),
    });
    const after = (await data.home.get(actor)) as HomeForeman;
    expect(after.loggedToday).toEqual({ jobs: ["Smith job — Ryde re-roof"], crewCount: 2 });
    expect(after.jobs.find((j) => j.name.startsWith("Smith"))!.loggedToday).toBe(true);
  });
});
