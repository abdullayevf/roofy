import { describe, expect, it } from "vitest";
import type { ExpenseRowForeman, ExpenseRowManager } from "@/data/contracts";
import { categoryLine, supplierText, emptyFilterText, expenseHref, paidByText, parseExpenseFilter, receiptText } from "./expense-input";

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
      "Paid by Dima — reimbursed next pay run",
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

import {
  emptyExpense,
  expenseFromQuery,
  expenseInput,
  expenseMissingHint,
  expenseProblems,
  gstShown,
  reimbursementNote,
  expenseValuesFrom,
  expensePatch,
  withSavedJob,
  gstEdit,
  jobCostText,
  receiptToSend,
  type ExpenseFormValues,
} from "./expense-input";

describe("Add expense form", () => {
  const filled = (over: Partial<ExpenseFormValues> = {}): ExpenseFormValues => ({
    ...emptyExpense("2026-09-28"),
    supplier: "Bunnings",
    totalCents: 11000,
    projectId: "p1",
    categoryId: "c1",
    ...over,
  });

  it("starts today with the GST default, paid by company card, nothing else chosen", () => {
    expect(emptyExpense("2026-09-28", "p1")).toMatchObject({ date: "2026-09-28", projectId: "p1", gst: "default", paidBy: "company_card", totalCents: null });
  });

  it("reads GST as total ÷ 11 by default, 0 for No GST, else what was typed", () => {
    expect(gstShown(filled())).toBe(1000);
    expect(gstShown(filled({ gst: "none" }))).toBe(0);
    expect(gstShown(filled({ gst: "typed", gstCents: 900 }))).toBe(900);
    expect(gstShown(filled({ totalCents: null }))).toBeNull();
    expect(gstShown(filled({ gst: "typed", gstCents: "unreadable" }))).toBeNull();
  });

  it("names each missing thing and is ready only when nothing is missing", () => {
    const p = expenseProblems(emptyExpense("2026-09-28"));
    expect(p).toEqual({ ready: false, total: "Add a total before saving.", project: "Pick the job.", category: "Pick a category." });
    expect(expenseMissingHint(p)).toBe("Add a total, pick the job and pick a category.");
    expect(expenseProblems(filled())).toEqual({ ready: true });
    expect(expenseMissingHint({ ready: true })).toBeUndefined();
  });

  it("refuses an unreadable or negative total, GST over the total and a crew payer left blank", () => {
    expect(expenseProblems(filled({ totalCents: "unreadable" })).total).toBe("Enter an amount in dollars and cents, like 110.00.");
    expect(expenseProblems(filled({ totalCents: -5 })).total).toBe("Leave out the minus sign, like 110.00.");
    expect(expenseProblems(filled({ gst: "typed", gstCents: 11001 })).gst).toBe("GST can't be more than the total.");
    expect(expenseProblems(filled({ gst: "typed", gstCents: "unreadable" })).gst).toBe("Enter GST in dollars and cents, like 10.00.");
    expect(expenseProblems(filled({ gst: "typed", gstCents: null })).gst).toBe("Add the GST, or choose No GST.");
    const crew = expenseProblems(filled({ paidBy: "crew" }));
    expect(crew.crew).toBe("Pick who paid.");
    expect(expenseMissingHint(crew)).toBe("Pick who paid.");
    expect(expenseMissingHint(expenseProblems(filled({ totalCents: "unreadable" })))).toBe("Fix the total.");
    expect(expenseMissingHint(expenseProblems(filled({ gst: "typed", gstCents: 99999 })))).toBe("Fix the GST.");
  });

  it("treats the supplier as optional (flows.md has no supplier step)", () => {
    expect(supplierText("Bunnings")).toBe("Bunnings");
    expect(supplierText(" ")).toBe("No supplier");
    expect(expenseProblems(filled({ supplier: "  " }))).toEqual({ ready: true });
    expect(expenseInput(filled({ supplier: "" }), null)?.supplier).toBe("");
  });

  it("builds the save input: GST null for the default, 0 for No GST, a crew member only when crew paid", () => {
    expect(expenseInput(filled({ supplier: "  Bunnings " }), null)).toEqual({
      date: "2026-09-28", supplier: "Bunnings", totalCents: 11000, gstCents: null, projectId: "p1", stageId: null,
      categoryId: "c1", paidBy: "company_card", crewMemberId: null, receiptFileId: null,
    });
    expect(expenseInput(filled({ gst: "none", stageId: "s1" }), "f1")).toMatchObject({ gstCents: 0, stageId: "s1", receiptFileId: "f1" });
    expect(expenseInput(filled({ gst: "typed", gstCents: 900 }), null)?.gstCents).toBe(900);
    expect(expenseInput(filled({ paidBy: "crew", crewMemberId: "dima" }), null)).toMatchObject({ paidBy: "crew", crewMemberId: "dima" });
    expect(expenseInput(filled({ paidBy: "cash", crewMemberId: "dima" }), null)?.crewMemberId).toBeNull();
    expect(expenseInput(filled({ totalCents: null }), null)).toBeNull();
  });

  it("explains the payback in plain words", () => {
    expect(reimbursementNote("Dima")).toBe("Paid by Dima — reimbursed next pay run");
  });

  it("fills in from the address for the prototype's states, ignoring what it can't use", () => {
    const pick = { projects: [{ id: "p1", stages: [{ id: "s1" }] }], categories: [{ id: "c1" }], crew: [{ id: "dima" }] };
    const { values, check, saved } = expenseFromQuery(
      { job: "p1", stage: "s1", total: "110.00", supplier: "Bunnings", category: "c1", paid: "crew", crew: "dima", gst: "none", check: "1", saved: "waiting" },
      "2026-09-28",
      pick,
    );
    expect(values).toMatchObject({ projectId: "p1", stageId: "s1", totalCents: 11000, supplier: "Bunnings", categoryId: "c1", paidBy: "crew", crewMemberId: "dima", gst: "none" });
    expect(check).toBe(true);
    expect(saved).toBe(true);
    const two = { ...pick, projects: [...pick.projects, { id: "p2", stages: [] }] };
    const bad = expenseFromQuery({ job: ["zz"], stage: "s9", total: "abc", category: "c9", paid: "bank", crew: "x" }, "2026-09-28", two);
    expect(bad.values).toMatchObject({ projectId: "", stageId: null, totalCents: "unreadable", categoryId: "", paidBy: "company_card", crewMemberId: null, gst: "default" });
    expect(bad.check).toBe(false);
    expect(expenseFromQuery({ total: "" }, "2026-09-28", pick).values.totalCents).toBeNull();
  });

  it("ticks the job when there is only one to pick (F13)", () => {
    const one = { projects: [{ id: "p1", stages: [] }], categories: [], crew: [] };
    expect(expenseFromQuery({}, "2026-09-28", one).values.projectId).toBe("p1");
    const two = { ...one, projects: [{ id: "p1", stages: [] }, { id: "p2", stages: [] }] };
    expect(expenseFromQuery({}, "2026-09-28", two).values.projectId).toBe("");
  });
});

