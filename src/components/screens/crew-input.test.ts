import { describe, expect, it } from "vitest";
import type { CrewRowForeman, CrewRowManager } from "@/data/contracts";
import { balanceView, crewLine, lastLoggedText, owedCountText, payBasisLabel, typeLabel } from "./crew-input";

const foreman: CrewRowForeman = { id: "c1", name: "Sam", type: "employee", active: true, defaultBasis: "daily", defaultUnit: null };
const manager = (over: Partial<CrewRowManager> = {}): CrewRowManager => ({
  ...foreman,
  level: { id: "l1", name: "Roofer" },
  gstRegistered: false,
  balanceCents: 0,
  unpaidTooLong: false,
  lastLogDate: null,
  ...over,
});

describe("typeLabel and payBasisLabel", () => {
  it("names the worker type and how the person is usually paid, never a rate", () => {
    expect(typeLabel("employee")).toBe("Employee");
    expect(typeLabel("contractor")).toBe("Contractor");
    expect(payBasisLabel("daily", null)).toBe("Paid by the day");
    expect(payBasisLabel("hourly", null)).toBe("Paid by the hour");
    expect(payBasisLabel("per_unit", "m2")).toBe("Paid per m²");
    expect(payBasisLabel("per_unit", "lm")).toBe("Paid per lm");
    expect(payBasisLabel("per_unit", "each")).toBe("Paid per item");
    expect(payBasisLabel("per_unit", null)).toBe("Paid per unit");
  });
});

describe("crewLine", () => {
  it("manager: type, level, how paid, and Inactive when they have left", () => {
    expect(crewLine(manager())).toBe("Employee · Roofer · Paid by the day");
    expect(crewLine(manager({ level: null, type: "contractor", defaultBasis: "per_unit", defaultUnit: "m2" }))).toBe("Contractor · Paid per m²");
    expect(crewLine(manager({ active: false }))).toBe("Employee · Roofer · Paid by the day · Inactive");
  });
  it("foreman: the same line from the money-free row", () => {
    expect(crewLine(foreman)).toBe("Employee · Paid by the day");
    expect(crewLine({ ...foreman, active: false })).toBe("Employee · Paid by the day · Inactive");
  });
});

describe("balanceView", () => {
  it("owed: the amount and who owes whom in plain words", () => {
    expect(balanceView(148200)).toEqual({ kind: "owed", amount: "$1,482.00", word: "Owed" });
  });
  it("paid ahead: an advance bigger than what they have earned shows as a positive amount with its own word", () => {
    expect(balanceView(-30000)).toEqual({ kind: "ahead", amount: "$300.00", word: "Paid ahead" });
  });
  it("nothing owed: zero is its own word", () => {
    expect(balanceView(0)).toEqual({ kind: "clear", amount: "$0.00", word: "Nothing owed" });
  });
});

describe("lastLoggedText and owedCountText", () => {
  it("says when the person last worked, or that they have not yet", () => {
    expect(lastLoggedText(null, "2026-09-28")).toBe("Not logged yet");
    expect(lastLoggedText("2026-09-25", "2026-09-28")).toBe("Last logged Fri 25 Sep");
  });
  it("counts the people who are owed money", () => {
    expect(owedCountText([])).toBe("No one is owed");
    expect(owedCountText([manager({ balanceCents: 0 }), manager({ balanceCents: -100 })])).toBe("No one is owed");
    expect(owedCountText([manager({ balanceCents: 5 })])).toBe("1 person is owed");
    expect(owedCountText([manager({ balanceCents: 5 }), manager({ balanceCents: 900 }), manager()])).toBe("2 people are owed");
  });
});
