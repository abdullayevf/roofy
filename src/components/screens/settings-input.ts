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

const SHARE_BLANK = "Add a share, or 0 if the stage has none.";

/** A template share as percent text to basis points; blank or unreadable is never 0%. */
export function readShare(text: string): { bp: number } | { error: string } {
  const raw = text.replace(/[%\s]/g, "");
  if (raw === "") return { error: SHARE_BLANK };
  let bp: number;
  try {
    bp = parseDecimal(raw, 2);
  } catch {
    return { error: "Enter a percent, like 25." };
  }
  if (bp < 0 || bp > 10_000) return { error: "A share is between 0% and 100%." };
  return { bp };
}

/** The two totals a template must reach: labour 100%; materials 100% or every stage 0%. Messages name the total they got. */
export function shareErrors(labour: number[], materials: number[]): { labour?: string; materials?: string } {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const out: { labour?: string; materials?: string } = {};
  if (sum(labour) !== 10_000) out.labour = `Labour shares must add up to 100%. They add up to ${bpText(sum(labour))}%.`;
  if (![0, 10_000].includes(sum(materials)))
    out.materials = `Materials shares must add up to 100%, or all be 0%. They add up to ${bpText(sum(materials))}%.`;
  return out;
}

/** The longest expense category name the server keeps (`categorySchema`). */
export const CATEGORY_NAME_MAX = 60;

/** The same sentence the server gives for a name that is too long, shown on the field before saving. */
export function nameLengthError(name: string, max: number): string | undefined {
  return name.trim().length > max ? `Keep it under ${max} characters.` : undefined;
}
