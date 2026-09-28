import { describe, expect, it } from "vitest";
import { lumpSumLines, pieceRateLines } from "./piece";

describe("pieceRateLines", () => {
  it("E4.1 120 m² split equally between Sam and Dima", () => {
    const lines = pieceRateLines(
      12000,
      "m2",
      [
        { crewMemberId: "sam", rateCents: 950 },
        { crewMemberId: "dima", rateCents: 1200 },
      ],
      { mode: "equal" },
    );
    expect(lines.map((l) => [l.quantity, l.amountCents])).toEqual([
      [6000, 57000],
      [6000, 72000],
    ]);
    expect(lines.every((l) => l.hours === 0)).toBe(true);
  });
  it("E4.2 100 m² split three ways gives the extra 0.01 m² to the first person", () => {
    const lines = pieceRateLines(
      10000,
      "m2",
      [
        { crewMemberId: "sam", rateCents: 950 },
        { crewMemberId: "dima", rateCents: 1200 },
        { crewMemberId: "tom", rateCents: 900 },
      ],
      { mode: "equal" },
    );
    expect(lines.map((l) => [l.quantity, l.amountCents])).toEqual([
      [3334, 31673],
      [3333, 39996],
      [3333, 29997],
    ]);
  });
  it("E4.3 custom split with a missing rate saves $0.00 and flags it", () => {
    const lines = pieceRateLines(
      8000,
      "lm",
      [
        { crewMemberId: "lee", rateCents: 800 },
        { crewMemberId: "jake", rateCents: null },
      ],
      { mode: "custom", bp: [7500, 2500] },
    );
    expect(lines).toEqual([
      {
        crewMemberId: "lee",
        quantity: 6000,
        hours: 0,
        rateCents: 800,
        amountCents: 48000,
        missingRate: false,
      },
      { crewMemberId: "jake", quantity: 2000, hours: 0, rateCents: null, amountCents: 0, missingRate: true },
    ]);
  });
  it("splits 'each' in whole units", () => {
    const lines = pieceRateLines(
      500,
      "each",
      [
        { crewMemberId: "a", rateCents: 100 },
        { crewMemberId: "b", rateCents: 100 },
      ],
      { mode: "equal" },
    );
    expect(lines.map((l) => l.quantity)).toEqual([300, 200]);
  });
  it("rejects empty crews, non-positive and fractional 'each' quantities", () => {
    expect(() => pieceRateLines(100, "m2", [], { mode: "equal" })).toThrow(RangeError);
    expect(() => pieceRateLines(0, "m2", [{ crewMemberId: "a", rateCents: 1 }], { mode: "equal" })).toThrow(
      RangeError,
    );
    expect(() =>
      pieceRateLines(150, "each", [{ crewMemberId: "a", rateCents: 1 }], { mode: "equal" }),
    ).toThrow(RangeError);
  });
  it("gives a zero share $0.00 instead of failing", () => {
    const lines = pieceRateLines(
      100,
      "each",
      [
        { crewMemberId: "a", rateCents: 500 },
        { crewMemberId: "b", rateCents: 500 },
      ],
      { mode: "equal" },
    );
    expect(lines.map((l) => [l.quantity, l.amountCents, l.missingRate])).toEqual([
      [100, 500, false],
      [0, 0, false],
    ]);
  });
});

describe("lumpSumLines", () => {
  it("E5.1 $2,000 split equally between three people", () => {
    expect(lumpSumLines(200_000, ["sam", "tom", "dima"], { mode: "equal" })).toEqual([
      { crewMemberId: "sam", amountCents: 66667, hours: 0 },
      { crewMemberId: "tom", amountCents: 66667, hours: 0 },
      { crewMemberId: "dima", amountCents: 66666, hours: 0 },
    ]);
  });
  it("rejects an empty crew", () => {
    expect(() => lumpSumLines(100, [], { mode: "equal" })).toThrow(RangeError);
  });
});
