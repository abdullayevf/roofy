import { describe, expect, it } from "vitest";
import { adjustmentDelta, reversal } from "./adjustments";
import { hourlyAmount } from "./lines";

describe("adjustments", () => {
  it("E8.1 Jake 7.5 h → 8.0 h creates +0.5 h, +$12.00", () => {
    const original = { quantity: 750, hours: 750, amountCents: hourlyAmount(750, 2400) };
    const edited = { quantity: 800, hours: 800, amountCents: hourlyAmount(800, 2400) };
    expect(adjustmentDelta(original, edited)).toEqual({ quantity: 50, hours: 50, amountCents: 1200 });
  });
  it("returns null when nothing changed", () => {
    const v = { quantity: 100, hours: 800, amountCents: 32000 };
    expect(adjustmentDelta(v, { ...v })).toBeNull();
  });
  it("reverses a deleted log exactly, without negative zero", () => {
    expect(reversal({ quantity: 100, hours: 800, amountCents: 32000 })).toEqual({
      quantity: -100,
      hours: -800,
      amountCents: -32000,
    });
    expect(reversal({ quantity: 0, hours: 0, amountCents: 0 })).toEqual({
      quantity: 0,
      hours: 0,
      amountCents: 0,
    });
    expect(Object.is(reversal({ quantity: 0, hours: 0, amountCents: 0 }).amountCents, 0)).toBe(true);
  });
});
