import { mulDivRound } from "./money";
import type { Cents, WorkerType } from "./types";

export const GST_RATE_BP = 1000;

export function gstOn(exGstCents: Cents): Cents {
  return mulDivRound(exGstCents, GST_RATE_BP, 10_000);
}

/** GST contained in a GST-inclusive total (total ÷ 11). */
export function gstIncludedIn(totalCents: Cents): Cents {
  return mulDivRound(totalCents, 1, 11);
}

export interface PersonTotals {
  subtotalCents: Cents;
  gstCents: Cents;
  reimbursementsCents: Cents;
  totalCents: Cents;
}

/** Pay rules §6–§7. */
export function personTotals(
  person: { type: WorkerType; gstRegistered: boolean },
  subtotalCents: Cents,
  reimbursementsCents: Cents,
): PersonTotals {
  const gstCents = person.type === "contractor" && person.gstRegistered ? gstOn(subtotalCents) : 0;
  return {
    subtotalCents,
    gstCents,
    reimbursementsCents,
    totalCents: subtotalCents + gstCents + reimbursementsCents,
  };
}
