// Words and the date range for Reports (flows.md screen 22). A plain module, so server pages and client parts share it.
import type { DateRange, ReportKind } from "@/data/contracts";
import { addDays } from "@/domain/dates";
import { formatHours } from "@/lib/format";
import { payRunPeriodText } from "./pay-runs-text";

export const REPORT_KINDS: readonly ReportKind[] = ["job-profitability", "crew", "productivity", "pauses", "pay-history"];

const TITLES: Record<ReportKind, string> = {
  "job-profitability": "Job profitability",
  crew: "Crew",
  productivity: "Productivity",
  pauses: "Pauses",
  "pay-history": "Pay history",
};

export const isReportKind = (kind: string): kind is ReportKind => (REPORT_KINDS as readonly string[]).includes(kind);
export const reportTitle = (kind: ReportKind): string => TITLES[kind];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date written yyyy-mm-dd (the value a date input sends), or null. */
function readDate(value: string | undefined): string | null {
  const m = value ? ISO.exec(value) : null;
  if (!m) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value!;
}

/**
 * The default range: the last 3 months, ending today (the day after the same date 3 months back, so the range is
 * exactly 3 months). A pay period (one week) is too short to show a job's margin or a crew member's month.
 */
export function defaultReportRange(today: string): DateRange {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const month = m - 3 < 1 ? m + 9 : m - 3;
  const year = m - 3 < 1 ? y - 1 : y;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const back = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
  return { from: addDays(back, 1), to: today };
}

/** The range from `?from=&to=`; unreadable dates fall back to the default, a range given back to front is swapped. */
export function readReportRange(today: string, params: { from?: string; to?: string }): { range: DateRange; chosen: boolean } {
  const fallback = defaultReportRange(today);
  const from = readDate(params.from);
  const to = readDate(params.to);
  if (!from && !to) return { range: fallback, chosen: false };
  const a = from ?? fallback.from;
  const b = to ?? today;
  return { range: a <= b ? { from: a, to: b } : { from: b, to: a }, chosen: true };
}

export const rangeText = (range: DateRange, today: string): string => payRunPeriodText({ start: range.from, end: range.to }, today);

/** Basis points as a percent, two places when not whole (lesson 14). */
export function marginText(bp: number | null): string {
  if (bp === null) return "No contract price";
  const abs = Math.abs(bp);
  const body = abs % 100 === 0 ? String(abs / 100) : `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return `${bp < 0 ? "−" : ""}${body}%`;
}

export const countText = (n: number, word: string): string => `${n} ${n === 1 ? word : `${word}s`}`;

export const crewWorkText = (days: number, hours: number): string =>
  `${countText(days, "day")}, ${formatHours(hours).replace(" ", " ")}`;
