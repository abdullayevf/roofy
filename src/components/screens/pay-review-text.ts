import type { PayFlag, PayLineDto, PayPersonGroup } from "@/data/contracts";
import { formatDate, formatDays, formatHours, formatMoney, formatQuantity } from "@/lib/format";

const UNIT_WORD = { m2: "m²", lm: "lm", each: "each" } as const;

/** "Wed 23 Sep" or "Thu 24 Sep and Fri 25 Sep" (three or more: "Mon 21 Sep, Tue 22 Sep and Wed 23 Sep"). */
function datesText(dates: string[], today: string): string {
  const words = dates.map((d) => formatDate(d, today));
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const on = (stage: string | null) => (stage ? ` on ${stage}` : "");
const onDates = (dates: string[], today: string) => (dates.length > 0 ? ` on ${datesText(dates, today)}` : "");

/** One plain sentence per pay-run flag (flows.md 224 for the two that stop approval). */
export function flagText(f: PayFlag, today: string): string {
  const who = f.crewName ?? "Someone";
  switch (f.kind) {
    case "missing_rate": {
      const unit = f.basis === "per_unit" && f.unit ? `${UNIT_WORD[f.unit]} ` : f.basis === "daily" ? "day " : f.basis === "hourly" ? "hourly " : "";
      const day = f.dates.length > 0 ? `${datesText(f.dates, today)} pays` : "it pays";
      return `No ${unit}rate for ${who}${on(f.stageName)}, so ${day} ${formatMoney(0)}. Fix the missing rate before you approve.`;
    }
    case "owner_2fa_off":
      return "Turn on two-factor before you approve a pay run.";
    case "below_floor":
      return f.floor
        ? `${who} earns ${formatMoney(f.floor.effectiveHourlyCents)} an hour this week, under the ${formatMoney(f.floor.floorRateCents)} award floor (short ${formatMoney(f.floor.shortfallCents)}).`
        : `${who} earns under the award floor this week.`;
    case "double_pay":
      return `${who} has time pay and output pay${on(f.stageName)}${onDates(f.dates, today)}.`;
    case "paused_stage":
      return `${who} is logged${on(f.stageName)}${onDates(f.dates, today)}, when the stage was paused or done.`;
    case "gap":
      return `Nothing logged for ${who}${onDates(f.dates, today)}.`;
    case "possible_duplicate":
      return `${who} may be logged twice${on(f.stageName)}${onDates(f.dates, today)}.`;
    case "no_hours":
      return `${who} has no hours logged, so the award floor can't be checked.`;
  }
}

/** Where a flag taps through to: its first line on this page, else the person's group, else the place to fix it. */
export function flagTarget(f: PayFlag): string | null {
  if (f.logIds[0]) return `#line-${f.logIds[0]}`;
  if (f.crewMemberId) return `#crew-${f.crewMemberId}`;
  return f.href;
}

/** "1.5" from 150 hundredths, without floating point. */
function times(m: number): string {
  const whole = Math.trunc(m / 100);
  const rest = m % 100;
  return rest === 0 ? `${whole}` : `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}`;
}

/** What a line pays for, split so the rate can be set in the figure font: lead, rate, tail. */
export function lineBasisParts(l: PayLineDto): { lead: string; rateCents: number | null; tail: string } {
  if (l.basis === "time_only") return { lead: `${formatHours(l.hours)} logged, paid by output`, rateCents: null, tail: "" };
  if (l.basis === "lump_sum") return { lead: "Share of a lump sum", rateCents: null, tail: "" };
  const qty =
    l.basis === "hourly"
      ? formatHours(l.quantity)
      : l.basis === "daily"
        ? `${formatDays(l.quantity)}${l.hours > 0 ? ` (${formatHours(l.hours)})` : ""}`
        : formatQuantity(l.quantity, l.unit ?? "each");
  if (l.rateCents === null) return { lead: `${qty}, no rate`, rateCents: null, tail: "" };
  const per = l.basis === "hourly" ? " an hour" : l.basis === "daily" ? " a day" : l.unit === "each" || !l.unit ? " each" : ` per ${UNIT_WORD[l.unit]}`;
  const mult = l.basis === "hourly" && l.multiplier !== null && l.multiplier !== 100 ? ` × ${times(l.multiplier)}` : "";
  return { lead: `${qty} at `, rateCents: l.rateCents, tail: `${per}${mult}` };
}

export function lineBasisText(l: PayLineDto): string {
  const p = lineBasisParts(l);
  return `${p.lead}${p.rateCents === null ? "" : formatMoney(p.rateCents)}${p.tail}`;
}

/** "Late entry for Mon 14 Sep" / "Adjustment for Thu 17 Sep" (pay rules §8); null for a normal line. */
export function lineLabelText(l: PayLineDto, today: string): string | null {
  if (l.label === "late") return `Late entry for ${formatDate(l.date, today)}`;
  if (l.label === "adjustment") return `Adjustment for ${formatDate(l.date, today)}`;
  return null;
}

/** Under a person's name: employee, or contractor with ABN and GST registration, one fact per line. */
export function personKindLines(p: PayPersonGroup): string[] {
  if (p.type !== "contractor") return ["Employee"];
  return [p.abn ? `Contractor, ABN ${p.abn}` : "Contractor", p.gstRegistered ? "Registered for GST" : "Not registered for GST"];
}

/** A person's totals (pay rules §6–7): contractors show subtotal and GST; reimbursements only when there are any. */
export function personTotalRows(p: Pick<PayPersonGroup, "type" | "totals">): { label: string; cents: number }[] {
  const rows = [{ label: p.type === "contractor" ? "Subtotal" : "Pay", cents: p.totals.subtotalCents }];
  if (p.type === "contractor") rows.push({ label: "GST", cents: p.totals.gstCents });
  if (p.totals.reimbursementsCents !== 0) rows.push({ label: "Reimbursements", cents: p.totals.reimbursementsCents });
  rows.push({ label: "Total", cents: p.totals.totalCents });
  return rows;
}
