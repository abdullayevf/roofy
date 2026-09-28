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

export interface ReceiptAmounts {
  amountExGstCents: Cents;
  gstCents: Cents;
}

/** Product spec §5.7: a GST-inclusive receipt stored as ex GST + GST. GST defaults to total ÷ 11. */
export function splitReceipt(totalCents: Cents, gstCents: Cents = gstIncludedIn(totalCents)): ReceiptAmounts {
  if (gstCents < 0 || gstCents > totalCents) throw new RangeError("GST must be between 0 and the total");
  return { amountExGstCents: totalCents - gstCents, gstCents };
}

/** What was paid (pay rules §7: a reimbursement is the GST-inclusive amount). */
export function receiptTotal(r: ReceiptAmounts): Cents {
  return r.amountExGstCents + r.gstCents;
}
