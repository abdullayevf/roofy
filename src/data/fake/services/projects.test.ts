import { describe, expect, it } from "vitest";
import { expenseCost, labourCost } from "@/domain/costing";
import { sum } from "@/domain/money";
import { lumpSumLines } from "@/domain/piece";
import { forecastLabour, projectMargins, projectPercentBp, stagePercentBp } from "@/domain/progress";
import { lostWorkingDays, realWorkingDays } from "@/domain/segments";
import { DataError, type ProjectDetailManager, type StageDetailManager } from "../../contracts";
import { getSeed } from "../store";
import { fake } from "./testing";

const seed = getSeed();
const { meta } = seed;
const live = seed.workLogs.filter((l) => l.deletedAt === null);
const ctx = { workspaceGstRegistered: true, onCostBp: 2500 };
const crewName = (id: string) => seed.crewMembers.find((c) => c.id === id)!.name;
const cost = (l: (typeof live)[number]) =>
  labourCost(
    l.amountCents,
    seed.crewMembers.find((c) => c.id === l.crewMemberId)!,
    ctx,
  );

async function smith(role: "manager" | "owner" | "accountant" = "manager"): Promise<ProjectDetailManager> {
  const { data, actor } = fake(role);
  const detail = await data.projects.get(actor, meta.projects.smith);
  if (detail.view !== "manager") throw new Error("expected the manager view");
  return detail;
}

describe("job detail (manager)", () => {
  it("Smith sheet install: 30%, $1,432.50 actual, $4,775.00 forecast, trending $775.00, over marker at the forecast", async () => {
    const d = await smith();
    const sheet = d.stages.find((s) => s.id === meta.stages.smithSheetInstall)!;
    expect(sheet).toMatchObject({
      name: "Sheet install",
      status: "active",
      unit: "m2",
      quantityDone: 12000,
      plannedQuantity: 40000,
      pctBp: 3000,
      labourBudgetCents: 400000,
      labourActualCents: 143250,
      forecastLabourCents: 477500,
      alert: { level: "trending", severity: "watch", byCents: 77500 },
      tape: { pctBp: 3000, overMarkerBp: 11938 },
    });
  });

  it("job figures equal src/domain: % complete, labour, materials, expenses and projectMargins", async () => {
    const d = await smith();
    const stages = seed.stages.filter((s) => s.projectId === meta.projects.smith);
    const figs = stages.map((st) => {
      const measured = sum(seed.progressEntries.filter((p) => p.stageId === st.id).map((p) => p.quantity));
      const pct = stagePercentBp({ ...st, measuredQty: measured });
      const actual = sum(live.filter((l) => l.stageId === st.id).map(cost));
      return { st, pct, actual, forecast: forecastLabour(st.status, pct, actual) };
    });
    const expenses = seed.expenses.filter((e) => e.projectId === meta.projects.smith);
    const materialsId = seed.expenseCategories.find((c) => c.name === "Materials")!.id;
    const expenseCents = sum(expenses.map((e) => expenseCost(e.amountExGstCents, e.gstCents, true)));
    const materialsCents = sum(
      expenses
        .filter((e) => e.categoryId === materialsId)
        .map((e) => expenseCost(e.amountExGstCents, e.gstCents, true)),
    );
    const pct = projectPercentBp(
      figs.map((f) => ({ pctBp: f.pct, labourBudgetCents: f.st.labourBudgetCents })),
    );
    const margins = projectMargins({
      contractCents: d.contractCents,
      projectPctBp: pct,
      labourCostCents: sum(figs.map((f) => f.actual)),
      expenseCostCents: expenseCents,
      materialsBudgetCents: sum(stages.map((s) => s.materialsBudgetCents)),
      materialsExpenseCents: materialsCents,
      stages: figs.map((f) => ({
        forecastCents: f.forecast,
        labourBudgetCents: f.st.labourBudgetCents,
        actualLabourCents: f.actual,
      })),
    });
    expect(d.pctBp).toBe(pct);
    expect(d.labour).toEqual({
      actualCents: sum(figs.map((f) => f.actual)),
      budgetCents: sum(stages.map((s) => s.labourBudgetCents)),
      expectedCents: sum(figs.map((f) => f.forecast ?? Math.max(f.st.labourBudgetCents, f.actual))),
    });
    expect(d.materials).toEqual({
      actualCents: materialsCents,
      budgetCents: sum(stages.map((s) => s.materialsBudgetCents)),
    });
    expect(d.expensesCents).toBe(expenseCents);
    expect(d.margins).toEqual(margins);
    expect(d.alert).toEqual({ level: "trending", severity: "watch", byCents: 77500 });
  });

  it("lists the job's recent logs, expenses (newest first), files and this week's crew", async () => {
    const d = await smith();
    expect(d.recentLogs).toHaveLength(20);
    expect(d.recentLogs[0]!.date >= d.recentLogs[19]!.date).toBe(true);
    expect(d.recentLogs.every((l) => l.labourCostCents === cost(live.find((x) => x.id === l.id)!))).toBe(
      true,
    );
    expect(d.expenses[0]!.supplier).toBe("Trade Fasteners");
    expect(d.expenses[0]).toMatchObject({
      paidBy: "crew",
      crewName: "Dima",
      totalCents: 11000,
      gstCents: 1000,
      costCents: 10000,
      reimbursement: { payRunId: meta.payRuns.review, status: "in_draft" },
    });
    expect(d.files.map((f) => [f.name, f.kind])).toEqual([
      ["Quote.pdf", "pdf"],
      ["Before — street side.jpg", "photo"],
    ]);
    // Rolling 7 days, 22–28 Sep: Ben, Jake and Josh on Tue 22; Sam and Dima Wed–Fri.
    expect(d.crewThisWeek.map((w) => [w.name, w.days])).toEqual([
      ["Ben", 1],
      ["Dima", 3],
      ["Jake", 1],
      ["Josh", 1],
      ["Sam", 3],
    ]);
  });

  it("accountant gets the manager view with editing off; owner can administer", async () => {
    expect((await smith("accountant")).access).toEqual({
      role: "accountant",
      canEdit: false,
      canApprove: false,
      canExport: true,
      canAdminister: false,
    });
    expect((await smith("owner")).access.canAdminister).toBe(true);
  });

  it("the jobs list defaults to active jobs; 'all' adds on-hold, complete and closed", async () => {
    const { data, actor } = fake("manager");
    const active = await data.projects.list(actor);
    expect(active.rows).toHaveLength(5);
    const all = await data.projects.list(actor, { status: "all" });
    expect(all.rows.length).toBe(seed.projects.length);
    expect(all.rows.slice(0, 5).every((r) => r.status === "active")).toBe(true);
  });

  it("proposes stages from the last job of the same type, else the template", async () => {
    const { data, actor } = fake("manager");
    const metal = await data.projects.proposeStages(actor, "metal_reroof");
    expect(metal.source).toMatchObject({ kind: "last_job", projectName: "Smith job — Ryde re-roof" });
    expect(metal.stages.find((s) => s.name === "Sheet install")).toMatchObject({
      plannedQuantity: 40000,
      labourBudgetCents: 400000,
    });
    const empty = fake("manager", { demo: "empty" });
    const fromTemplate = await empty.data.projects.proposeStages(empty.actor, "repair");
    expect(fromTemplate.source.kind).toBe("template");
    expect(fromTemplate.stages.map((s) => s.name)).toEqual(["Inspect", "Repair", "Clean-up"]);
  });
});

