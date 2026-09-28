import { describe, expect, it } from "vitest";
import { mulDivRound, parseDecimal, sum, toCents, toHundredths } from "./money";

describe("mulDivRound", () => {
  it("rounds half away from zero", () => {
    expect(mulDivRound(5, 1, 2)).toBe(3);
    expect(mulDivRound(-5, 1, 2)).toBe(-3);
    expect(mulDivRound(1, 1, 3)).toBe(0);
    expect(mulDivRound(2, 1, 3)).toBe(1);
    expect(mulDivRound(3333, 950, 100)).toBe(31664);
  });
  it("never returns negative zero", () => {
    expect(mulDivRound(-1, 1, 3)).toBe(0);
  });
  it("is exact for products beyond 2^53", () => {
    expect(mulDivRound(9_007_199_254_740_991, 3, 3)).toBe(9_007_199_254_740_991);
  });
  it("rejects non-integers, non-positive divisors and unsafe results", () => {
    expect(() => mulDivRound(1.5, 1, 1)).toThrow(RangeError);
    expect(() => mulDivRound(1, 1, 0)).toThrow(RangeError);
    expect(() => mulDivRound(9_007_199_254_740_991, 2, 1)).toThrow(RangeError);
  });
});

describe("parseDecimal", () => {
  it("parses Postgres numeric strings into integer hundredths", () => {
    expect(toHundredths("7.5")).toBe(750);
    expect(toHundredths("7.50")).toBe(750);
    expect(toHundredths("120")).toBe(12000);
    expect(toHundredths("12.")).toBe(1200);
    expect(toHundredths(".5")).toBe(50);
    expect(toCents("-300.00")).toBe(-30000);
    expect(toCents("-0.00")).toBe(0);
    expect(parseDecimal(" 3 ", 0)).toBe(3);
  });
  it("rejects garbage, too many places and unsafe values", () => {
    expect(() => parseDecimal("abc", 2)).toThrow(SyntaxError);
    expect(() => parseDecimal(".", 2)).toThrow(SyntaxError);
    expect(() => parseDecimal("1.234", 2)).toThrow(RangeError);
    expect(() => parseDecimal("99999999999999999", 2)).toThrow(RangeError);
  });
});

describe("sum", () => {
  it("adds integers and returns 0 for none", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});
