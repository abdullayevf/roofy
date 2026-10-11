// Words and the date range for Reports (flows.md screen 22). A plain module, so server pages and client parts share it.
import type { DateRange, ProductivityRow, ReportKeyFigure, ReportKind, Unit } from "@/data/contracts";
import type { PauseReason } from "@/domain/segments";
import { addDays } from "@/domain/dates";
import { formatDate, formatHours, formatMoney, formatPace } from "@/lib/format";
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-09" as "September 2026". */
export function monthText(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Export CSV for the range on screen (the route answers with the data layer's `reports.csv`). */
export const reportCsvHref = (kind: ReportKind, range: DateRange): string => `/reports/${kind}/csv?from=${range.from}&to=${range.to}`;

export const workingDaysText = (n: number): string => countText(n, "working day");

/** Units laid per crew-day ("42.5 m² a crew-day"). */
export const perCrewDayText = (perCrewDay: number, unit: Unit): string => `${formatPace(perCrewDay, unit)} a crew-day`;

/** A figure and its unit apart, so a narrow right column keeps the figure on one line and the unit on the line below. */
export type FigureParts = { figure: string; unit: string };

export function keyFigureParts(f: ReportKeyFigure): FigureParts {
  if (f.format === "per-crew-day") return { figure: formatPace(f.value, f.unit), unit: "a crew-day" };
  if (f.format === "money") return { figure: formatMoney(f.value), unit: "" };
  return { figure: String(f.value), unit: f.value === 1 ? "working day" : "working days" };
}

/** A report's key figure as one phrase: money, working days, or a pace per crew-day. */
export function keyFigureText(f: ReportKeyFigure): string {
  const { figure, unit } = keyFigureParts(f);
  return unit ? `${figure} ${unit}` : figure;
}

/** A productivity row's label: the month when the row covers all of it, else the chosen range. */
export function periodText(r: Pick<ProductivityRow, "month" | "period">, today: string): string {
  const whole = r.period.from === `${r.month}-01` && r.period.to.slice(0, 7) === r.month && addDays(r.period.to, 1).slice(0, 7) !== r.month;
  return whole ? monthText(r.month) : rangeText(r.period, today);
}

/** When a stage was paused inside the range: "Mon 14 Sep to Wed 16 Sep", or one date for a one-day pause (F6). */
export function pauseDatesText(r: { start: string; end: string }, today: string): string {
  return r.start === r.end ? formatDate(r.start, today).replace(/ /g, "\u00a0") : rangeText({ from: r.start, to: r.end }, today);
}

/** The line under the pay history key figure for runs still in draft: listed, but never in the paid total (D25/F5). */
export const draftCaption = (draftCents: number, draftRuns: number): string => `${formatMoney(draftCents)} in ${draftCaptionTail(draftRuns)}`;

/** The words after the amount in the draft caption, so the page can set the amount in figure style. */
export const draftCaptionTail = (draftRuns: number): string => `${draftRuns === 1 ? "a draft" : "drafts"}, not yet paid`;

const PAUSE_LINE: Record<PauseReason, string> = {
  weather: "Held up by weather",
  materials: "Waiting on materials",
  client: "Waiting on the client",
  other_job: "Crew on another job",
  other: "Another reason",
};

/** Why a stage was paused, as a line that reads on its own ("Waiting on materials"), not a bare "Materials". */
export const pauseReasonLine = (reason: PauseReason): string => PAUSE_LINE[reason];
