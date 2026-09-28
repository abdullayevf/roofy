import { describe, expect, it } from "vitest";
import { addDays, countWorkingDays, dayOfWeek, daysBetween, eachDay, todayIn } from "./dates";

const MON_FRI = [1, 2, 3, 4, 5];

describe("local dates", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("knows the weekday", () => {
    expect(dayOfWeek("2026-09-28")).toBe(1);
    expect(dayOfWeek("2026-09-27")).toBe(0);
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-09-20", "2026-09-28")).toBe(8);
    expect(daysBetween("2026-09-28", "2026-09-20")).toBe(-8);
  });
  it("lists each day in a half-open range", () => {
    expect(eachDay("2026-09-07", "2026-09-10")).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
    expect(eachDay("2026-09-10", "2026-09-10")).toEqual([]);
  });
  it("counts working days", () => {
    expect(countWorkingDays("2026-09-07", "2026-09-14", MON_FRI)).toBe(5);
  });
  it("rejects malformed and impossible dates", () => {
    expect(() => addDays("2026-9-1", 1)).toThrow(RangeError);
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });
});

describe("todayIn", () => {
  it("returns Sydney's date when UTC is still the previous day (Review Focus 3)", () => {
    expect(todayIn("Australia/Sydney", new Date("2026-09-27T20:00:00Z"))).toBe("2026-09-28");
  });
  it("returns the previous day just before Sydney midnight", () => {
    expect(todayIn("Australia/Sydney", new Date("2026-09-27T13:59:00Z"))).toBe("2026-09-27");
  });
});
