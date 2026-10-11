import { describe, expect, it } from "vitest";
import { ABN_DIGITS, businessProblems, crewRowProblems } from "./onboarding-input";

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
    expect(crewRowProblems({ name: "", rateCents: null })).toEqual({ name: "Add a name.", rate: "Add a rate before adding." });
    expect(crewRowProblems({ name: "Sam", rateCents: 0 })).toEqual({ rate: "Add a rate before adding." });
    expect(crewRowProblems({ name: "Sam", rateCents: "unreadable" }).rate).toMatch(/dollars and cents/);
    expect(crewRowProblems({ name: "Sam", rateCents: 32000 })).toEqual({});
  });
});
