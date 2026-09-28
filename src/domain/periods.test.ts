import { describe, expect, it } from "vitest";
import { payPeriodContaining } from "./periods";

describe("payPeriodContaining", () => {
  it("weekly Mon–Sun", () => {
    expect(
      payPeriodContaining("2026-09-30", { frequency: "weekly", weekStartDay: 1, anchor: "2026-01-05" }),
    ).toEqual({
      start: "2026-09-28",
      end: "2026-10-04",
    });
  });
  it("weekly starting Sunday, with an anchor that is not a Sunday", () => {
    expect(
      payPeriodContaining("2026-09-30", { frequency: "weekly", weekStartDay: 0, anchor: "2026-09-14" }),
    ).toEqual({
      start: "2026-09-27",
      end: "2026-10-03",
    });
  });
  it("fortnightly from an anchor, including dates before the anchor", () => {
    const cfg = { frequency: "fortnightly", weekStartDay: 1, anchor: "2026-09-14" } as const;
    expect(payPeriodContaining("2026-09-30", cfg)).toEqual({ start: "2026-09-28", end: "2026-10-11" });
    expect(payPeriodContaining("2026-09-10", cfg)).toEqual({ start: "2026-08-31", end: "2026-09-13" });
  });
});