describe("expenseValuesFrom", () => {
  it("fills the edit form from a saved expense, GST left on the default when it is total ÷ 11", () => {
    const v = expenseValuesFrom(managerRow({ stageId: "s1", paidBy: "crew", crewMemberId: "k1", crewName: "Dima" }));
    expect(v).toEqual({
      date: "2026-09-23",
      supplier: "Bunnings",
      totalCents: 11000,
      gst: "default",
      gstCents: null,
      projectId: "p1",
      stageId: "s1",
      categoryId: "c1",
      paidBy: "crew",
      crewMemberId: "k1",
    });
  });
  it("keeps No GST and a GST typed off the receipt", () => {
    expect(expenseValuesFrom(managerRow({ gstCents: 0, amountExGstCents: 11000 }))).toMatchObject({ gst: "none", gstCents: null });
    expect(expenseValuesFrom(managerRow({ gstCents: 900, amountExGstCents: 10100 }))).toMatchObject({
      gst: "typed",
      gstCents: 900,
      totalCents: 11000,
    });
  });
});

describe("Task 16 review fixes", () => {
  const filled = (over: Partial<ExpenseFormValues> = {}): ExpenseFormValues => ({
    ...emptyExpense("2026-09-28"),
    supplier: "Bunnings",
    totalCents: 11000,
    projectId: "p1",
    categoryId: "c1",
    ...over,
  });

  it("refuses a typed GST with a minus sign", () => {
    expect(expenseProblems(filled({ gst: "typed", gstCents: -100 }))).toEqual({ ready: false, gst: "Leave out the minus sign, like 10.00." });
    expect(expenseMissingHint(expenseProblems(filled({ gst: "typed", gstCents: -100 })))).toBe("Fix the GST.");
  });

  it("asks for a date when the date is cleared", () => {
    const p = expenseProblems(filled({ date: "" }));
    expect(p).toEqual({ ready: false, date: "Pick the date." });
    expect(expenseMissingHint(p)).toBe("Pick the date.");
    expect(expenseInput(filled({ date: "" }), null)).toBeNull();
  });

  it("shows the cost to the job ex GST when registered, incl. GST when not (pay rules 11)", () => {
    expect(jobCostText(filled(), true)).toBe("Cost to the job $100.00 ex GST.");
    expect(jobCostText(filled(), false)).toBe("Cost to the job $110.00 incl. GST.");
    expect(jobCostText(filled({ gst: "typed", gstCents: 900 }), true)).toBe("Cost to the job $101.00 ex GST.");
    expect(jobCostText(filled({ gst: "none" }), true)).toBe("Cost to the job $110.00 ex GST.");
    expect(jobCostText(filled({ totalCents: null }), true)).toBeNull();
    expect(jobCostText(filled({ totalCents: 0 }), true)).toBeNull();
    expect(jobCostText(filled({ gst: "typed", gstCents: 20000 }), true)).toBeNull();
  });

  it("leaves the GST on the default when a blur hands back the same figure", () => {
    expect(gstEdit(filled(), 1000)).toBeNull();
    expect(gstEdit(filled(), 900)).toEqual({ gst: "typed", gstCents: 900 });
    expect(gstEdit(filled({ gst: "typed", gstCents: 900 }), 1000)).toEqual({ gst: "typed", gstCents: 1000 });
    expect(gstEdit(filled(), "unreadable")).toEqual({ gst: "typed", gstCents: "unreadable" });
  });

  it("saves an edit that keeps No GST as 0 and a typed GST as typed, leaving the receipt alone", () => {
    const none = expenseValuesFrom(managerRow({ gstCents: 0, amountExGstCents: 11000 }));
    expect(expensePatch(none)).toMatchObject({ totalCents: 11000, gstCents: 0, receiptFileId: undefined });
    const typed = expenseValuesFrom(managerRow({ gstCents: 900, amountExGstCents: 10100 }));
    expect(expensePatch(typed)).toMatchObject({ totalCents: 11000, gstCents: 900, receiptFileId: undefined });
    expect(expensePatch({ ...typed, totalCents: null })).toBeNull();
  });

  it("sends the prototype's stand-in receipt only when a photo was picked", () => {
    expect(receiptToSend(true, "fake-receipt")).toBe("fake-receipt");
    expect(receiptToSend(false, "fake-receipt")).toBeNull();
    expect(receiptToSend(true, null)).toBeNull();
  });
});

