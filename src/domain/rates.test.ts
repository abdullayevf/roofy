import { describe, expect, it } from "vitest";
import { resolveRate, type RateRecord } from "./rates";

const rate = (
  p: Partial<RateRecord> & Pick<RateRecord, "id" | "amountCents" | "effectiveFrom">,
): RateRecord => ({
  crewMemberId: "sam",
  basis: "daily",
  unit: null,
  projectId: null,
  ...p,
});

const rates: RateRecord[] = [
  rate({ id: "d1", amountCents: 30000, effectiveFrom: "2026-07-01" }),
  rate({ id: "d2", amountCents: 32000, effectiveFrom: "2026-09-15" }),
  rate({ id: "ryde", amountCents: 36000, effectiveFrom: "2026-09-01", projectId: "ryde" }),
  rate({ id: "m2", basis: "per_unit", unit: "m2", amountCents: 950, effectiveFrom: "2026-07-01" }),
];

describe("resolveRate", () => {
  it("E1.1 uses the latest default rate effective on or before the log date", () => {
    const q = { crewMemberId: "sam", basis: "daily", unit: null, projectId: "smith" } as const;
    expect(resolveRate(rates, { ...q, date: "2026-09-12" })?.amountCents).toBe(30000);
    expect(resolveRate(rates, { ...q, date: "2026-09-15" })?.amountCents).toBe(32000);
  });
  it("E1.2 prefers a project override on that project only", () => {
    const q = { crewMemberId: "sam", basis: "daily", unit: null, date: "2026-09-16" } as const;
    expect(resolveRate(rates, { ...q, projectId: "ryde" })?.amountCents).toBe(36000);
    expect(resolveRate(rates, { ...q, projectId: "smith" })?.amountCents).toBe(32000);
  });
  it("matches unit for per-unit rates", () => {
    const q = { crewMemberId: "sam", basis: "per_unit", projectId: "smith", date: "2026-09-16" } as const;
    expect(resolveRate(rates, { ...q, unit: "m2" })?.amountCents).toBe(950);
    expect(resolveRate(rates, { ...q, unit: "lm" })).toBeNull();
  });
  it("does not depend on the order rates are stored in", () => {
    const q = {
      crewMemberId: "sam",
      basis: "daily",
      unit: null,
      projectId: "smith",
      date: "2026-09-16",
    } as const;
    expect(resolveRate([...rates].reverse(), q)?.amountCents).toBe(32000);
  });
  it("returns null before any rate is effective or for another person", () => {
    expect(
      resolveRate(rates, {
        crewMemberId: "sam",
        basis: "daily",
        unit: null,
        projectId: "smith",
        date: "2026-06-30",
      }),
    ).toBeNull();
    expect(
      resolveRate(rates, {
        crewMemberId: "tom",
        basis: "daily",
        unit: null,
        projectId: "smith",
        date: "2026-09-16",
      }),
    ).toBeNull();
  });
});
