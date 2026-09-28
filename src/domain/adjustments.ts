import type { Cents, Hundredths } from "./types";

export interface LogValues {
  quantity: Hundredths;
  hours: Hundredths;
  amountCents: Cents;
}

/** Pay rules §8: the difference an edit makes to a locked log, or null if nothing changed. */
export function adjustmentDelta(original: LogValues, edited: LogValues): LogValues | null {
  const delta = {
    quantity: edited.quantity - original.quantity,
    hours: edited.hours - original.hours,
    amountCents: edited.amountCents - original.amountCents,
  };
  return delta.quantity === 0 && delta.hours === 0 && delta.amountCents === 0 ? null : delta;
}

/** Pay rules §8: deleting a locked log. `0 - x` avoids -0. */
export function reversal(original: LogValues): LogValues {
  return {
    quantity: 0 - original.quantity,
    hours: 0 - original.hours,
    amountCents: 0 - original.amountCents,
  };
}
