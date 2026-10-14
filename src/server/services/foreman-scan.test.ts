import { describe, expect, it } from "vitest";
import { ONBOARDING_SCAN, WORKSPACE_SCAN } from "./foreman-scan";
import { DATA_SERVICE_METHODS, ONBOARDING_METHODS } from "./index";
import { createDbOnboarding } from "./onboarding";
import { createWorkspaceService } from "./workspace";

// F7: derived from the contract list createDbServices builds from, not from the implementation.
const listed = DATA_SERVICE_METHODS.workspace as unknown;
const contract = (Array.isArray(listed) ? (listed as string[]) : Object.keys(listed as object)).slice().sort();

describe("foreman scan registry", () => {
  it("lists every workspace method in the contract list, no more, no fewer", () => {
    expect(contract.length).toBeGreaterThan(0);
    expect(Object.keys(WORKSPACE_SCAN).sort()).toEqual(contract);
  });
  it("the real workspace service implements exactly that list", () => {
    expect(Object.keys(createWorkspaceService()).sort()).toEqual(contract);
  });
  it("lists every onboarding method in the contract list, and the real service implements exactly that list (T11-11)", () => {
    const onboarding = Object.keys(ONBOARDING_METHODS).sort();
    expect(onboarding.length).toBeGreaterThan(0);
    expect(Object.keys(ONBOARDING_SCAN).sort()).toEqual(onboarding);
    expect(Object.keys(createDbOnboarding({ userId: "u-1" })).sort()).toEqual(onboarding);
  });
});
