import { describe, expect, it } from "vitest";
import { expenseCost, labourCost } from "@/domain/costing";
import { sum } from "@/domain/money";
import { getSeed } from "../store";
import { fake } from "./testing";

const seed = getSeed();
const { meta } = seed;
const live = seed.workLogs.filter((l) => l.deletedAt === null);
const crew = (id: string) => seed.crewMembers.find((c) => c.id === id)!;
const SEPT = { from: "2026-09-01", to: "2026-09-27" };
const inSept = (d: string) => d >= SEPT.from && d <= SEPT.to;

describe("reports: every total equals its summed source lines", () => {
  it("job profitability: labour and expenses are the job's lines through src/domain", async () => {
    const { data, actor } = fake("accountant");
    const r = await data.reports.jobProfitability(actor, SEPT);
    // The five active jobs plus the Brown job (worked 1–4 Sep); Kelly (on hold) had no September work.
    expect(r.rows.map((x) => x.name.split(" — ")[0]).sort()).toEqual([
      "Brown job",
      "Harris job",
      "Jones job",
      "Patel job",
      "Smith job",
      "Wong job",
    ]);
    for (const row of r.rows) {
      const logs = live.filter((l) => l.projectId === row.projectId);
      expect(row.labourCents).toBe(
        sum(
          logs.map((l) =>
            labourCost(l.amountCents, crew(l.crewMemberId), { workspaceGstRegistered: true, onCostBp: 2500 }),
          ),
        ),
      );
      expect(row.expensesCents).toBe(
        sum(
          seed.expenses
            .filter((e) => e.projectId === row.projectId)
            .map((e) => expenseCost(e.amountExGstCents, e.gstCents, true)),
        ),
      );
    }
    const smith = r.rows.find((x) => x.projectId === meta.projects.smith)!;
    expect(smith.href).toBe(`/jobs/${meta.projects.smith}`);
    expect(smith.marginBp).not.toBeNull();
  });

  it("crew: each person's days, hours, earnings and units are their logs in the range", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.crew(actor, SEPT);
    for (const row of r.rows) {
      const mine = live.filter((l) => l.crewMemberId === row.crewMemberId && inSept(l.date));
      expect(row.earningsCents).toBe(sum(mine.map((l) => l.amountCents)));
      expect(row.hours).toBe(sum(mine.map((l) => l.hours)));
      expect(row.days).toBe(new Set(mine.map((l) => l.date)).size);
      expect(sum(row.units.map((u) => u.quantity))).toBe(
        sum(mine.filter((l) => l.basis === "per_unit").map((l) => l.quantity)),
      );
    }
    expect(sum(r.rows.map((x) => x.earningsCents))).toBe(
      sum(live.filter((l) => inSept(l.date)).map((l) => l.amountCents)),
    );
    const tom = r.rows.find((x) => x.name === "Tom")!;
    expect(tom.costPerUnit.map((c) => c.stageName)).toContain("Sheet install");
  });

  it("productivity: quantities sum to the progress entered in the range", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.productivity(actor, SEPT);
    expect(sum(r.rows.map((x) => x.quantity))).toBe(
      sum(seed.progressEntries.filter((p) => inSept(p.date)).map((p) => p.quantity)),
    );
    expect(r.rows.every((x) => x.crewDays > 0 && x.perCrewDay > 0)).toBe(true);
  });

  it("pauses: Patel sheet install lost 3 working days to weather in September", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.pauses(actor, SEPT);
    expect(r.rows).toContainEqual(expect.objectContaining({
      month: "2026-09",
      projectId: meta.projects.patel,
      stageId: seed.stages.find((s) => s.projectId === meta.projects.patel && s.name === "Sheet install")!.id,
      projectName: "Patel job — Epping re-roof",
      stageName: "Sheet install",
      reason: "weather",
      workingDays: 3,
    }));
  });

  it("pay history: each approved run's total is the sum of its ledger credits", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.payHistory(actor, SEPT);
    expect(r.rows.map((x) => x.period.start)).toEqual(
      ["2026-09-21", "2026-08-31", "2026-09-07", "2026-09-14"].sort().reverse(),
    );
    for (const row of r.rows.filter((x) => x.status !== "draft")) {
      const credits = seed.ledgerEntries.filter(
        (e) => e.payRunId === row.payRunId && e.kind === "payrun_credit",
      );
      expect(row.totalCents).toBe(sum(credits.map((e) => e.amountCents)));
      expect(row.totalCents).toBe(sum([row.employeesCents, row.contractorsCents]));
    }
  });

  it("CSV export: a header and one line per row, money as plain decimals", async () => {
    const { data, actor } = fake("accountant");
    const file = await data.reports.csv(actor, "pay-history", SEPT);
    const lines = file.body.trim().split("\r\n");
    expect(lines[0]).toBe("Period start,Period end,Status,Employees,Contractors,GST,Reimbursements,Total");
    expect(lines).toHaveLength(5);
    expect(lines[1]).toMatch(/^2026-09-21,2026-09-27,draft,\d+\.\d{2},/);
    expect(file.filename).toBe("pay-history-2026-09-01-to-2026-09-27.csv");
    for (const kind of ["job-profitability", "crew", "productivity", "pauses"] as const) {
      const f = await data.reports.csv(actor, kind, SEPT);
      expect(f.body.split("\r\n").length).toBeGreaterThan(2);
    }
  });

  it("a foreman can't reach any report", async () => {
    const { data, actor } = fake("foreman");
    for (const call of [
      () => data.reports.jobProfitability(actor, SEPT),
      () => data.reports.crew(actor, SEPT),
      () => data.reports.productivity(actor, SEPT),
      () => data.reports.pauses(actor, SEPT),
      () => data.reports.payHistory(actor, SEPT),
      () => data.reports.csv(actor, "crew", SEPT),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "forbidden" });
    }
  });
});

