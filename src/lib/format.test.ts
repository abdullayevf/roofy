import { describe, expect, it } from "vitest";
import { formatDate, formatDays, formatDecimal, formatHours, formatMoney, formatQuantity } from "./format";

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
