import { describe, expect, it } from "vitest";
import { fromCents, fromHundredths, toCents, toHundredths } from "./convert";

describe("toHundredths", () => {
  it("reads numeric(12,2) strings as integer hundredths", () => {
    expect(toHundredths("12.50")).toBe(1250);
    expect(toHundredths("0.01")).toBe(1);
    expect(toHundredths("7")).toBe(700);
    expect(toHundredths("7.5")).toBe(750);
    expect(toHundredths("-3.25")).toBe(-325);
    expect(toHundredths("0.00")).toBe(0);
  });

  it("rejects more than 2 decimals", () => {
    expect(() => toHundredths("1.234")).toThrow(/2 decimal places/);
  });

  it("rejects text that is not a number", () => {
    for (const bad of ["", "abc", "1.", ".5", "1e3", " 1"]) {
      expect(() => toHundredths(bad)).toThrow(/not a number/);
    }
  });

  it("rejects values outside the safe integer range", () => {
    expect(() => toHundredths("99999999999999999.00")).toThrow(/safe range/);
    expect(toHundredths("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => toHundredths("90071992547409.92")).toThrow(/safe range/);
    expect(fromHundredths(Number.MAX_SAFE_INTEGER)).toBe("90071992547409.91");
  });
});

describe("fromHundredths", () => {
  it("writes integer hundredths as numeric strings", () => {
    expect(fromHundredths(1250)).toBe("12.50");
    expect(fromHundredths(1)).toBe("0.01");
    expect(fromHundredths(0)).toBe("0.00");
    expect(fromHundredths(-325)).toBe("-3.25");
    expect(fromHundredths(-5)).toBe("-0.05");
  });

  it("round-trips", () => {
    for (const n of [0, 1, 99, 100, 123456, -1, -100]) expect(toHundredths(fromHundredths(n))).toBe(n);
  });

  it("rejects non-integers and unsafe numbers", () => {
    expect(() => fromHundredths(1.5)).toThrow(/whole number/);
    expect(() => fromHundredths(Number.MAX_SAFE_INTEGER + 1)).toThrow(/whole number/);
  });
});

describe("toCents", () => {
  it("reads bigint strings and bigints as integer cents", () => {
    expect(toCents("123456")).toBe(123456);
    expect(toCents(-42n)).toBe(-42);
    expect(toCents(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("throws for cents outside Number.MAX_SAFE_INTEGER", () => {
    expect(() => toCents("9007199254740992")).toThrow(/safe range/);
    expect(() => toCents(-9007199254740992n)).toThrow(/safe range/);
  });

  it("rejects text that is not a whole number", () => {
    for (const bad of ["", "1.5", "abc", "1e3"]) expect(() => toCents(bad)).toThrow(/not a whole number/);
  });
});

describe("fromCents", () => {
  it("writes integer cents as bigint strings", () => {
    expect(fromCents(123456)).toBe("123456");
    expect(fromCents(-1)).toBe("-1");
  });

  it("rejects non-integers and unsafe numbers", () => {
    expect(() => fromCents(0.5)).toThrow(/whole number/);
    expect(() => fromCents(Number.MAX_SAFE_INTEGER + 2)).toThrow(/whole number/);
  });
});
