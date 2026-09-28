import { addDays, countWorkingDays } from "./dates";
import { sum } from "./money";
import type { LocalDate } from "./types";

export type PauseReason = "weather" | "materials" | "client" | "other_job" | "other";

/** Half-open [start, end). pauseReason = why this segment ended (null if Done or still open). */
export interface StageSegment {
  start: LocalDate;
  end: LocalDate | null;
  pauseReason: PauseReason | null;
}

export interface PausePeriod {
  start: LocalDate;
  end: LocalDate;
  reason: PauseReason;
  ongoing: boolean;
}

export const PAUSED_TOO_LONG_DAYS = 5;

const byStart = (segments: readonly StageSegment[]) =>
  [...segments].sort((a, b) => a.start.localeCompare(b.start));

export function isActiveOn(segments: readonly StageSegment[], date: LocalDate): boolean {
  return segments.some((s) => s.start <= date && (s.end === null || date < s.end));
}

export function realWorkingDays(
  segments: readonly StageSegment[],
  workingDays: readonly number[],
  asOf: LocalDate,
): number {
  return sum(segments.map((s) => countWorkingDays(s.start, s.end ?? addDays(asOf, 1), workingDays)));
}

export function pausePeriods(segments: readonly StageSegment[], asOf: LocalDate): PausePeriod[] {
  const sorted = byStart(segments);
  return sorted.flatMap((s, i) => {
    if (s.end === null || s.pauseReason === null) return [];
    const next = sorted[i + 1];
    return [
      { start: s.end, end: next ? next.start : addDays(asOf, 1), reason: s.pauseReason, ongoing: !next },
    ];
  });
}

export function lostWorkingDays(
  segments: readonly StageSegment[],
  workingDays: readonly number[],
  asOf: LocalDate,
): Record<PauseReason, number> {
  const lost: Record<PauseReason, number> = { weather: 0, materials: 0, client: 0, other_job: 0, other: 0 };
  for (const p of pausePeriods(segments, asOf))
    lost[p.reason] += countWorkingDays(p.start, p.end, workingDays);
  return lost;
}

export function pausedTooLong(
  segments: readonly StageSegment[],
  workingDays: readonly number[],
  asOf: LocalDate,
): boolean {
  const ongoing = pausePeriods(segments, asOf).find((p) => p.ongoing);
  return (
    ongoing !== undefined && countWorkingDays(ongoing.start, ongoing.end, workingDays) > PAUSED_TOO_LONG_DAYS
  );
}
