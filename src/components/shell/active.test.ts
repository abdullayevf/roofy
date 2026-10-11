import { describe, expect, it } from "vitest";
import { activeNavKey, manageNavItems, queuesOffline } from "./active";

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
  it("keeps the foreman's receipts under Jobs, and gives no active tab on pages outside their four", () => {
    for (const layout of ["phone", "desktop"] as const) {
      expect(activeNavKey("/expenses", "foreman", layout)).toBe("jobs");
      expect(activeNavKey("/expenses/new", "foreman", layout)).toBe("jobs");
    }
    expect(activeNavKey("/install", "foreman", "phone")).toBe("");
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

describe("queuesOffline (R7)", () => {
  it("is false on the forms that need a connection to save, true everywhere else", () => {
    expect(queuesOffline("/jobs/new")).toBe(false);
    expect(queuesOffline("/crew/abc-123")).toBe(false);
    expect(queuesOffline("/crew/abc-123/payout")).toBe(false);
    expect(queuesOffline("/crew")).toBe(false);
    expect(queuesOffline("/jobs/abc-123/edit")).toBe(false);
    // Pay runs never queue (flows.md "Needs connection"): no "will send automatically" banner on the list or a run.
    expect(queuesOffline("/pay")).toBe(false);
    expect(queuesOffline("/pay/run-1")).toBe(false);
    // Workspace export is a download: it says Needs connection itself, so no banner promising to send later.
    expect(queuesOffline("/export")).toBe(false);
    expect(queuesOffline("/exports-archive")).toBe(true);
    // Reports and Record history are read-only: nothing is entered there, so no banner promising to send later (D2).
    expect(queuesOffline("/reports")).toBe(false);
    expect(queuesOffline("/reports/job-profitability")).toBe(false);
    expect(queuesOffline("/history")).toBe(false);
    expect(queuesOffline("/reports-archive")).toBe(true);
    // Settings pages and More need a connection to save (Sign out, theme): each says Needs connection itself (D5).
    expect(queuesOffline("/settings")).toBe(false);
    expect(queuesOffline("/settings/business")).toBe(false);
    expect(queuesOffline("/settings/templates/tpl-1")).toBe(false);
    expect(queuesOffline("/settings-archive")).toBe(true);
    expect(queuesOffline("/more")).toBe(false);
    expect(queuesOffline("/more-archive")).toBe(true);
    expect(queuesOffline("/jobs")).toBe(true);
    expect(queuesOffline("/jobs/abc-123")).toBe(true);
    expect(queuesOffline("/log")).toBe(true);
    expect(queuesOffline("/")).toBe(true);
    // Expense edit is the detail address with ?edit=1: it needs a connection, so no "will send" banner.
    expect(queuesOffline("/expenses/abc-123", "1")).toBe(false);
    expect(queuesOffline("/expenses/abc-123")).toBe(true);
    expect(queuesOffline("/expenses/new", "1")).toBe(true);
  });
});
