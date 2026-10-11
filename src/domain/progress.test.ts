import { describe, expect, it } from "vitest";
import {
  budgetAlert,
  trendingTriggerCents,
  forecastLabour,
  jobOver,
  projectMargins,
  projectPercentBp,
  stageExpectedLabour,
  stagePercentBp,
} from "./progress";

const unitStage = { status: "active", unit: "m2", budgetQty: 40_000, manualPctBp: null } as const;

describe("stage % complete", () => {
  it("E12.1 120 of 400 m² = 30%", () => {
    expect(stagePercentBp({ ...unitStage, measuredQty: 12_000 })).toBe(3000);
  });
  it("caps at 100% and treats Done as 100%", () => {
    expect(stagePercentBp({ ...unitStage, measuredQty: 45_000 })).toBe(10_000);
    expect(stagePercentBp({ ...unitStage, status: "done", measuredQty: 0 })).toBe(10_000);
  });
  it("uses the manual % for no-unit stages, else 0", () => {
    const noUnit = { status: "active", unit: null, budgetQty: null, measuredQty: 0 } as const;
    expect(stagePercentBp({ ...noUnit, manualPctBp: 5000 })).toBe(5000);
    expect(stagePercentBp({ ...noUnit, manualPctBp: null })).toBe(0);
    expect(stagePercentBp({ ...unitStage, budgetQty: 0, measuredQty: 100 })).toBe(0);
  });
});

describe("project % complete", () => {
  it("weights stages by labour budget", () => {
    expect(
      projectPercentBp([
        { pctBp: 10_000, labourBudgetCents: 100_000 },
        { pctBp: 0, labourBudgetCents: 300_000 },
      ]),
    ).toBe(2500);
  });
  it("falls back to a simple average when all budgets are zero, and 0 for no stages", () => {
    expect(
      projectPercentBp([
        { pctBp: 10_000, labourBudgetCents: 0 },
        { pctBp: 0, labourBudgetCents: 0 },
      ]),
    ).toBe(5000);
    expect(projectPercentBp([])).toBe(0);
  });
});

describe("forecast and alerts", () => {
  it("E12.1 forecast $4,775.00 vs budget $4,000.00 → trending over by $775.00", () => {
    const f = forecastLabour("active", 3000, 143_250);
    expect(f).toBe(477_500);
    expect(budgetAlert(143_250, f, 400_000)).toEqual({ level: "trending", byCents: 77_500 });
  });
  it("E12.2 manual 50%, $900 spent of $1,500 → trending over by $300.00", () => {
    const f = forecastLabour("active", 5000, 90_000);
    expect(budgetAlert(90_000, f, 150_000)).toEqual({ level: "trending", byCents: 30_000 });
  });
  it("E12.3 no % set, $1,600 spent of $1,500 → over by $100.00", () => {
    const f = forecastLabour("active", 0, 160_000);
    expect(f).toBeNull();
    expect(budgetAlert(160_000, f, 150_000)).toEqual({ level: "over", byCents: 10_000 });
  });
  it("ignores forecasts within the 5% tolerance and uses actual for Done stages", () => {
    expect(budgetAlert(100_000, 104_000, 100_000)).toBeNull();
    expect(forecastLabour("done", 10_000, 123_400)).toBe(123_400);
    expect(budgetAlert(10_000, null, 100_000)).toBeNull();
  });
});

describe("stage expected labour (pay rules §12 margins)", () => {
  it("is the forecast when there is one, else the larger of budget and actual", () => {
    expect(stageExpectedLabour(477500, 400000, 143250)).toBe(477500);
    expect(stageExpectedLabour(null, 150000, 160000)).toBe(160000);
    expect(stageExpectedLabour(null, 150000, 20000)).toBe(150000);
  });
});

