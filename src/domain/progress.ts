import { mulDivRound, sum } from "./money";
import type { BasisPoints, Cents, Hundredths, Unit } from "./types";

export type StageStatus = "not_started" | "active" | "paused" | "done";

export interface StageProgressInput {
  status: StageStatus;
  unit: Unit | null;
  budgetQty: Hundredths | null;
  measuredQty: Hundredths;
  manualPctBp: BasisPoints | null;
}

export const FORECAST_MIN_PCT_BP = 1_000;
export const TRENDING_TOLERANCE_BP = 500;

/** Pay rules §12. */
export function stagePercentBp(s: StageProgressInput): BasisPoints {
  if (s.status === "done") return 10_000;
  if (s.unit !== null && s.budgetQty !== null && s.budgetQty > 0) {
    return Math.min(10_000, mulDivRound(s.measuredQty, 10_000, s.budgetQty));
  }
  return s.manualPctBp ?? 0;
}

export function projectPercentBp(
  stages: readonly { pctBp: BasisPoints; labourBudgetCents: Cents }[],
): BasisPoints {
  if (stages.length === 0) return 0;
  const totalBudget = sum(stages.map((s) => s.labourBudgetCents));
  if (totalBudget === 0) return mulDivRound(sum(stages.map((s) => s.pctBp)), 1, stages.length);
  return mulDivRound(sum(stages.map((s) => s.pctBp * s.labourBudgetCents)), 1, totalBudget);
}

export function forecastLabour(status: StageStatus, pctBp: BasisPoints, actualCents: Cents): Cents | null {
  if (status === "done") return actualCents;
  if (pctBp < FORECAST_MIN_PCT_BP) return null;
  return mulDivRound(actualCents, 10_000, pctBp);
}

export type BudgetAlert = { level: "over" | "trending"; byCents: Cents } | null;

export function budgetAlert(
  actualCents: Cents,
  forecastCents: Cents | null,
  budgetCents: Cents,
): BudgetAlert {
  if (actualCents > budgetCents) return { level: "over", byCents: actualCents - budgetCents };
  if (forecastCents !== null && forecastCents * 10_000 > budgetCents * (10_000 + TRENDING_TOLERANCE_BP)) {
    return { level: "trending", byCents: forecastCents - budgetCents };
  }
  return null;
}

export interface MarginInput {
  contractCents: Cents;
  projectPctBp: BasisPoints;
  labourCostCents: Cents;
  expenseCostCents: Cents;
  materialsBudgetCents: Cents;
  materialsExpenseCents: Cents;
  stages: readonly { forecastCents: Cents | null; labourBudgetCents: Cents; actualLabourCents: Cents }[];
}

/** Pay rules §12: a stage's expected labour = forecast if it exists, else max(labour budget, actual). */
export function stageExpectedLabour(
  forecastCents: Cents | null,
  labourBudgetCents: Cents,
  actualLabourCents: Cents,
): Cents {
  return forecastCents ?? Math.max(labourBudgetCents, actualLabourCents);
}

export function projectMargins(m: MarginInput): {
  earnedValueCents: Cents;
  marginToDateCents: Cents;
  forecastMarginCents: Cents;
} {
  const earnedValueCents = mulDivRound(m.contractCents, m.projectPctBp, 10_000);
  const expectedLabour = sum(
    m.stages.map((s) => stageExpectedLabour(s.forecastCents, s.labourBudgetCents, s.actualLabourCents)),
  );
  const remainingMaterials = Math.max(m.materialsBudgetCents - m.materialsExpenseCents, 0);
  return {
    earnedValueCents,
    marginToDateCents: earnedValueCents - (m.labourCostCents + m.expenseCostCents),
    forecastMarginCents: m.contractCents - (expectedLabour + m.expenseCostCents + remainingMaterials),
  };
}
