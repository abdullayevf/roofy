import { describe, expect, it } from "vitest";
import type { AuditRow } from "@/data/contracts";
import { historyFilterText, historySentence, parseHistoryFilter } from "./history-text";

const TODAY = "2026-09-28";
const row = (over: Partial<AuditRow>): AuditRow => ({
  id: "a",
  at: "2026-09-22T22:05:00Z",
  actorName: "Dan Holt",
  table: "expense",
  rowId: "r",
  action: "update",
  fields: [],
  before: null,
  after: null,
  subject: "Bunnings receipt",
  projectId: null,
  projectName: null,
  crewMemberId: null,
  ...over,
});

describe("historySentence: plain words, never table or field names", () => {
  it("an expense total change names both totals (ex GST plus GST) and the receipt", () => {
    const s = historySentence(
      row({ fields: ["amountExGstCents", "gstCents"], before: { amountExGstCents: 10000, gstCents: 2000 }, after: { amountExGstCents: 12000, gstCents: 1200 } }),
      TODAY,
    );
    expect(s).toBe("Changed total from $120.00 to $132.00 on Bunnings receipt");
  });

  it("a stage pause, a progress change and a pay run approval read as words", () => {
    expect(
      historySentence(
        row({ table: "stage", subject: "Sheet install", fields: ["status", "pauseReason"], before: { status: "active" }, after: { status: "paused", pauseReason: "materials" } }),
        TODAY,
      ),
    ).toBe("Changed status from active to paused and pause reason to materials on Sheet install");
    expect(
      historySentence(row({ table: "stage", subject: "Sheet install", fields: ["manualPctBp"], before: { manualPctBp: null }, after: { manualPctBp: 5000 } }), TODAY),
    ).toBe("Changed progress to 50% on Sheet install");
    expect(
      historySentence(row({ table: "pay_run", subject: "Pay run for 14 Sep to 20 Sep", fields: ["status"], before: { status: "draft" }, after: { status: "approved" } }), TODAY),
    ).toBe("Changed status from draft to approved on Pay run for 14 Sep to 20 Sep");
  });

  it("adds and removals say what was added, with the amount for money rows", () => {
    expect(historySentence(row({ table: "ledger_entry", action: "insert", subject: "Dima's advance", after: { kind: "advance", amountCents: 20000 } }), TODAY)).toBe(
      "Added Dima's advance of $200.00",
    );
    expect(historySentence(row({ table: "rate", action: "insert", subject: "Sam's rate", after: { basis: "daily", amountCents: 32000, effectiveFrom: "2026-09-15" } }), TODAY)).toBe(
      "Added Sam's rate of $320.00 a day from Tue 15 Sep",
    );
    expect(historySentence(row({ table: "work_log", action: "delete", subject: "Dima's log for Mon 14 Sep" }), TODAY)).toBe("Removed Dima's log for Mon 14 Sep");
    expect(historySentence(row({ table: "project", action: "insert", subject: "Smith job" }), TODAY)).toBe("Added Smith job");
  });

  it("an unknown field is worded from its name, never shown raw, and an id value is not shown", () => {
    const s = historySentence(row({ table: "member", subject: "Kev", fields: ["someNewField", "stageId"], before: { someNewField: 1, stageId: "0190a1b2-aaaa" }, after: { someNewField: 2, stageId: "0190a1b2-bbbb" } }), TODAY);
    expect(s).toBe("Changed some new field from 1 to 2 and stage on Kev");
    expect(s).not.toMatch(/[A-Z][a-z]+[A-Z]|_|0190/);
  });
});

describe("history filter", () => {
  it("reads ?job= and ?crew= (and a row from Expense detail), ignoring blanks and lists", () => {
    expect(parseHistoryFilter({ job: "p1" })).toEqual({ projectId: "p1", crewMemberId: null, table: null, rowId: null });
    expect(parseHistoryFilter({ crew: "c1" })).toEqual({ projectId: null, crewMemberId: "c1", table: null, rowId: null });
    expect(parseHistoryFilter({ table: "expense", rowId: "e1" })).toEqual({ projectId: null, crewMemberId: null, table: "expense", rowId: "e1" });
    expect(parseHistoryFilter({ job: "", crew: ["a", "b"] })).toEqual({ projectId: null, crewMemberId: null, table: null, rowId: null });
  });

  it("the Showing line names the job or person", () => {
    expect(historyFilterText({ job: "Smith job", crew: null, row: null })).toBe("Showing Smith job");
    expect(historyFilterText({ job: null, crew: "Dima", row: null })).toBe("Showing Dima");
    expect(historyFilterText({ job: null, crew: null, row: "Bunnings receipt" })).toBe("Showing Bunnings receipt");
    expect(historyFilterText({ job: null, crew: null, row: null })).toBeNull();
  });
});
