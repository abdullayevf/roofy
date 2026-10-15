import { describe, expect, it } from "vitest";
import { RETURN_PARAM, returnPathOf, withReturn } from "./return-path";

describe("returnPathOf", () => {
  it("keeps a path on this site", () => {
    expect(returnPathOf("/invite/01900000-0000-7000-8000-000000000000")).toBe(
      "/invite/01900000-0000-7000-8000-000000000000",
    );
    expect(returnPathOf("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });
  it("refuses anything that could leave the site or is not a plain path", () => {
    for (const bad of [
      "https://evil.example/invite/x",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "/ /evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      "invite/x",
      "",
      " /invite/x",
      "/".padEnd(300, "a"),
    ])
      expect(returnPathOf(bad), JSON.stringify(bad)).toBeNull();
  });
  it("refuses a value that is not one string", () => {
    expect(returnPathOf(undefined)).toBeNull();
    expect(returnPathOf(["/a", "/b"])).toBeNull();
    expect(returnPathOf(42)).toBeNull();
  });
});

describe("withReturn", () => {
  it("adds the path as a query value, or leaves the link alone without one", () => {
    expect(withReturn("/sign-in", "/invite/abc")).toBe(`/sign-in?${RETURN_PARAM}=%2Finvite%2Fabc`);
    expect(withReturn("/sign-in", null)).toBe("/sign-in");
  });
});
