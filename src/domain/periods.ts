import { addDays, dayOfWeek, daysBetween } from "./dates";
import type { LocalDate } from "./types";

export type PayFrequency = "weekly" | "fortnightly";

/** Inclusive start and end. */
export interface PayPeriod {
  start: LocalDate;
  end: LocalDate;
}

export function payPeriodContaining(
  date: LocalDate,
  cfg: { frequency: PayFrequency; weekStartDay: number; anchor: LocalDate },
): PayPeriod {
  const length = cfg.frequency === "weekly" ? 7 : 14;
  const origin = addDays(cfg.anchor, -((dayOfWeek(cfg.anchor) - cfg.weekStartDay + 7) % 7));
  const k = Math.floor(daysBetween(origin, date) / length);
  const start = addDays(origin, k * length);
  return { start, end: addDays(start, length - 1) };
}
