import { describe, expect, it } from "vitest";
import { WORKSPACE_SCAN } from "./foreman-scan";
import { DATA_SERVICE_METHODS } from "./index";
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
});
