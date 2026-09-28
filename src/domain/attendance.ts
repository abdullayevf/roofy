import { dayOfWeek, eachDay } from "./dates";
import { mulDivRound } from "./money";
import type { BasisPoints, LocalDate } from "./types";

export type NoWorkReason = "rain" | "leave" | "sick" | "other";

export interface CrewActive {
  crewMemberId: string;
  activeFrom: LocalDate;
  /** Inclusive. */
  activeTo: LocalDate | null;
}

export interface AttendanceInput {
  start: LocalDate;
  endExclusive: LocalDate;
  workingDays: readonly number[];
  loggedDays: ReadonlySet<string>;
  noWork: ReadonlyMap<string, NoWorkReason>;
}

export const dayKey = (crewMemberId: string, date: LocalDate): string => `${crewMemberId}|${date}`;

function activeWorkingDays(input: AttendanceInput, c: CrewActive): LocalDate[] {
  return eachDay(input.start, input.endExclusive).filter(
    (d) =>
      input.workingDays.includes(dayOfWeek(d)) &&
      d >= c.activeFrom &&
      (c.activeTo === null || d <= c.activeTo),
  );
}

/** Pay rules §14. */
export function findGaps(
  input: AttendanceInput,
  crew: readonly CrewActive[],
): { crewMemberId: string; date: LocalDate }[] {
  return crew.flatMap((c) =>
    activeWorkingDays(input, c)
      .filter(
        (d) =>
          !input.loggedDays.has(dayKey(c.crewMemberId, d)) && !input.noWork.has(dayKey(c.crewMemberId, d)),
      )
      .map((date) => ({ crewMemberId: c.crewMemberId, date })),
  );
}

/** Pay rules §14: leave/sick reduce availability; rain/other do not; only working days count as worked. */
export function utilisation(
  input: AttendanceInput,
  c: CrewActive,
): { availableDays: number; workedDays: number; bp: BasisPoints | null } {
  const days = activeWorkingDays(input, c);
  const away = (d: LocalDate) => {
    const reason = input.noWork.get(dayKey(c.crewMemberId, d));
    return reason === "leave" || reason === "sick";
  };
  const availableDays = days.filter((d) => !away(d)).length;
  const workedDays = days.filter((d) => input.loggedDays.has(dayKey(c.crewMemberId, d))).length;
  return {
    availableDays,
    workedDays,
    bp: availableDays === 0 ? null : mulDivRound(workedDays, 10_000, availableDays),
  };
}
