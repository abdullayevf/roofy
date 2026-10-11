import { describe, expect, it } from "vitest";
import { bpText, floorError, payPeriodText, readCode, readHours, readOnCost, FLOOR_MISSING } from "./settings-input";

describe("settings input", () => {
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
