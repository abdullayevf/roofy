import { describe, expect, it } from "vitest";
import { centsPerUnit, quantityPerDay, ratioBp } from "./ratios";

describe("ratioBp", () => {
  it("is part ÷ whole in basis points, rounded half away from zero", () => {
    expect(ratioBp(477500, 400000)).toBe(11938); // E12.1 forecast ÷ budget → over marker at 119.38%
    expect(ratioBp(3, 5)).toBe(6000); // E14.1 utilisation 60%
    expect(ratioBp(-1000, 8000)).toBe(-1250); // a negative margin
    expect(ratioBp(0, 100)).toBe(0);
  });

  it("is null when the whole is zero or negative (nothing to compare with)", () => {
    expect(ratioBp(10, 0)).toBeNull();
    expect(ratioBp(10, -5)).toBeNull();
  });
});

describe("centsPerUnit", () => {
  it("is cost ÷ quantity for one whole unit (quantity in hundredths)", () => {
    expect(centsPerUnit(143250, 12000)).toBe(1194); // $1,432.50 over 120 m² → $11.94/m²
    expect(centsPerUnit(57000, 6000)).toBe(950);
  });

  it("is null without a quantity", () => {
    expect(centsPerUnit(100, 0)).toBeNull();
  });
});

describe("quantityPerDay", () => {
  it("is quantity ÷ days, in hundredths", () => {
    expect(quantityPerDay(12000, 2)).toBe(6000); // 120 m² over 2 crew-days → 60 m²/crew-day
    expect(quantityPerDay(10000, 3)).toBe(3333);
  });

  it("is null without any days", () => {
    expect(quantityPerDay(100, 0)).toBeNull();
  });
});
