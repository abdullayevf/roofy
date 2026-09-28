import { describe, expect, it } from "vitest";
import { budgetAlert, forecastLabour, projectMargins, projectPercentBp, stagePercentBp } from "./progress";

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
