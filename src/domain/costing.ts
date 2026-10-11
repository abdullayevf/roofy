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

/** Why a labour line costs the job more than the pay (the same branches as labourCost): on-cost for employees, GST for a GST-registered contractor in an unregistered workspace. */
export type LabourCostExtra = { kind: "on_cost"; onCostBp: BasisPoints } | { kind: "gst" } | null;

export function labourCostExtra(worker: { type: WorkerType; gstRegistered: boolean }, ctx: CostContext): LabourCostExtra {
  if (worker.type === "employee") return ctx.onCostBp > 0 ? { kind: "on_cost", onCostBp: ctx.onCostBp } : null;
  if (worker.gstRegistered && !ctx.workspaceGstRegistered) return { kind: "gst" };
  return null;
}

export function expenseCost(exGstCents: Cents, gstCents: Cents, workspaceGstRegistered: boolean): Cents {
  return workspaceGstRegistered ? exGstCents : exGstCents + gstCents;
}
