import { describe, expect, it } from "vitest";
import { activeNavKey, manageNavItems } from "./active";

describe("activeNavKey", () => {
  it("maps the main tabs by first path segment", () => {
    expect(activeNavKey("/", "manager", "phone")).toBe("home");
    expect(activeNavKey("/jobs", "manager", "phone")).toBe("jobs");
    expect(activeNavKey("/jobs/abc/stages/x", "manager", "phone")).toBe("jobs");
    expect(activeNavKey("/log/progress", "manager", "phone")).toBe("log");
    expect(activeNavKey("/crew/dima/payout", "manager", "phone")).toBe("crew");
    expect(activeNavKey("/outbox", "foreman", "phone")).toBe("outbox");
    expect(activeNavKey("/outbox", "manager", "phone")).toBe("more");
    expect(activeNavKey("/outbox", "manager", "desktop")).toBe("more");
    expect(activeNavKey("/jobsx", "manager", "phone")).toBe("");
  });
  it("puts the pages behind More under More on a phone", () => {
    for (const p of ["/more", "/expenses", "/expenses/new", "/pay", "/reports/x", "/settings/levels", "/history", "/export", "/install"])
      expect(activeNavKey(p, "manager", "phone")).toBe("more");
  });
  it("on desktop the manager's sidebar leaves Expenses, Pay, Reports and Settings to the manage list", () => {
    for (const p of ["/expenses", "/pay/run1", "/reports", "/settings"]) expect(activeNavKey(p, "manager", "desktop")).toBe("");
    for (const p of ["/more", "/history", "/export", "/install"]) expect(activeNavKey(p, "manager", "desktop")).toBe("more");
  });
  it("gives the accountant Pay and Reports as their own tabs", () => {
    expect(activeNavKey("/pay/run1", "accountant", "phone")).toBe("pay");
    expect(activeNavKey("/reports", "accountant", "desktop")).toBe("reports");
    expect(activeNavKey("/expenses", "accountant", "phone")).toBe("more");
  });
  it("makes Home the foreman's first tab", () => {
    expect(activeNavKey("/", "foreman", "phone")).toBe("home");
    expect(activeNavKey("/", "foreman", "desktop")).toBe("home");
  });
  it("gives the foreman no active tab on pages outside their four", () => {
    expect(activeNavKey("/expenses/new", "foreman", "phone")).toBe("");
    expect(activeNavKey("/log", "foreman", "phone")).toBe("log");
  });
});

describe("manageNavItems", () => {
  it("lists Expenses, Pay runs, Reports and Settings for a manager on desktop only", () => {
    expect(manageNavItems("manager").map((i) => i.label)).toEqual(["Expenses", "Pay runs", "Reports", "Settings"]);
    expect(manageNavItems("accountant")).toEqual([]);
    expect(manageNavItems("foreman")).toEqual([]);
  });
});
