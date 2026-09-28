import { describe, expect, it } from "vitest";
import { dayKey, findGaps, utilisation, type AttendanceInput } from "./attendance";

const jake = { crewMemberId: "jake", activeFrom: "2026-01-01", activeTo: null };
const week = (
  logged: string[],
  noWork: [string, "rain" | "leave" | "sick" | "other"][],
): AttendanceInput => ({
  start: "2026-09-14",
  endExclusive: "2026-09-21",
  workingDays: [1, 2, 3, 4, 5],
  loggedDays: new Set(logged.map((d) => dayKey("jake", d))),
  noWork: new Map(noWork.map(([d, r]) => [dayKey("jake", d), r])),
});

describe("attendance", () => {
  it("E14.1 Mon–Wed logged, Thu rain, Fri nothing → gap Fri, utilisation 60%", () => {
    const input = week(["2026-09-14", "2026-09-15", "2026-09-16"], [["2026-09-17", "rain"]]);
    expect(findGaps(input, [jake])).toEqual([{ crewMemberId: "jake", date: "2026-09-18" }]);
    expect(utilisation(input, jake)).toEqual({ availableDays: 5, workedDays: 3, bp: 6000 });
  });
  it("leave and sick days reduce available days; weekend logs do not count", () => {
    const input = week(
      ["2026-09-14", "2026-09-19"],
      [
        ["2026-09-15", "leave"],
        ["2026-09-16", "sick"],
      ],
    );
    expect(utilisation(input, jake)).toEqual({ availableDays: 3, workedDays: 1, bp: 3333 });
  });
  it("ignores days outside a crew member's active range", () => {
    const left = { crewMemberId: "jake", activeFrom: "2026-01-01", activeTo: "2026-09-16" };
    expect(findGaps(week(["2026-09-14", "2026-09-15", "2026-09-16"], []), [left])).toEqual([]);
    const notYet = { crewMemberId: "jake", activeFrom: "2026-10-01", activeTo: null };
    expect(utilisation(week([], []), notYet)).toEqual({ availableDays: 0, workedDays: 0, bp: null });
  });
});
