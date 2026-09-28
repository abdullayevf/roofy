import { describe, expect, it } from "vitest";
import { MONEY_KEY, MONEY_TEXT, expectNoMoney, scanForMoney } from "./dto";

describe("scanForMoney", () => {
  it("returns nothing for a money-free foreman-shaped object", () => {
    const foremanJob = {
      view: "foreman",
      id: "p1",
      name: "Smith job — Ryde re-roof",
      pctBp: 3000,
      stages: [
        {
          id: "s5",
          name: "Sheet install",
          status: "active",
          unit: "m2",
          quantityDone: 12000,
          plannedQuantity: 40000,
          tape: { pctBp: 3000 },
          pause: null,
        },
      ],
      recentLogs: [{ date: "2026-09-25", crewName: "Sam", basis: "time_only", hours: 800, paidBy: "crew" }],
      createdAt: "2026-09-25T07:00:00.000Z",
      href: "/jobs/p1",
      note: "Paid from progress, not this grid.",
    };
    expect(scanForMoney(foremanJob)).toEqual([]);
  });

  it.each([
    ["rateCents"],
    ["amountCents"],
    ["labourBudgetCents"],
    ["forecastMarginCents"],
    ["balanceCents"],
    ["labourCostCents"],
    ["earnings"],
    ["payRunId"],
    ["totalQuantity"],
    ["gstRegistered"],
    ["hasRate"],
    ["Rate"],
  ])("flags the money key %s", (key) => {
    expect(scanForMoney({ [key]: 1 })).toEqual([`$.${key}`]);
  });

  it("flags dollar figures in strings, with or without a space", () => {
    expect(scanForMoney({ sentence: "Smith job is trending $775 over" })).toEqual(["$.sentence"]);
    expect(scanForMoney({ a: ["ok", "paid $ 12.00"] })).toEqual(["$.a[1]"]);
    expect(scanForMoney("$1,432.50")).toEqual(["$"]);
  });

  it("does not flag a dollar sign without a digit", () => {
    expect(scanForMoney({ note: "Costs shown in $ are hidden", slug: "a$b" })).toEqual([]);
  });

  it("reports nested paths through objects and arrays, key hit first", () => {
    const value = {
      stages: [{ id: "a" }, { id: "b", alert: { byCents: 77500, sentence: "over by $775.00" } }],
      people: [{ lines: [{ amountCents: 57000 }] }],
    };
    expect(scanForMoney(value)).toEqual([
      "$.stages[1].alert.byCents",
      "$.stages[1].alert.sentence",
      "$.people[0].lines[0].amountCents",
    ]);
  });

  it("scans every key even when the value is null, a number or a boolean", () => {
    expect(scanForMoney({ marginCents: null, budgetOk: true, x: 0 })).toEqual([
      "$.marginCents",
      "$.budgetOk",
    ]);
  });

  it("handles primitives, null, undefined and Dates without crashing", () => {
    expect(scanForMoney(null)).toEqual([]);
    expect(scanForMoney(undefined)).toEqual([]);
    expect(scanForMoney(42)).toEqual([]);
    expect(scanForMoney({ at: new Date("2026-09-28T00:00:00Z") })).toEqual([]);
  });

  it("uses the Task 5 key and text patterns", () => {
    expect(MONEY_KEY.source).toBe("rate|amount|cents|budget|margin|balance|cost|earn|pay|total|gst");
    expect(MONEY_KEY.flags).toContain("i");
    expect(MONEY_TEXT.test("$ 5")).toBe(true);
  });
});

describe("expectNoMoney", () => {
  it("passes on clean data and throws with every offending path", () => {
    expect(() => expectNoMoney({ name: "Sam" }, "crew.list")).not.toThrow();
    expect(() => expectNoMoney({ rateCents: 1, s: "$5" }, "crew.list")).toThrow(
      /crew\.list leaks money: \$\.rateCents, \$\.s/,
    );
  });
});