describe("Task 16 design fix 1a finisher", () => {
  it("expensePatch keeps, removes or replaces the receipt", () => {
    const v = expenseValuesFrom(managerRow());
    expect(expensePatch(v, "keep")).toMatchObject({ receiptFileId: undefined });
    expect(expensePatch(v, null)).toMatchObject({ receiptFileId: null });
    expect(expensePatch(v, "prototype-receipt")).toMatchObject({ receiptFileId: "prototype-receipt" });
  });
  it("withSavedJob puts the saved job first when the picker list doesn't have it", () => {
    const row = managerRow({ projectId: "old", projectName: "Old job", stageId: "s9", stageName: "Strip" });
    const listed = [{ id: "p1", name: "Smith", stages: [] }];
    const out = withSavedJob(listed, row);
    expect(out.map((p) => p.id)).toEqual(["old", "p1"]);
    expect(out[0]!.stages.map((s) => s.name)).toEqual(["Strip"]);
    expect(withSavedJob(listed, managerRow({ projectId: "p1" }))).toBe(listed);
    const noStage = withSavedJob([{ id: "p1", name: "Smith", stages: [] }], managerRow({ projectId: "p1", stageId: "s2", stageName: "Gutters" }));
    expect(noStage[0]!.stages.map((s) => s.id)).toEqual(["s2"]);
  });
});