describe("projectMargins", () => {
  it("computes earned value, margin to date and forecast margin", () => {
    expect(
      projectMargins({
        contractCents: 2_000_000,
        projectPctBp: 3000,
        labourCostCents: 143_250,
        expenseCostCents: 400_000,
        materialsBudgetCents: 800_000,
        materialsExpenseCents: 400_000,
        stages: [
          { forecastCents: 477_500, labourBudgetCents: 400_000, actualLabourCents: 143_250 },
          { forecastCents: null, labourBudgetCents: 300_000, actualLabourCents: 0 },
        ],
      }),
    ).toEqual({ earnedValueCents: 600_000, marginToDateCents: 56_750, forecastMarginCents: 422_500 });
  });
  it("never counts negative remaining materials and uses actual when above budget without a forecast", () => {
    expect(
      projectMargins({
        contractCents: 1_000_000,
        projectPctBp: 0,
        labourCostCents: 0,
        expenseCostCents: 900_000,
        materialsBudgetCents: 500_000,
        materialsExpenseCents: 900_000,
        stages: [{ forecastCents: null, labourBudgetCents: 100_000, actualLabourCents: 200_000 }],
      }).forecastMarginCents,
    ).toBe(1_000_000 - (200_000 + 900_000 + 0));
  });
});

describe("jobOver (R9: the one rule for an over-budget job)", () => {
  const st = (name: string, actualCents: number, budgetCents: number) => ({ name, actualCents, budgetCents });
  it("is not over when labour and every stage are within budget", () => {
    expect(jobOver(150_000, 200_000, [st("Sheet install", 100_000, 120_000), st("Clean-up", 50_000, 80_000)])).toBeNull();
    expect(jobOver(0, 0, [])).toBeNull();
  });
  it("is not over on an exact tie, for the job or a stage (spec: over means strictly more)", () => {
    expect(jobOver(100, 100, [st("A", 100, 100)])).toBeNull();
    expect(jobOver(100_000, 100_000, [st("Sheet install", 60_000, 60_000), st("Clean-up", 40_000, 40_000)])).toBeNull();
  });
  it("is over when anything is spent against a $0 budget", () => {
    expect(jobOver(1, 0, [st("A", 1, 0)])).toEqual({ kind: "labour", byCents: 1 });
    expect(jobOver(100_000, 0, [])).toEqual({ kind: "labour", byCents: 100_000 });
  });
  it("is over when labour passes the job's labour budget, and says so for the job, not a stage", () => {
    expect(jobOver(212_000, 200_000, [st("Sheet install", 100_000, 100_000), st("Clean-up", 112_000, 100_000)])).toEqual({
      kind: "labour",
      byCents: 12_000,
    });
  });
  it("is over when one stage is over though the job is under, and names the worst stage", () => {
    expect(jobOver(400_000, 500_000, [st("Sheet install", 100_000, 90_000), st("Clean-up", 40_000, 30_000)])).toEqual({
      kind: "stage",
      stage: "Sheet install",
      byCents: 10_000,
    });
    expect(jobOver(400_000, 500_000, [st("Clean-up", 40_000, 30_000), st("Flashings", 60_000, 30_000)])).toEqual({
      kind: "stage",
      stage: "Flashings",
      byCents: 30_000,
    });
  });
  it("names the job as a whole when both are true", () => {
    expect(jobOver(300_000, 200_000, [st("Clean-up", 50_000, 30_000)])).toEqual({ kind: "labour", byCents: 100_000 });
  });
});

describe("trending trigger point (pay rules §12 alerts)", () => {
  it("E12.1 the warning starts above budget × 1.05: $4,000.00 → $4,200.00", () => {
    expect(trendingTriggerCents(400_000)).toBe(420_000);
  });
  it("is the last forecast that is not trending (rounds down) and stays $0 for no budget", () => {
    expect(trendingTriggerCents(1_001)).toBe(1_051);
    expect(trendingTriggerCents(400_050)).toBe(420_052);
    expect(trendingTriggerCents(0)).toBe(0);
  });
  it("matches budgetAlert exactly: the trigger is not trending, one cent more is", () => {
    for (const budget of [400_050, 400_000, 1_001, 1_010, 99_990, 123_457]) {
      const at = trendingTriggerCents(budget);
      expect(budgetAlert(0, at, budget)).toBeNull();
      expect(budgetAlert(0, at + 1, budget)?.level).toBe("trending");
    }
  });
});
