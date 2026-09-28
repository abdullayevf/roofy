import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { splitByShares, splitWeighted } from "./split";

describe("splitWeighted", () => {
  it("gives leftovers to the earliest people when remainders tie", () => {
    expect(splitWeighted(10_000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(splitWeighted(200_000, [1, 1, 1])).toEqual([66667, 66667, 66666]);
  });
  it("gives leftovers to the largest remainder first", () => {
    expect(splitWeighted(10, [1, 2])).toEqual([3, 7]);
  });
  it("handles zero totals", () => {
    expect(splitWeighted(0, [1, 1])).toEqual([0, 0]);
  });
  it("rejects bad input", () => {
    expect(() => splitWeighted(-1, [1])).toThrow(RangeError);
    expect(() => splitWeighted(1.5, [1])).toThrow(RangeError);
    expect(() => splitWeighted(10, [])).toThrow(RangeError);
    expect(() => splitWeighted(10, [1, 0])).toThrow(RangeError);
  });
  it("always sums exactly and stays within one unit of the exact share", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 30 }),
        (total, weights) => {
          const parts = splitWeighted(total, weights);
          const W = BigInt(weights.reduce((a, b) => a + b, 0));
          expect(parts).toHaveLength(weights.length);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          parts.forEach((p, i) => {
            const floor = Number((BigInt(total) * BigInt(weights[i]!)) / W);
            expect(p === floor || p === floor + 1).toBe(true);
          });
        },
      ),
    );
  });
});

describe("splitByShares", () => {
  it("splits equally by head-count, not via rounded percentages (E5.1 basis)", () => {
    expect(splitByShares(200_000, 3, { mode: "equal" })).toEqual([66667, 66667, 66666]);
  });
  it("splits by custom basis points", () => {
    expect(splitByShares(8000, 2, { mode: "custom", bp: [7500, 2500] })).toEqual([6000, 2000]);
  });
  it("rejects custom shares that do not total 100% or do not match the crew", () => {
    expect(() => splitByShares(100, 2, { mode: "custom", bp: [5000, 4000] })).toThrow(RangeError);
    expect(() => splitByShares(100, 3, { mode: "custom", bp: [5000, 5000] })).toThrow(RangeError);
  });
});
