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
      "Patel job",
      "Ryde heritage",
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
    expect(r.rows).toContainEqual({
      month: "2026-09",
      projectId: meta.projects.patel,
      projectName: "Patel job — Epping re-roof",
      stageName: "Sheet install",
      reason: "weather",
      workingDays: 3,
    });
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
