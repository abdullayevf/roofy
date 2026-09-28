import { describe, expect, it } from "vitest";
import { Rng, mulberry32 } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a seed and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(43)()).not.toBe(xs[0]);
  });
});

describe("Rng", () => {
  it("int is inclusive at both ends and covers the range", () => {
    const rng = new Rng(7);
    const seen = new Set(Array.from({ length: 500 }, () => rng.int(3, 6)));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("int rejects an empty or non-integer range", () => {
    const rng = new Rng(1);
    expect(() => rng.int(5, 4)).toThrow(RangeError);
    expect(() => rng.int(0.5, 4)).toThrow(RangeError);
  });

  it("pick and chance are deterministic", () => {
    const run = () => {
      const rng = new Rng(9);
      return [rng.pick(["a", "b", "c"]), rng.chance(0.5), rng.chance(0), rng.chance(1)];
    };
    expect(run()).toEqual(run());
    expect(run().slice(2)).toEqual([false, true]);
    expect(() => new Rng(1).pick([])).toThrow(RangeError);
  });

  it("uuid is UUID-shaped, unique and reproducible", () => {
    const a = new Rng(5);
    const ids = Array.from({ length: 2000 }, () => a.uuid());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const b = new Rng(5);
    expect(b.uuid()).toBe(ids[0]);
  });

  it("hex returns the requested number of hex digits", () => {
    expect(new Rng(3).hex(32)).toMatch(/^[0-9a-f]{32}$/);
  });
});
