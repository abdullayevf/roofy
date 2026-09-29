import { describe, expect, it } from "vitest";
import { canOpen, moreItems, navRoleFor, backLink } from "./access";

describe("navRoleFor", () => {
  it("gives the owner the manager nav", () => {
    expect(navRoleFor("owner")).toBe("manager");
    expect(navRoleFor("manager")).toBe("manager");
    expect(navRoleFor("foreman")).toBe("foreman");
    expect(navRoleFor("accountant")).toBe("accountant");
  });
});

describe("canOpen", () => {
  it("lets the owner and manager open everything except the owner-only workspace export", () => {
    for (const s of ["jobs", "crew", "pay", "reports", "settings", "history", "more"] as const) {
      expect(canOpen("owner", s)).toBe(true);
      expect(canOpen("manager", s)).toBe(true);
    }
    expect(canOpen("owner", "export")).toBe(true);
    expect(canOpen("manager", "export")).toBe(false);
  });
  it("keeps money and admin pages from the foreman", () => {
    for (const s of ["crew", "pay", "reports", "settings", "history", "export", "more"] as const)
      expect(canOpen("foreman", s)).toBe(false);
    for (const s of ["log", "jobs", "outbox", "expenses", "install"] as const) expect(canOpen("foreman", s)).toBe(true);
  });
  it("gives the accountant the read-only money pages only", () => {
    for (const s of ["home", "pay", "reports", "expenses", "more", "install"] as const)
      expect(canOpen("accountant", s)).toBe(true);
    for (const s of ["log", "crew", "outbox", "settings", "history", "export"] as const)
      expect(canOpen("accountant", s)).toBe(false);
  });
});

describe("moreItems", () => {
  it("lists what each role can reach from More", () => {
    const shared = ["Expenses", "Pay runs", "Reports", "Settings", "Record history"];
    expect(moreItems("manager").map((i) => i.label)).toEqual([...shared, "Install guide"]);
    expect(moreItems("owner").map((i) => i.label)).toEqual([...shared, "Workspace export", "Install guide"]);
    expect(moreItems("accountant").map((i) => i.label)).toEqual(["Expenses", "Install guide"]);
    expect(moreItems("foreman")).toEqual([]);
  });
});

describe("backLink", () => {
  it("sends a foreman back to Log and everyone else Home", () => {
    expect(backLink("foreman")).toEqual({ href: "/log", label: "Back to Log" });
    expect(backLink("accountant")).toEqual({ href: "/", label: "Go to Home" });
  });
});
