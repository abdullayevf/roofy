import { describe, expect, it } from "vitest";
import { floorCheck } from "./floor";

describe("floorCheck", () => {
  it("E10.1 Tom $479.97 over 16 h = $30.00/h, below $32.00 by $32.03", () => {
    expect(floorCheck(47_997, 1_600, 3_200)).toEqual({
      effectiveHourlyCents: 3_000,
      below: true,
      shortfallCents: 3_203,
    });
  });
  it("passes when at or above the floor", () => {
    expect(floorCheck(51_200, 1_600, 3_200)).toEqual({
      effectiveHourlyCents: 3_200,
      below: false,
      shortfallCents: 0,
    });
  });
  it("cannot run without hours", () => {
    expect(floorCheck(10_000, 0, 3_200)).toEqual({
      effectiveHourlyCents: null,
      below: false,
      shortfallCents: 0,
    });
  });
});
