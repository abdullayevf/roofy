import { parseDecimal } from "@/domain/money";
import type { Cents, PayFrequency } from "@/data/contracts";

/** flows.md "Settings changes": a floor of $0.00, blank or unreadable is refused with this sentence. */
export const FLOOR_MISSING = "Add a floor rate before saving.";
export const CODE_HINT = "Enter the 6-digit code from your app.";
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const ON_COST_RANGE = "On-cost is between 0% and 100%.";

/** On-cost percent text to basis points; blank or unreadable is never 0%. */
export function readOnCost(text: string): { bp: number } | { error: string } {
  const raw = text.replace(/[%\s]/g, "");
  if (raw === "") return { error: "Add an on-cost percent before saving." };
  let bp: number;
  try {
    bp = parseDecimal(raw, 2);
  } catch {
    return { error: "Enter a percent, like 18.5." };
  }
  if (bp < 0 || bp > 10_000) return { error: ON_COST_RANGE };
  return { bp };
}

/** Basis points as percent text: whole, else up to two places (lesson: 30.49%, not 30%). */
export function bpText(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const rest = Math.abs(bp % 100);
  if (rest === 0) return String(whole);
  return `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}`;
}

/** A floor rate field's error: blank, unreadable and $0.00 (or less) are all refused. */
export function floorError(cents: Cents | null | "unreadable"): string | undefined {
  return typeof cents === "number" && cents > 0 ? undefined : FLOOR_MISSING;
}

/** Standard day hours text to hundredths. */
export function readHours(text: string): { hours: number } | { error: string } {
  const raw = text.trim();
  if (raw === "") return { error: "Add the hours in a standard day." };
  let hours: number;
  try {
    hours = parseDecimal(raw, 2);
  } catch {
    return { error: "Enter hours, like 7.6." };
  }
  if (hours <= 0) return { error: "A standard day needs some hours." };
  if (hours > 2400) return { error: "A day has at most 24 hours." };
  return { hours };
}

/** A two-factor code from an authenticator app: six digits, spaces ignored. */
export function readCode(text: string): { code: string } | { error: string } {
  const code = text.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? { code } : { error: CODE_HINT };
}

export function payPeriodText(frequency: PayFrequency, weekStart: number): string {
  return `${frequency === "weekly" ? "Weekly" : "Fortnightly"}, starting ${WEEKDAYS[weekStart]}`;
}

/** The pay-period anchor moved back (0–6 days) to the chosen start weekday; calendar maths only. */
export function anchorOn(anchor: string, weekday: number): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  const back = (d.getUTCDay() - weekday + 7) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
