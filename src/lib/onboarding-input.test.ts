import { describe, expect, it } from "vitest";
import { ABN_DIGITS, businessProblems, crewRowProblems, crewRowReason } from "./onboarding-input";

describe("onboarding input checks", () => {
  it("asks for a business name and an 11 digit ABN", () => {
    expect(businessProblems({ name: " ", abn: "123" })).toEqual({ name: "Add your business name.", abn: ABN_DIGITS });
    expect(ABN_DIGITS).toBe("ABN should be 11 digits.");
  });
  it("takes an ABN with or without spaces", () => {
    expect(businessProblems({ name: "Harbour Roofing", abn: "51 824 753 556" })).toEqual({});
    expect(businessProblems({ name: "Harbour Roofing", abn: "51824753556" })).toEqual({});
    expect(businessProblems({ name: "Harbour Roofing", abn: "5182475355a" }).abn).toBe(ABN_DIGITS);
  });
  it("asks for a crew member's name and rate", () => {
    expect(crewRowProblems({ name: "", rateCents: null })).toEqual({ name: "Add a name.", rate: "Add an hourly rate." });
    expect(crewRowProblems({ name: "Sam", rateCents: 0 })).toEqual({ rate: "Add an hourly rate." });
    expect(crewRowProblems({ name: "Sam", rateCents: 0, basis: "daily" })).toEqual({ rate: "Add a daily rate." });
    expect(crewRowProblems({ name: "Sam", rateCents: "unreadable" }).rate).toMatch(/dollars and cents/);
    expect(crewRowProblems({ name: "Sam", rateCents: 32000 })).toEqual({});
  });
  it("says in one line what the open crew row still needs before Continue", () => {
    expect(crewRowReason({ name: "", rateCents: null })).toBe("Add a name and a rate, or cancel.");
    expect(crewRowReason({ name: " ", rateCents: 32000 })).toBe("Add a name, or cancel.");
    expect(crewRowReason({ name: "Sam", rateCents: null })).toBe("Add Sam's rate, or cancel.");
    expect(crewRowReason({ name: "Sam", rateCents: 0 })).toBe("Add Sam's rate, or cancel.");
    expect(crewRowReason({ name: "Sam", rateCents: "unreadable" })).toBe("Fix Sam's rate, or cancel.");
    expect(crewRowReason({ name: "Sam", rateCents: 32000 })).toBe("Tap Add to save Sam, or cancel.");
  });
});
