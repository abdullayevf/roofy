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
      const rate =
        f.basis === "per_unit" && f.unit ? (f.unit === "each" ? "rate each" : `rate per ${UNIT_WORD[f.unit]}`) : f.basis === "daily" ? "day rate" : f.basis === "hourly" ? "hourly rate" : "rate";
      const day = f.dates.length > 0 ? `${datesText(f.dates, today)} pays` : "it pays";
      const stage = f.stageName ? ` for ${f.stageName}` : "";
      return `${who} has no ${rate}${stage}, so ${day} ${formatMoney(0)}.`;
    }
    case "owner_2fa_off":
      return "Turn on two-factor before you approve a pay run.";
    case "below_floor":
      return f.floor
        ? `${who} earns ${formatMoney(f.floor.effectiveHourlyCents)} an hour this week, under the ${formatMoney(f.floor.floorRateCents)} award floor, so ${who} is ${formatMoney(f.floor.shortfallCents)} short for the week.`
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

/** "Late entry" / "Adjustment" (pay rules §8) under the line's date, which the row already shows; null for a normal line. */
export function lineLabelText(l: PayLineDto): string | null {
  if (l.label === "late") return "Late entry";
  if (l.label === "adjustment") return "Adjustment";
  return null;
}

/**
 * A $0.00 "hours logged, paid by output" line folds into the same day's output line on the same stage (its hours
 * shown there), so no row looks unpaid. One with no output line to fold into keeps its own row.
 */
export function foldTimeOnlyLines(lines: readonly PayLineDto[]): { line: PayLineDto; loggedHours: number | null; foldedIds: string[] }[] {
  const isOutput = (l: PayLineDto) => l.basis === "per_unit" || l.basis === "lump_sum";
  const host = (t: PayLineDto) => lines.find((l) => isOutput(l) && l.date === t.date && l.stageId === t.stageId && l.label === t.label);
  const folds = new Map<string, PayLineDto[]>();
  for (const t of lines) {
    const h = t.basis === "time_only" && t.amountCents === 0 ? host(t) : undefined;
    if (h) folds.set(h.logId, [...(folds.get(h.logId) ?? []), t]);
  }
  const folded = new Set([...folds.values()].flat().map((t) => t.logId));
  return lines
    .filter((l) => !folded.has(l.logId))
    .map((l) => {
      const ts = folds.get(l.logId) ?? [];
      return { line: l, loggedHours: ts.length > 0 ? ts.reduce((a, t) => a + t.hours, 0) : null, foldedIds: ts.map((t) => t.logId) };
    });
}

/** Under a person's name: employee, or contractor with ABN and GST registration, one fact per line. */
export function personKindLines(p: PayPersonGroup): string[] {
  if (p.type !== "contractor") return ["Employee"];
  return [p.abn ? `Contractor, ABN ${p.abn}` : "Contractor", p.gstRegistered ? "Registered for GST" : "Not registered for GST"];
}

/**
 * A person's totals (pay rules §6–7): GST only for a contractor registered for it (a statement, which doesn't carry
 * registration, shows it when there is any), reimbursements only when there are any, and Total only when it differs
 * from Pay.
 */
export function personTotalRows(
  p: Pick<PayPersonGroup, "type" | "totals"> & { gstRegistered?: boolean },
): { label: string; cents: number }[] {
  const gst = p.type === "contractor" && (p.gstRegistered ?? p.totals.gstCents !== 0);
  const extras = [
    ...(gst ? [{ label: "GST", cents: p.totals.gstCents }] : []),
    ...(p.totals.reimbursementsCents !== 0 ? [{ label: "Reimbursements", cents: p.totals.reimbursementsCents }] : []),
  ];
  if (extras.length === 0) return [{ label: "Pay", cents: p.totals.subtotalCents }];
  return [
    { label: p.type === "contractor" ? "Subtotal" : "Pay", cents: p.totals.subtotalCents },
    ...extras,
    { label: "Total", cents: p.totals.totalCents },
  ];
}