describe("job detail (foreman)", () => {
  it("sees only the two assigned jobs; another job is forbidden", async () => {
    const { data, actor } = fake("foreman");
    const list = await data.projects.list(actor);
    expect(list.view).toBe("foreman");
    expect(list.rows.map((r) => r.name).sort()).toEqual([
      "Patel job — Epping re-roof",
      "Smith job — Ryde re-roof",
    ]);
    const d = await data.projects.get(actor, meta.projects.smith);
    expect(d.view).toBe("foreman");
    await expect(data.projects.get(actor, meta.projects.harris)).rejects.toMatchObject({ code: "forbidden" });
    await expect(data.stages.get(actor, meta.stages.harrisRidge)).rejects.toBeInstanceOf(DataError);
    await expect(data.projects.get(actor, "nope")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("stage detail", () => {
  async function stage(id: string, role: "manager" | "foreman" = "manager") {
    const { data, actor } = fake(role);
    return data.stages.get(actor, id);
  }

  it("shows the arithmetic behind the Smith forecast and its two progress lines (flows: find the losing job)", async () => {
    const s = (await stage(meta.stages.smithSheetInstall)) as StageDetailManager;
    expect(s.forecastWorking).toEqual({ actualCents: 143250, pctBp: 3000, forecastCents: 477500 });
    expect(s.progress).toHaveLength(1);
    expect(s.progress[0]!.split.map((x) => [x.name, x.quantity, x.amountCents])).toEqual([
      ["Sam", 6000, 57000],
      ["Dima", 6000, 72000],
    ]);
    expect(s.actions).toMatchObject({ canPause: true, canMarkDone: true, canStart: false, canReopen: false });
  });

  it("E13.1 Patel sheet install: 6 real working days, 3 lost to weather", async () => {
    const s = await stage(meta.stages.patelSheetInstall);
    const segs = seed.stageSegments
      .filter((g) => g.stageId === meta.stages.patelSheetInstall)
      .map((g) => ({ start: g.startDate, end: g.endDate, pauseReason: g.pauseReason }));
    expect(s.realWorkingDays).toBe(realWorkingDays(segs, [1, 2, 3, 4, 5], "2026-09-28"));
    expect([s.realWorkingDays, s.lostDays.weather]).toEqual([6, 3]);
    expect(s.lostDays).toEqual(lostWorkingDays(segs, [1, 2, 3, 4, 5], "2026-09-28"));
    expect(s.pauses).toEqual([
      { start: "2026-09-10", end: "2026-09-15", reason: "weather", ongoing: false, workingDays: 3 },
    ]);
  });

  it("Ryde coat / paint is paused too long, waiting on materials", async () => {
    const { data, actor } = fake("manager");
    const s = await data.stages.get(actor, meta.stages.rydeCoat);
    expect([s.status, s.pausedTooLong, s.actions.canResume]).toEqual(["paused", true, true]);
  });

  it("E5.1 Harris ridge Done proposal: Sam/Tom/Dima $666.67 / $666.67 / $666.66", async () => {
    const { data, actor } = fake("manager");
    const p = await data.stages.doneProposal(actor, meta.stages.harrisRidge);
    expect(p.completedOn).toBe("2026-09-28");
    expect(p.crew.map((x) => [x.name, x.shareBp, x.amountCents])).toEqual([
      ["Sam", 3334, 66667],
      ["Tom", 3333, 66667],
      ["Dima", 3333, 66666],
    ]);
    expect(p.crew.map((x) => x.amountCents)).toEqual(
      lumpSumLines(
        200000,
        p.crew.map((x) => x.crewMemberId),
        { mode: "equal" },
      ).map((l) => l.amountCents),
    );
  });

  it("Brown ridge (done, lump sum paid) shows each person's share", async () => {
    const s = (await stage(meta.stages.brownRidge)) as StageDetailManager;
    expect(s.lumpSumShares.map((x) => [crewName(x.crewMemberId), x.amountCents])).toEqual([
      ["Mick", 60000],
      ["Kev", 60000],
      ["Josh", 60000],
    ]);
    expect(s.actions.canReopen).toBe(true);
  });

  it("foreman: can pause and resume, never mark Done; Done proposal and accountant proposal are forbidden", async () => {
    const f = await stage(meta.stages.smithSheetInstall, "foreman");
    expect(f.view).toBe("foreman");
    expect(f.actions).toEqual({
      canStart: false,
      canPause: true,
      canResume: false,
      canMarkDone: false,
      canReopen: false,
      canSetManualPct: false,
    });
    for (const role of ["foreman", "accountant"] as const) {
      const { data, actor } = fake(role);
      await expect(data.stages.doneProposal(actor, meta.stages.smithSheetInstall)).rejects.toMatchObject({
        code: "forbidden",
      });
    }
  });
});

describe("crew this week (foreman) leaves out adjustments", () => {
  it("an adjustment dated this week doesn't add days or hours to the foreman's view", async () => {
    const { fakeSession } = await import("./testing");
    const { data, actor, store, as } = fakeSession("foreman");
    const base = store.tables.workLogs.find(
      (l) =>
        l.projectId === meta.projects.smith && l.date === "2026-09-25" && l.hours > 0 && l.deletedAt === null,
    )!;
    const before = await data.projects.get(actor, meta.projects.smith);
    // A pay-run artefact for someone with no other log on the job this week, plus one for someone with logs.
    const other = seed.crewMembers.find(
      (c) =>
        !store.tables.workLogs.some(
          (l) => l.projectId === meta.projects.smith && l.crewMemberId === c.id && l.date >= "2026-09-22",
        ),
    )!;
    store.write((t) => {
      for (const crewMemberId of [other.id, base.crewMemberId]) {
        t.workLogs.push({
          ...base,
          id: `adj-${crewMemberId}`,
          crewMemberId,
          date: "2026-09-24",
          hours: 50,
          quantity: 50,
          source: "adjustment",
          adjustsLogId: base.id,
          entryId: `adj-entry-${crewMemberId}`,
        });
      }
    });
    const after = await data.projects.get(actor, meta.projects.smith);
    expect(after.crewThisWeek).toEqual(before.crewThisWeek);
    const manager = as("manager");
    const m = await manager.data.projects.get(manager.actor, meta.projects.smith);
    expect(m.crewThisWeek.map((w) => w.name)).toContain(other.name);
  });
});