describe("reports: range, order and key figure (design fix 1a)", () => {
  const EMPTY = { from: "2020-01-01", to: "2020-01-31" };
  const WEEK = { from: "2026-09-21", to: "2026-09-27" };

  it("job profitability lists only jobs with a log or expense in the range", async () => {
    const { data, actor } = fake("owner");
    expect((await data.reports.jobProfitability(actor, EMPTY)).rows).toEqual([]);
    const week = await data.reports.jobProfitability(actor, WEEK);
    for (const row of week.rows) {
      const touched =
        live.some((l) => l.projectId === row.projectId && l.date >= WEEK.from && l.date <= WEEK.to) ||
        seed.expenses.some((e) => e.projectId === row.projectId && e.date >= WEEK.from && e.date <= WEEK.to);
      expect(touched, row.name).toBe(true);
    }
    const sept = await data.reports.jobProfitability(actor, SEPT);
    expect(week.keyFigure.value).not.toBe(sept.keyFigure.value);
  });

  it("job profitability puts the lowest forecast margin first", async () => {
    const { data, actor } = fake("owner");
    const { rows } = await data.reports.jobProfitability(actor, { from: "2026-01-01", to: "2026-09-27" });
    const margins = rows.map((r) => r.forecastMarginCents);
    expect(margins).toEqual([...margins].sort((a, b) => a - b));
  });

  it("each report has one key figure: forecast margin, earned, pace, days lost", async () => {
    const { data, actor } = fake("owner");
    const jobs = await data.reports.jobProfitability(actor, SEPT);
    expect(jobs.keyFigure).toEqual({
      format: "money",
      value: sum(jobs.rows.map((r) => r.forecastMarginCents)),
      label: "Forecast margin on 6 jobs",
    });
    const crewR = await data.reports.crew(actor, SEPT);
    expect(crewR.keyFigure.format).toBe("money");
    expect(crewR.keyFigure.value).toBe(sum(crewR.rows.map((r) => r.earningsCents)));
    expect(crewR.keyFigure.label).toBe(`Earned by ${crewR.rows.length} people`);
    const pausesR = await data.reports.pauses(actor, SEPT);
    expect(pausesR.keyFigure).toMatchObject({ format: "days", value: sum(pausesR.rows.map((r) => r.workingDays)) });
    expect(pausesR.keyFigure.label).toMatch(/^Working days lost across \d+ jobs?$/);
    const prod = await data.reports.productivity(actor, SEPT);
    expect(prod.keyFigure).toMatchObject({ format: "per-crew-day", unit: "m2" });
    expect(prod.keyFigure.value).toBeGreaterThan(0);
    expect(prod.keyFigure.label).toMatch(/^Average across \d+ stages?$/);
    expect((await data.reports.crew(actor, EMPTY)).keyFigure.value).toBe(0);
  });

  it("pay history's key figure counts only approved and exported runs, never drafts", async () => {
    const { data, actor } = fake("owner");
    const r = await data.reports.payHistory(actor, SEPT);
    expect(r.rows.some((x) => x.status === "draft")).toBe(true);
    const paid = r.rows.filter((x) => x.status !== "draft");
    expect(r.keyFigure).toEqual({
      format: "money",
      value: sum(paid.map((x) => x.totalCents)),
      label: `Paid in ${paid.length} pay runs`,
      draftCents: sum(r.rows.filter((x) => x.status === "draft").map((x) => x.totalCents)),
    });
  });

  it("productivity rows for a range inside one month carry that range as their period", async () => {
    const { data, actor } = fake("owner");
    const week = await data.reports.productivity(actor, WEEK);
    expect(week.rows.length).toBeGreaterThan(0);
    for (const row of week.rows) expect(row.period).toEqual(WEEK);
    const long = await data.reports.productivity(actor, { from: "2026-07-01", to: "2026-09-27" });
    expect(long.rows.find((x) => x.month === "2026-08")?.period).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("crew CSV carries cost per unit by stage", async () => {
    const { data, actor } = fake("owner");
    const f = await data.reports.csv(actor, "crew", SEPT);
    const [header, ...lines] = f.body.trim().split("\r\n");
    expect(header).toContain("Cost per unit by stage");
    expect(lines.some((l) => /Sheet install [\d.]+\/m2/.test(l))).toBe(true);
  });
});

describe("reports: design fix 2a (pauses by overlap, drafts in every range, pace places)", () => {
  const WEEK_2A = { from: "2026-09-21", to: "2026-09-27" };
  const LONG = { from: "2026-06-29", to: "2026-09-28" };

  it("pauses: a pause overlapping the range is included, carries its dates, counts only days inside the range", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.pauses(actor, WEEK_2A);
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(row.start <= WEEK_2A.to && row.end >= WEEK_2A.from).toBe(true);
      expect(row.workingDays).toBeLessThanOrEqual(5);
    }
  });

  it("pauses: most working days lost first", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.pauses(actor, LONG);
    const days = r.rows.map((x) => x.workingDays);
    expect(days).toEqual([...days].sort((a, b) => b - a));
    expect(r.rows.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.start) && x.end >= x.start)).toBe(true);
  });

  it("pay history: overlapping ranges give the same runs, drafts listed in each, never in Paid, draft total exposed", async () => {
    const { data, actor } = fake("owner");
    const week = await data.reports.payHistory(actor, WEEK_2A);
    const sept = await data.reports.payHistory(actor, SEPT);
    const long = await data.reports.payHistory(actor, LONG);
    const key = (x: { payRunId: string; status: string }) => `${x.payRunId}:${x.status}`;
    const inWeek = week.rows.map(key);
    expect(inWeek.length).toBeGreaterThan(0);
    for (const other of [sept, long]) expect(other.rows.map(key)).toEqual(expect.arrayContaining(inWeek));
    for (const r of [week, sept, long]) {
      const drafts = r.rows.filter((x) => x.status === "draft");
      expect(drafts.length).toBeGreaterThan(0);
      expect(r.keyFigure.value).toBe(sum(r.rows.filter((x) => x.status !== "draft").map((x) => x.totalCents)));
      expect(r.keyFigure).toMatchObject({ format: "money", draftCents: sum(drafts.map((x) => x.totalCents)) });
    }
    expect(week.keyFigure).toMatchObject({ value: 0, draftCents: 1424216 });
  });

  it("productivity: the export gives pace with 2 decimal places on every row", async () => {
    const { data, actor } = fake("owner");
    const file = await data.reports.csv(actor, "productivity", SEPT);
    const text = Object.values(file).find((v): v is string => typeof v === "string" && v.includes("\n"))!;
    const lines = text.trim().split(/\r?\n/).slice(1);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).toMatch(/,"?\d[\d,]*\.\d{2}"?$/);
  });
});

