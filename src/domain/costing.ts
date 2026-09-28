import { gstOn } from "./gst";
import { mulDivRound } from "./money";
import type { BasisPoints, Cents, WorkerType } from "./types";

export interface CostContext {
  workspaceGstRegistered: boolean;
  onCostBp: BasisPoints;
}

/** Pay rules §11. */
export function labourCost(
  amountCents: Cents,
  worker: { type: WorkerType; gstRegistered: boolean },
  ctx: CostContext,
): Cents {
  if (worker.type === "employee") return mulDivRound(amountCents, 10_000 + ctx.onCostBp, 10_000);
  if (worker.gstRegistered && !ctx.workspaceGstRegistered) return amountCents + gstOn(amountCents);
  return amountCents;
}

export function expenseCost(exGstCents: Cents, gstCents: Cents, workspaceGstRegistered: boolean): Cents {
  return workspaceGstRegistered ? exGstCents : exGstCents + gstCents;
}
