import { describe, expect, it } from "vitest";
import {
  isActiveOn,
  lostWorkingDays,
  pausedTooLong,
  pausePeriods,
  realWorkingDays,
  type StageSegment,
} from "./segments";

const MON_FRI = [1, 2, 3, 4, 5];
// E13.1: active Mon 7–Wed 9, paused Thu 10 (weather), resumed Tue 15, Done Thu 17 (end = 18).
const sheetInstall: StageSegment[] = [
  { start: "2026-09-15", end: "2026-09-18", pauseReason: null },
  { start: "2026-09-07", end: "2026-09-10", pauseReason: "weather" },
];

describe("segments", () => {
  it("E13.1 real working days = 6", () => {
    expect(realWorkingDays(sheetInstall, MON_FRI, "2026-09-30")).toBe(6);
  });
  it("E13.1 days lost to weather = 3", () => {
    expect(lostWorkingDays(sheetInstall, MON_FRI, "2026-09-30")).toEqual({
      weather: 3,
      materials: 0,
      client: 0,
      other_job: 0,
      other: 0,
    });
  });
  it("knows whether a stage was active on a date", () => {
    expect(isActiveOn(sheetInstall, "2026-09-09")).toBe(true);
    expect(isActiveOn(sheetInstall, "2026-09-10")).toBe(false);
    expect(isActiveOn(sheetInstall, "2026-09-17")).toBe(true);
    expect(isActiveOn(sheetInstall, "2026-09-18")).toBe(false);
    expect(isActiveOn([{ start: "2026-09-01", end: null, pauseReason: null }], "2027-01-01")).toBe(true);
    expect(isActiveOn([], "2026-09-01")).toBe(false);
  });
  it("counts an open segment up to and including asOf", () => {
    expect(
      realWorkingDays([{ start: "2026-09-28", end: null, pauseReason: null }], MON_FRI, "2026-09-30"),
    ).toBe(3);
  });
  it("reports an ongoing pause and whether it is too long (> 5 working days)", () => {
    const paused: StageSegment[] = [{ start: "2026-09-21", end: "2026-09-22", pauseReason: "materials" }];
    expect(pausePeriods(paused, "2026-09-28")).toEqual([
      { start: "2026-09-22", end: "2026-09-29", reason: "materials", ongoing: true },
    ]);
    expect(pausedTooLong(paused, MON_FRI, "2026-09-28")).toBe(false);
    expect(pausedTooLong(paused, MON_FRI, "2026-09-29")).toBe(true);
    expect(pausedTooLong(sheetInstall, MON_FRI, "2026-09-30")).toBe(false);
  });
});
