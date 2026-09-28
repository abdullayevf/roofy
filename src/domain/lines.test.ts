import { describe, expect, it } from "vitest";
import { dailyAmount, defaultHours, hourlyAmount, perUnitAmount } from "./lines";

describe("hourly", () => {
  it("E2.1 Jake 7.5 h × $24.00 = $180.00", () => {
    expect(hourlyAmount(750, 2400)).toBe(18000);
  });
  it("E2.2 overtime 2 h × $24.00 × 1.5 = $72.00", () => {
    expect(hourlyAmount(200, 2400, 150)).toBe(7200);
  });
  it("rejects hours not in 0.25 steps and out-of-range multipliers", () => {
    expect(() => hourlyAmount(760, 2400)).toThrow(RangeError);
    expect(() => hourlyAmount(0, 2400)).toThrow(RangeError);
    expect(() => hourlyAmount(100, 2400, 90)).toThrow(RangeError);
    expect(() => hourlyAmount(100, 2400, 310)).toThrow(RangeError);
  });
});

describe("daily", () => {
  it("E3.1 Sam 1 day = $320.00 with 8.0 default hours", () => {
    expect(dailyAmount(100, 32000)).toBe(32000);
    expect(defaultHours(100, 800)).toBe(800);
  });
  it("E3.2 Sam ½ day = $160.00 with 4.0 default hours", () => {
    expect(dailyAmount(50, 32000)).toBe(16000);
    expect(defaultHours(50, 800)).toBe(400);
  });
  it("rejects days other than 1 or ½", () => {
    expect(() => dailyAmount(75, 32000)).toThrow(RangeError);
  });
});

describe("per unit", () => {
  it("multiplies quantity by rate", () => {
    expect(perUnitAmount(6000, 950)).toBe(57000);
  });
  it("rejects non-positive quantities", () => {
    expect(() => perUnitAmount(0, 950)).toThrow(RangeError);
  });
});
