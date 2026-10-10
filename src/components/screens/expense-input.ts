import type { ExpenseInput, ExpenseRowForeman, ExpenseRowManager, PaidBy } from "@/data/contracts";
import type { Cents } from "@/domain/types";
import { gstIncludedIn } from "@/domain/gst";
import { toCents } from "@/domain/money";

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

// ─── Add expense (screen 17) ─────────────────────────────────────────────────

/** Integer cents; null when blank; "unreadable" when the text can't be read as dollars and cents (never $0.00). */
export type TypedCents = Cents | null | "unreadable";

export type ExpenseFormValues = {
  date: string;
  supplier: string;
  totalCents: TypedCents;
  /** "default" = total ÷ 11 (`gstIncludedIn`), "none" = No GST, "typed" = the GST box as edited. */
  gst: "default" | "none" | "typed";
  gstCents: TypedCents;
  projectId: string;
  stageId: string | null;
  categoryId: string;
  paidBy: PaidBy;
  crewMemberId: string | null;
};

export const PAID_BY: { value: PaidBy; label: string }[] = [
  { value: "company_card", label: "Company card" },
  { value: "cash", label: "Cash" },
  { value: "crew", label: "Crew member" },
];

/** A new expense: dated today (workspace timezone), GST from the total, paid on the company card. */
export function emptyExpense(today: string, projectId = ""): ExpenseFormValues {
  return {
    date: today,
    supplier: "",
    totalCents: null,
    gst: "default",
    gstCents: null,
    projectId,
    stageId: null,
    categoryId: "",
    paidBy: "company_card",
    crewMemberId: null,
  };
}

/** The GST this expense carries, or null while the total or the typed GST can't be read. */
export function gstShown(v: ExpenseFormValues): Cents | null {
  if (v.gst === "none") return 0;
  if (v.gst === "typed") return typeof v.gstCents === "number" ? v.gstCents : null;
  return typeof v.totalCents === "number" && v.totalCents > 0 ? gstIncludedIn(v.totalCents) : null;
}

export type ExpenseProblems = {
  ready: boolean;
  total?: string;
  gst?: string;
  supplier?: string;
  project?: string;
  category?: string;
  crew?: string;
};

export const TOTAL_MISSING = "Add a total before saving.";
const GST_MISSING = "Add the GST, or choose No GST.";

/** Each missing thing, in the words its field shows; ready only when nothing is missing. */
export function expenseProblems(v: ExpenseFormValues): ExpenseProblems {
  const p: ExpenseProblems = { ready: true };
  const total = v.totalCents;
  if (total === "unreadable") p.total = "Enter an amount in dollars and cents, like 110.00.";
  else if (total !== null && total < 0) p.total = "Leave out the minus sign, like 110.00.";
  else if (total === null || total === 0) p.total = TOTAL_MISSING;
  if (v.gst === "typed") {
    if (v.gstCents === "unreadable") p.gst = "Enter GST in dollars and cents, like 10.00.";
    else if (v.gstCents === null) p.gst = GST_MISSING;
    else if (typeof total === "number" && v.gstCents > total) p.gst = "GST can't be more than the total.";
  }
  if (v.supplier.trim() === "") p.supplier = "Add the supplier.";
  if (v.projectId === "") p.project = "Pick the job.";
  if (v.categoryId === "") p.category = "Pick a category.";
  if (v.paidBy === "crew" && v.crewMemberId === null) p.crew = "Pick who paid.";
  p.ready = Object.keys(p).length === 1;
  return p;
}

/** The line under a refused Save expense: only what is still missing, as one sentence (undefined when ready). */
export function expenseMissingHint(p: ExpenseProblems): string | undefined {
  const parts: string[] = [];
  if (p.total) parts.push(p.total === TOTAL_MISSING ? "add a total" : "fix the total");
  if (p.gst) parts.push(p.gst === GST_MISSING ? "add the GST" : "fix the GST");
  if (p.supplier) parts.push("add the supplier");
  if (p.project) parts.push("pick the job");
  if (p.category) parts.push("pick a category");
  if (p.crew) parts.push("pick who paid");
  if (parts.length === 0) return undefined;
  const last = parts.pop() as string;
  const text = parts.length === 0 ? last : `${parts.join(", ")} and ${last}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The save input (GST null = the ÷ 11 default, 0 = No GST), or null while anything is missing. */
export function expenseInput(v: ExpenseFormValues, receiptFileId: string | null): ExpenseInput | null {
  if (!expenseProblems(v).ready || typeof v.totalCents !== "number") return null;
  return {
    date: v.date,
    supplier: v.supplier.trim(),
    totalCents: v.totalCents,
    gstCents: v.gst === "default" ? null : v.gst === "none" ? 0 : (v.gstCents as Cents),
    projectId: v.projectId,
    stageId: v.stageId,
    categoryId: v.categoryId,
    paidBy: v.paidBy,
    crewMemberId: v.paidBy === "crew" ? v.crewMemberId : null,
    receiptFileId,
  };
}

/** Under a crew-paid expense: who gets the money back, and when (pay rules §7). No amount, so foremen see it too. */
export const reimbursementNote = (name: string): string => `${name} is paid this back in the next pay run.`;

/** Reads typed dollars and cents as integer cents (`src/domain/money`); blank is null, anything else unreadable. */
export function readCents(text: string | null): TypedCents {
  const raw = (text ?? "").replace(/[$,\s]/g, "");
  if (raw === "") return null;
  try {
    return toCents(raw);
  } catch {
    return "unreadable";
  }
}

type Query = Record<string, string | string[] | undefined>;
type Picks = { projects: { id: string; stages: { id: string }[] }[]; categories: { id: string }[]; crew: { id: string }[] };

/**
 * The prototype's states from the address: `job` (from a job's Add expense), `stage`, `total`, `supplier`,
 * `category`, `paid`, `crew`, `gst=none`, `check=1` (as after a refused Save expense) and `saved=waiting`.
 * Anything that isn't on the pick lists is ignored.
 */
export function expenseFromQuery(q: Query, today: string, picks: Picks): { values: ExpenseFormValues; check: boolean; saved: boolean } {
  const job = picks.projects.find((p) => p.id === one(q.job));
  const v = emptyExpense(today, job?.id ?? "");
  const stage = one(q.stage);
  if (job && job.stages.some((s) => s.id === stage)) v.stageId = stage;
  v.totalCents = readCents(one(q.total));
  v.supplier = one(q.supplier) ?? "";
  const category = one(q.category);
  if (picks.categories.some((c) => c.id === category)) v.categoryId = category!;
  const paid = PAID_BY.find((p) => p.value === one(q.paid));
  if (paid) v.paidBy = paid.value;
  const crew = one(q.crew);
  if (v.paidBy === "crew" && picks.crew.some((c) => c.id === crew)) v.crewMemberId = crew;
  if (one(q.gst) === "none") v.gst = "none";
  return { values: v, check: one(q.check) === "1", saved: one(q.saved) === "waiting" };
}
