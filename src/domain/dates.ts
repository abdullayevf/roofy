import type { LocalDate } from "./types";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function toUtc(d: LocalDate): Date {
  const m = ISO.exec(d);
  if (!m) throw new RangeError(`Invalid date: ${d}`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.toISOString().slice(0, 10) !== d) throw new RangeError(`Invalid date: ${d}`);
  return date;
}

const fromUtc = (date: Date): LocalDate => date.toISOString().slice(0, 10);

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(new Date(toUtc(d).getTime() + n * DAY_MS));
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(d: LocalDate): number {
  return toUtc(d).getUTCDay();
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / DAY_MS);
}

export function eachDay(start: LocalDate, endExclusive: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = start; d < endExclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

export function countWorkingDays(
  start: LocalDate,
  endExclusive: LocalDate,
  workingDays: readonly number[],
): number {
  return eachDay(start, endExclusive).filter((d) => workingDays.includes(dayOfWeek(d))).length;
}

/** The calendar date in `timeZone` at instant `now`. Never use the server's local date. */
export function todayIn(timeZone: string, now: Date): LocalDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
