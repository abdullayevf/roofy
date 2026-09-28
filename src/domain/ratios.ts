import { mulDivRound } from "./money";
import type { BasisPoints, Cents, Hundredths } from "./types";

/**
 * Ratios the screens show (over marker, margin %, utilisation, cost per m², m² per crew-day).
 * Kept here so no layer outside `src/domain` divides money or quantities.
 */

/** part ÷ whole in basis points (half away from zero); null when whole ≤ 0. */
export function ratioBp(part: number, whole: number): BasisPoints | null {
  if (whole <= 0) return null;
  return mulDivRound(part, 10_000, whole);
}

/** Cost of one whole unit: cents ÷ (quantity in hundredths ÷ 100); null without a quantity. */
export function centsPerUnit(cents: Cents, quantity: Hundredths): Cents | null {
  if (quantity <= 0) return null;
  return mulDivRound(cents, 100, quantity);
}

/** Quantity (hundredths) per day; null without any days. */
export function quantityPerDay(quantity: Hundredths, days: number): Hundredths | null {
  if (days <= 0) return null;
  return mulDivRound(quantity, 1, days);
}
