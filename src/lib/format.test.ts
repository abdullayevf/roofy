import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime, formatDays, formatRoundedQuantity, formatDecimal, formatHours, formatMoney, formatQuantity } from "./format";

describe("format", () => {
  it("formats AUD with a true minus sign", () => {
    expect(formatMoney(143_250)).toBe("$1,432.50");
    expect(formatMoney(-30_000)).toBe("−$300.00");
    expect(formatMoney(0)).toBe("$0.00");
  });
  it("formats quantities without trailing zeros", () => {
    expect(formatQuantity(12_000, "m2")).toBe("120 m²");
    expect(formatQuantity(3_334, "m2")).toBe("33.34 m²");
    expect(formatQuantity(8_050, "lm")).toBe("80.5 lm");
    expect(formatQuantity(1_200, "each")).toBe("12");
    expect(formatQuantity(-50, "lm")).toBe("−0.5 lm");
  });
  it("formats hours and days", () => {
    expect(formatHours(750)).toBe("7.5 h");
    expect(formatDays(50)).toBe("½ day");
    expect(formatDays(100)).toBe("1 day");
    expect(formatDays(200)).toBe("2 days");
    expect(formatDays(-50)).toBe("−½ day");
    expect(formatDays(-100)).toBe("−1 day");
    expect(formatDays(-200)).toBe("−2 days");
  });
  it("formats dates, adding the year only when it differs", () => {
    expect(formatDate("2026-09-07", "2026-09-28")).toBe("Mon 7 Sep");
    expect(formatDate("2025-12-31", "2026-09-28")).toBe("Wed 31 Dec 2025");
  });
  it("writes hundredths (cents, quantities) as a plain two-place decimal for CSV", () => {
    expect(formatDecimal(143_250)).toBe("1432.50");
    expect(formatDecimal(5)).toBe("0.05");
    expect(formatDecimal(-30_000)).toBe("-300.00");
    expect(formatDecimal(0)).toBe("0.00");
  });
});

describe("formatDateTime", () => {
  it("shows the date and a 12-hour time in the given timezone", () => {
    // 20:20 UTC on 27 Sep is 6:20 am on Mon 28 Sep in Sydney (AEST +10 until 4 Oct, then +11).
    expect(formatDateTime("2026-09-27T20:20:00.000Z", "Australia/Sydney", "2026-09-28")).toBe("Mon 28 Sep, 6:20 am");
    expect(formatDateTime("2026-09-28T04:05:00.000Z", "Australia/Sydney", "2026-09-28")).toBe("Mon 28 Sep, 2:05 pm");
    expect(formatDateTime("2026-09-27T14:00:00.000Z", "Australia/Sydney", "2026-09-28")).toBe("Mon 28 Sep, 12:00 am");
  });
  it("adds the year when it isn't today's year, and uses the timezone's date", () => {
    expect(formatDateTime("2025-12-31T14:30:00.000Z", "Australia/Sydney", "2026-09-28")).toBe("Thu 1 Jan, 1:30 am");
    expect(formatDateTime("2025-12-30T14:30:00.000Z", "Australia/Sydney", "2026-09-28")).toBe("Wed 31 Dec 2025, 1:30 am");
  });
});

describe("formatTime", () => {
  it("shows a 12-hour time in the given timezone", () => {
    expect(formatTime("2026-09-27T20:20:00.000Z", "Australia/Sydney")).toBe("6:20 am");
    expect(formatTime("2026-09-28T04:05:00.000Z", "Australia/Sydney")).toBe("2:05 pm");
  });
});

describe("formatRoundedQuantity", () => {
  it("shows one decimal at most, drops a .0, and puts the unit on the value", () => {
    expect(formatRoundedQuantity(33566, "m2")).toBe("335.7 m²");
    expect(formatRoundedQuantity(8000, "lm")).toBe("80 lm");
    expect(formatRoundedQuantity(1250, "each")).toBe("12.5");
    expect(formatRoundedQuantity(99996, "m2")).toBe("1,000 m²");
  });
  it("adds hours the same way", () => {
    expect(formatRoundedQuantity(36800, "h")).toBe("368 h");
    expect(formatRoundedQuantity(36849, "h")).toBe("368.5 h");
  });
});