describe("reports: review fix (cost per unit, clamped periods)", () => {
  const WEEK = { from: "2026-09-21", to: "2026-09-27" };
  const stageOf = (id: string) => seed.stages.find((s) => s.id === id)!;

  it("crew: a stage with an unpriced per-unit log is left out of cost per unit, never shown as $0.00 (E4.3)", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.crew(actor, WEEK);
    const jake = r.rows.find((x) => x.name === "Jake")!;
    expect(live.some((l) => l.crewMemberId === jake.crewMemberId && l.missingRate && l.date >= WEEK.from && l.date <= WEEK.to)).toBe(true);
    expect(jake.costPerUnit.filter((c) => c.unit === "lm")).toEqual([]);
    for (const row of r.rows) expect(row.costPerUnit.every((c) => c.centsPerUnit > 0)).toBe(true);
    const f = await data.reports.csv(actor, "crew", WEEK);
    expect(f.body).not.toMatch(/ 0\.00\//);
  });

  it("crew: cost per unit is the stage's labour over its per-unit quantity, grouped by the stage's unit", async () => {
    const { data, actor } = fake("manager");
    const r = await data.reports.crew(actor, SEPT);
    const tom = r.rows.find((x) => x.name === "Tom")!;
    const sheet = tom.costPerUnit.find((c) => c.stageName === "Sheet install")!;
    const logs = live.filter((l) => l.crewMemberId === tom.crewMemberId && inSept(l.date) && stageOf(l.stageId).name === "Sheet install" && stageOf(l.stageId).unit === "m2");
    const cents = sum(logs.map((l) => labourCost(l.amountCents, crew(l.crewMemberId), { workspaceGstRegistered: true, onCostBp: 2500 })));
    const qty = sum(logs.filter((l) => l.basis === "per_unit").map((l) => l.quantity));
    expect(sheet).toEqual({ stageName: "Sheet install", unit: "m2", centsPerUnit: Math.round((cents * 100) / qty) });
  });

  it("productivity: a month only partly inside the range carries the clamped dates", async () => {
    const { data, actor } = fake("owner");
    const r = await data.reports.productivity(actor, { from: "2026-07-12", to: "2026-09-27" });
    const july = r.rows.filter((x) => x.month === "2026-07");
    expect(july.length).toBeGreaterThan(0);
    for (const row of july) expect(row.period).toEqual({ from: "2026-07-12", to: "2026-07-31" });
    for (const row of r.rows.filter((x) => x.month === "2026-08")) expect(row.period).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    for (const row of r.rows.filter((x) => x.month === "2026-09")) expect(row.period).toEqual({ from: "2026-09-01", to: "2026-09-27" });
    const f = await data.reports.csv(actor, "productivity", { from: "2026-07-12", to: "2026-09-27" });
    expect(f.body).toContain("2026-07-12,2026-07-31");
    expect(f.body).not.toContain("2026-07-01");
  });
});
