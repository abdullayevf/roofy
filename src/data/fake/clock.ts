import { todayIn } from "@/domain/dates";
import type { LocalDate } from "@/domain/types";

/** Mon 28 Sep 2026, 7:00 a.m. in Sydney — a Sunday in UTC, so the timezone rule is always exercised. */
export const DEFAULT_FAKE_NOW = "2026-09-27T21:00:00Z";

/** The seeded workspace's timezone (Harbour Roofing). */
export const FAKE_TIMEZONE = "Australia/Sydney";

/** The fake-mode instant: `ROOFY_FAKE_NOW` when set, else `DEFAULT_FAKE_NOW`. A new Date each call. */
export function fakeNow(): Date {
  const raw = process.env.ROOFY_FAKE_NOW || DEFAULT_FAKE_NOW;
  const now = new Date(raw);
  if (Number.isNaN(now.getTime())) throw new RangeError(`ROOFY_FAKE_NOW is not a valid instant: "${raw}"`);
  return now;
}

/** The workspace's work date at `fakeNow()`. Never the server's local date. */
export function fakeToday(): LocalDate {
  return todayIn(FAKE_TIMEZONE, fakeNow());
}
