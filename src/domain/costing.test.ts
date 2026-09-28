import { describe, expect, it } from "vitest";
import { expenseCost, labourCost } from "./costing";

const employee = { type: "employee", gstRegistered: false } as const;
const gstContractor = { type: "contractor", gstRegistered: true } as const;
const registered = { workspaceGstRegistered: true, onCostBp: 2500 };
const unregistered = { workspaceGstRegistered: false, onCostBp: 2500 };

describe("labourCost", () => {
  it("E11.1 Sam $570.00 × 1.25 + Dima $720.00 = $1,432.50", () => {
    expect(labourCost(57_000, employee, registered) + labourCost(72_000, gstContractor, registered)).toBe(
      143_250,
    );
  });
  it("E11.2 unregistered workspace pays GST as a real cost: $1,504.50", () => {
    expect(labourCost(57_000, employee, unregistered) + labourCost(72_000, gstContractor, unregistered)).toBe(
      150_450,
    );
  });
  it("E8.1 a +$12.00 adjustment adds $15.00 of job cost", () => {
    expect(labourCost(1_200, employee, registered)).toBe(1_500);
  });
  it("non-registered contractors cost exactly their amount", () => {
    expect(labourCost(105_000, { type: "contractor", gstRegistered: false }, unregistered)).toBe(105_000);
  });
});

describe("expenseCost", () => {
  it("is ex GST for registered workspaces and incl. GST otherwise", () => {
    expect(expenseCost(10_000, 1_000, true)).toBe(10_000);
    expect(expenseCost(10_000, 1_000, false)).toBe(11_000);
  });
});
