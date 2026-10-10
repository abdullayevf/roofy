import type { ExpenseRowForeman, ExpenseRowManager } from "@/data/contracts";

/** The Expenses list's filter, read from the address: one job, and one stage of it. */
export type ExpenseFilter = { projectId: string | null; stageId: string | null };

const one = (v: string | string[] | undefined): string | null => {
  const t = (Array.isArray(v) ? v[0] : v)?.trim();
  return t ? t : null;
};

/** `?job=<id>&stage=<id>`: blanks and repeats are ignored, so a stray address shows the whole list. */
export function parseExpenseFilter(params: Record<string, string | string[] | undefined>): ExpenseFilter {
  return { projectId: one(params.job), stageId: one(params.stage) };
}

/** The list's address for a filter (and the demo state, so a captured state survives clearing a chip). */
export function expenseHref(filter: ExpenseFilter, demo?: string): string {
  const q = new URLSearchParams();
  if (filter.projectId) q.set("job", filter.projectId);
  if (filter.stageId) q.set("stage", filter.stageId);
  if (demo) q.set("demo", demo);
  const s = q.toString();
  return s ? `/expenses?${s}` : "/expenses";
}

/**
 * Who paid, in words. A crew member's receipt says when they get the money back (pay rules §7); a foreman's row
 * never carries that, since it is read off an amount the foreman can't see.
 */
export function paidByText(row: ExpenseRowForeman | ExpenseRowManager): string {
  if (row.paidBy === "company_card") return "Paid by company card";
  if (row.paidBy === "cash") return "Paid in cash";
  const who = `Paid by ${row.crewName ?? "a crew member"}`;
  const r = "reimbursement" in row ? row.reimbursement : null;
  if (!r) return who;
  if (r.status === "reimbursed") return `${who} — reimbursed`;
  return `${who} — ${r.status === "in_draft" ? "reimbursed in the draft pay run" : "reimbursed next pay run"}`;
}

export const receiptText = (hasReceipt: boolean): string => (hasReceipt ? "Receipt attached" : "No receipt");

/** The category, and the stage it was for when there is one: "Materials for Sheet install". */
export const categoryLine = (row: ExpenseRowForeman): string =>
  row.stageName ? `${row.category.name} for ${row.stageName}` : row.category.name;

/** The one sentence when a filter (or nothing at all) leaves no expenses. */
export function emptyFilterText(filter: ExpenseFilter): string {
  if (filter.stageId) return "No expenses on this stage yet.";
  if (filter.projectId) return "No expenses on this job yet.";
  return "No expenses yet.";
}
