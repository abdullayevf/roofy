import { describe, expect, it } from "vitest";
import { WORKSPACE_SCAN } from "./foreman-scan";
import { createWorkspaceService } from "./workspace";

describe("foreman scan registry", () => {
  it("lists every method of the real workspace service, no more, no fewer", () => {
    expect(Object.keys(WORKSPACE_SCAN).sort()).toEqual(Object.keys(createWorkspaceService()).sort());
  });
});
