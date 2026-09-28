import { describe, expect, it } from "vitest";
import { gstIncludedIn, gstOn, personTotals, receiptTotal, splitReceipt } from "./gst";

const dima = { type: "contractor", gstRegistered: true } as const;
const lee = { type: "contractor", gstRegistered: false } as const;
const jake = { type: "employee", gstRegistered: false } as const;

describe("GST", () => {
  it("E6.1 Dima subtotal $1,520.00 → GST $152.00 → total $1,672.00", () => {
    expect(personTotals(dima, 152_000, 0)).toEqual({
      subtotalCents: 152_000,
      gstCents: 15_200,
      reimbursementsCents: 0,
      totalCents: 167_200,
    });
  });
  it("E6.2 Lee (not registered) subtotal $1,050.00 → no GST", () => {
    expect(personTotals(lee, 105_000, 0).totalCents).toBe(105_000);
  });
  it("E7.1 reimbursement $110.00 is added after GST, with no GST on top", () => {
    expect(personTotals(dima, 152_000, 11_000).totalCents).toBe(178_200);
    expect(gstIncludedIn(11_000)).toBe(1_000);
  });
  it("employees never get GST", () => {
    expect(personTotals(jake, 18_000, 0).gstCents).toBe(0);
  });
  it("rounds GST on negative subtotals symmetrically", () => {
    expect(gstOn(-1_005)).toBe(-101);
    expect(gstOn(1_005)).toBe(101);
  });
  it("splits a GST-inclusive receipt: GST defaults to total ÷ 11, or as entered, and adds back exactly", () => {
    expect(splitReceipt(11_000)).toEqual({ amountExGstCents: 10_000, gstCents: 1_000 });
    expect(splitReceipt(99_000, 0)).toEqual({ amountExGstCents: 99_000, gstCents: 0 });
    expect(splitReceipt(1_001)).toEqual({ amountExGstCents: 910, gstCents: 91 });
    expect(receiptTotal({ amountExGstCents: 910, gstCents: 91 })).toBe(1_001);
    expect(() => splitReceipt(1_000, 1_001)).toThrow(RangeError);
    expect(() => splitReceipt(1_000, -1)).toThrow(RangeError);
  });
});
