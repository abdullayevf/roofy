import { mulDivRound } from "./money";
import type { Cents, Hundredths } from "./types";

export interface FloorResult {
  effectiveHourlyCents: Cents | null;
  below: boolean;
  shortfallCents: Cents;
}

/** Pay rules §10. Compares exactly (not via the rounded effective rate). */
export function floorCheck(earningsCents: Cents, hours: Hundredths, floorHourlyCents: Cents): FloorResult {
  if (hours <= 0) return { effectiveHourlyCents: null, below: false, shortfallCents: 0 };
  const requiredX100 = floorHourlyCents * hours;
  const earnedX100 = earningsCents * 100;
  const below = earnedX100 < requiredX100;
  return {
    effectiveHourlyCents: mulDivRound(earningsCents, 100, hours),
    below,
    shortfallCents: below ? mulDivRound(requiredX100 - earnedX100, 1, 100) : 0,
  };
}
