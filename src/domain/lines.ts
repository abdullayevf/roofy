import { mulDivRound } from "./money";
import type { Cents, Hundredths } from "./types";

/** Pay rules §2. hours in 0.25 steps; multiplier 1.0–3.0 (default 1.0). */
export function hourlyAmount(hours: Hundredths, rateCents: Cents, multiplier: Hundredths = 100): Cents {
  if (hours <= 0 || hours % 25 !== 0) throw new RangeError("hours must be positive, in 0.25 steps");
  if (multiplier < 100 || multiplier > 300) throw new RangeError("multiplier must be between 1.0 and 3.0");
  return mulDivRound(hours * multiplier, rateCents, 10_000);
}

/** Pay rules §3. days ∈ {1, ½}. */
export function dailyAmount(days: Hundredths, rateCents: Cents): Cents {
  if (days !== 100 && days !== 50) throw new RangeError("days must be 1 or 0.5");
  return mulDivRound(days, rateCents, 100);
}

/** Pay rules §4. */
export function perUnitAmount(quantity: Hundredths, rateCents: Cents): Cents {
  if (quantity <= 0) throw new RangeError("quantity must be positive");
  return mulDivRound(quantity, rateCents, 100);
}

/** Hours pre-filled on the grid = days × standard day hours. */
export function defaultHours(days: Hundredths, standardDayHours: Hundredths): Hundredths {
  return mulDivRound(days, standardDayHours, 100);
}
