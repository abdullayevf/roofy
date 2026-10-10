import { describe, expect, it } from "vitest";
import type { ExpenseRowForeman, ExpenseRowManager } from "@/data/contracts";
import { categoryLine, emptyFilterText, expenseHref, paidByText, parseExpenseFilter, receiptText } from "./expense-input";

const foremanRow = (over: Partial<ExpenseRowForeman> = {}): ExpenseRowForeman => ({
  id: "e1",
  date: "2026-09-23",
  supplier: "Bunnings",
  projectId: "p1",
  projectName: "Smith job",
  stageId: null,
  stageName: null,
  category: { id: "c1", name: "Materials" },
  paidBy: "company_card",
  crewMemberId: null,
  crewName: null,
  hasReceipt: false,
  ...over,
});
const managerRow = (over: Partial<ExpenseRowManager> = {}): ExpenseRowManager => ({
  ...foremanRow(),
  amountExGstCents: 10000,
  gstCents: 1000,
  totalCents: 11000,
  costCents: 10000,
  reimbursement: null,
  ...over,
});

describe("parseExpenseFilter", () => {
  it("reads ?job= and ?stage= as plain ids", () => {
    expect(parseExpenseFilter({ job: "p1", stage: "s1" })).toEqual({ projectId: "p1", stageId: "s1" });
    expect(parseExpenseFilter({ job: "p1" })).toEqual({ projectId: "p1", stageId: null });
    expect(parseExpenseFilter({})).toEqual({ projectId: null, stageId: null });
  });
  it("ignores blanks and repeated values", () => {
    expect(parseExpenseFilter({ job: "", stage: " " })).toEqual({ projectId: null, stageId: null });
    expect(parseExpenseFilter({ job: ["p1", "p2"], stage: undefined })).toEqual({ projectId: "p1", stageId: null });
  });
});

describe("expenseHref", () => {
  it("builds the list address with the filter and the demo state", () => {
    expect(expenseHref({ projectId: "p1", stageId: "s1" })).toBe("/expenses?job=p1&stage=s1");
    expect(expenseHref({ projectId: null, stageId: null })).toBe("/expenses");
    expect(expenseHref({ projectId: "p1", stageId: null }, "error")).toBe("/expenses?job=p1&demo=error");
  });
});

describe("paidByText", () => {
  it("says how a company expense was paid", () => {
    expect(paidByText(managerRow())).toBe("Paid by company card");
    expect(paidByText(managerRow({ paidBy: "cash" }))).toBe("Paid in cash");
  });
  it("names the crew member and says when they are reimbursed", () => {
    const crew = { paidBy: "crew" as const, crewMemberId: "k1", crewName: "Dima" };
    expect(paidByText(managerRow({ ...crew, reimbursement: { payRunId: null, status: "waiting" } }))).toBe(
      "Paid by Dima — reimbursed next pay run",
    );
    expect(paidByText(managerRow({ ...crew, reimbursement: { payRunId: "r1", status: "in_draft" } }))).toBe(
      "Paid by Dima — reimbursed in the draft pay run",
    );
    expect(paidByText(managerRow({ ...crew, reimbursement: { payRunId: "r0", status: "reimbursed" } }))).toBe(
      "Paid by Dima — reimbursed",
    );
  });
  it("gives a foreman the payer only: no reimbursement, no money", () => {
    expect(paidByText(foremanRow({ paidBy: "crew", crewMemberId: "k1", crewName: "Dima" }))).toBe("Paid by Dima");
  });
});

describe("receiptText", () => {
  it("says whether a receipt is attached", () => {
    expect(receiptText(true)).toBe("Receipt attached");
    expect(receiptText(false)).toBe("No receipt");
  });
});

describe("emptyFilterText", () => {
  it("says which filter found nothing", () => {
    expect(emptyFilterText({ projectId: "p1", stageId: null })).toBe("No expenses on this job yet.");
    expect(emptyFilterText({ projectId: "p1", stageId: "s1" })).toBe("No expenses on this stage yet.");
    expect(emptyFilterText({ projectId: null, stageId: null })).toBe("No expenses yet.");
  });
});

describe("categoryLine", () => {
  it("names the stage when the expense was for one", () => {
    expect(categoryLine(foremanRow())).toBe("Materials");
    expect(categoryLine(foremanRow({ stageId: "s1", stageName: "Sheet install" }))).toBe("Materials for Sheet install");
  });
});
