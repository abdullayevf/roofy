import type { RateBasis, Unit } from "@/domain/types";
import type { GridBasis } from "../contracts";

/**
 * Product spec §5.5: every ticked person defaults to their usual basis; per-unit workers on a stage
 * with their unit get a time-only log (pay rules §4, E4.4). Lump-sum stages are no exception: a
 * time-paid person logged on one gets their usual basis, and the double-pay flag (pay rules §9)
 * catches time-based + lump-sum on the same stage and date.
 * `timeOnly` = the manager switched this person to time-only on the grid (e.g. Sam on the Smith
 * sheet install, paid from progress).
 *
 * Prototype decision (not in the spec): a per-unit worker on a stage without their unit falls back
 * to their daily rate, so the grid never pays them $0 for a real day's work there. With no stage
 * chosen yet, a per-unit worker shows as time-only (the usual case on their own unit's stage).
 */
export function gridBasisFor(
  crew: { defaultBasis: RateBasis; defaultUnit: Unit | null },
  stageUnit: Unit | null | undefined,
  timeOnly = false,
): GridBasis {
  if (timeOnly) return "time_only";
  if (crew.defaultBasis === "per_unit") {
    if (stageUnit === undefined) return "time_only";
    return stageUnit !== null && stageUnit === crew.defaultUnit ? "time_only" : "daily";
  }
  return crew.defaultBasis;
}
