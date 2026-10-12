import { describe, expect, it } from "vitest";
import { categorySchema } from "@/data/admin-inputs";
import {
  bpText,
  CATEGORY_NAME_MAX,
  floorError,
  levelsSummary,
  payPeriodSummary,
  crewCountHint,
  PIN_SUMMARY,
  nameLengthError,
  payPeriodText,
  readCode,
  readHours,
  readOnCost,
  FLOOR_MISSING,
} from "./settings-input";

describe("settings input", () => {
  it("refuses a category name the server would refuse, with the same sentence, instead of failing silently", () => {
    const name = (n: number) => "a".repeat(n);
    expect(nameLengthError(name(CATEGORY_NAME_MAX), CATEGORY_NAME_MAX)).toBeUndefined();
    expect(nameLengthError(`  ${name(CATEGORY_NAME_MAX)}  `, CATEGORY_NAME_MAX)).toBeUndefined();
    expect(nameLengthError(name(CATEGORY_NAME_MAX + 1), CATEGORY_NAME_MAX)).toBe("Keep it under 60 characters.");
    const base = { id: null, position: 1 };
    expect(categorySchema.safeParse({ ...base, name: name(CATEGORY_NAME_MAX) }).success).toBe(true);
    const over = categorySchema.safeParse({ ...base, name: name(CATEGORY_NAME_MAX + 1) });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe(nameLengthError(name(CATEGORY_NAME_MAX + 1), CATEGORY_NAME_MAX));
  });

  it("reads an on-cost percent as basis points, never as 0% when blank or unreadable", () => {
    expect(readOnCost("18.5")).toEqual({ bp: 1850 });
    expect(readOnCost(" 20 % ")).toEqual({ bp: 2000 });
    expect(readOnCost("0")).toEqual({ bp: 0 });
    expect(readOnCost("")).toEqual({ error: "Add an on-cost percent before saving." });
    expect(readOnCost("abc")).toEqual({ error: "Enter a percent, like 18.5." });
    expect(readOnCost("100.01")).toEqual({ error: "On-cost is between 0% and 100%." });
  });

  it("shows basis points as a percent to two places when not whole", () => {
    expect(bpText(1850)).toBe("18.5");
    expect(bpText(2000)).toBe("20");
    expect(bpText(1849)).toBe("18.49");
  });

  it("refuses a blank, unreadable or $0.00 floor rate", () => {
    expect(floorError(null)).toBe(FLOOR_MISSING);
    expect(floorError("unreadable")).toBe(FLOOR_MISSING);
    expect(floorError(0)).toBe(FLOOR_MISSING);
    expect(floorError(-100)).toBe(FLOOR_MISSING);
    expect(floorError(3300)).toBeUndefined();
    expect(FLOOR_MISSING).toBe("Add a floor rate before saving.");
  });

  it("reads a standard day in hundredths of an hour", () => {
    expect(readHours("7.6")).toEqual({ hours: 760 });
    expect(readHours("")).toEqual({ error: "Add the hours in a standard day." });
    expect(readHours("0")).toEqual({ error: "A standard day needs some hours." });
    expect(readHours("25")).toEqual({ error: "A day has at most 24 hours." });
    expect(readHours("x")).toEqual({ error: "Enter hours, like 7.6." });
  });

  it("reads a 6-digit two-factor code", () => {
    expect(readCode("123 456")).toEqual({ code: "123456" });
    expect(readCode("12a456")).toEqual({ error: "Enter the 6-digit code from your app." });
    expect(readCode("")).toEqual({ error: "Enter the 6-digit code from your app." });
  });

  it("says the pay period in plain words", () => {
    expect(payPeriodText("weekly", 1)).toBe("Weekly, starting Monday");
    expect(payPeriodText("fortnightly", 3)).toBe("Fortnightly, starting Wednesday");
  });
});

describe("pay period anchor", () => {
  it("moves the anchor back to the chosen start day", async () => {
    const { anchorOn } = await import("./settings-input");
    expect(anchorOn("2026-09-28", 1)).toBe("2026-09-28");
    expect(anchorOn("2026-09-28", 3)).toBe("2026-09-23");
    expect(anchorOn("2026-09-28", 0)).toBe("2026-09-27");
  });
});

describe("template shares", () => {
  it("reads a percent to basis points; blank or unreadable is never 0%", async () => {
    const { readShare } = await import("./settings-input");
    expect(readShare("25")).toEqual({ bp: 2500 });
    expect(readShare(" 12.5% ")).toEqual({ bp: 1250 });
    expect(readShare("0")).toEqual({ bp: 0 });
    expect(readShare("")).toEqual({ error: "Add a share, or 0 if the stage has none." });
    expect(readShare("abc")).toEqual({ error: "Enter a percent, like 25." });
    expect(readShare("101")).toEqual({ error: "A share is between 0% and 100%." });
  });
  it("labour adds up to 100%; materials add up to 100% or are all 0%", async () => {
    const { shareErrors } = await import("./settings-input");
    expect(shareErrors([2500, 7500], [5000, 5000])).toEqual({});
    expect(shareErrors([2500, 7500], [0, 0])).toEqual({});
    expect(shareErrors([2500, 7000], [0, 0]).labour).toBe("Labour shares must add up to 100%. They add up to 95%.");
    expect(shareErrors([10000], [3000]).materials).toBe("Materials shares must add up to 100%, or all be 0%. They add up to 30%.");
  });
});

describe("the pinned Save bar's error line (entry-settings i2 D8 + F2)", () => {
  const levels = [
    { id: "a", name: "Leading hand" },
    { id: "b", name: "Roofer" },
  ];
  it("names the first level whose floor rate is refused", () => {
    expect(levelsSummary(levels, { b: FLOOR_MISSING })).toBe("Add a floor rate for Roofer.");
    expect(levelsSummary(levels, { a: FLOOR_MISSING, b: FLOOR_MISSING })).toBe("Add a floor rate for Leading hand.");
  });
  it("says nothing when no level has an error", () => {
    expect(levelsSummary(levels, {})).toBeUndefined();
    expect(levelsSummary(levels, { a: undefined })).toBeUndefined();
  });
  it("names the pay-period field that needs fixing", () => {
    expect(payPeriodSummary({ standardDayHours: "Add the hours in a standard day." })).toBe("Fix the standard day before saving.");
    expect(payPeriodSummary({ workingDays: "Pick at least one working day." })).toBe("Pick a working day before saving.");
    expect(payPeriodSummary({})).toBeUndefined();
  });
  it("has one plain fallback sentence", () => {
    expect(PIN_SUMMARY).toBe("Some details need fixing before this saves.");
  });
});

describe("the crew count under a level's name (F17)", () => {
  it("says No crew, not 0 crew", () => {
    expect(crewCountHint(0)).toBe("No crew on this level.");
    expect(crewCountHint(1)).toBe("1 crew on this level.");
    expect(crewCountHint(4)).toBe("4 crew on this level.");
  });
});
