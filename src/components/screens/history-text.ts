import type { AuditRow } from "@/data/contracts";
import { sum } from "@/domain/money";
import { formatDate, formatMoney } from "@/lib/format";
import { pauseReasonText } from "./home-text";

/** What Record history is narrowed to: a job (`?job=`), a person (`?crew=`) or one row (from Expense detail). */
export type HistoryFilter = { projectId: string | null; crewMemberId: string | null; table: string | null; rowId: string | null };

const one = (v: string | string[] | undefined): string | null => (typeof v === "string" && v !== "" ? v : null);

export function parseHistoryFilter(params: Record<string, string | string[] | undefined>): HistoryFilter {
  return { projectId: one(params.job), crewMemberId: one(params.crew), table: one(params.table), rowId: one(params.rowId) };
}

export const historyIsFiltered = (f: HistoryFilter): boolean => !!(f.projectId || f.crewMemberId || f.rowId);

/** The list's address for a filter, keeping the demo state so a captured state survives clearing it. */
export function historyHref(filter: HistoryFilter, demo?: string): string {
  const q = new URLSearchParams();
  if (filter.projectId) q.set("job", filter.projectId);
  if (filter.crewMemberId) q.set("crew", filter.crewMemberId);
  if (filter.table && filter.rowId) {
    q.set("table", filter.table);
    q.set("rowId", filter.rowId);
  }
  if (demo) q.set("demo", demo);
  const s = q.toString();
  return s ? `/history?${s}` : "/history";
}

/** "Showing Smith job": the one visible line saying what the list is narrowed to. */
export function historyFilterText(names: { job: string | null; crew: string | null; row: string | null }): string | null {
  const name = names.job ?? names.crew ?? names.row;
  return name ? `Showing ${name}` : null;
}

const LABEL: Record<string, string> = {
  amountExGstCents: "amount before GST",
  gstCents: "GST",
  amountCents: "amount",
  rateCents: "rate",
  floorRateCents: "lowest rate",
  manualPctBp: "progress",
  pauseReason: "pause reason",
  effectiveFrom: "start date",
  basis: "pay basis",
  nickname: "name",
};

const STATUS: Record<string, string> = { not_started: "not started", active: "active", paused: "paused", done: "done", draft: "draft", approved: "approved", exported: "exported" };
const BASIS: Record<string, string> = { hourly: "an hour", daily: "a day", per_unit: "a unit", lump_sum: "a lump sum", time_only: "time only" };

const looksLikeId = (v: unknown): boolean => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f-]{4,}$/i.test(v);

/** "pauseReason" -> "pause reason"; a trailing Cents, Bp or Id is dropped (the value shows the unit). */
function labelOf(field: string): string {
  const known = LABEL[field];
  if (known) return known;
  return field
    .replace(/(Cents|Bp|Id)$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}

function percent(bp: number): string {
  return `${bp % 100 === 0 ? bp / 100 : (bp / 100).toFixed(2)}%`;
}

/** One value in plain words, or null when it is an id (never shown) or empty. */
function valueText(field: string, value: unknown, today: string): string | null {
  if (value === null || value === undefined) return null;
  if (looksLikeId(value)) return null;
  if (typeof value === "number") {
    if (field.endsWith("Cents")) return formatMoney(value);
    if (field.endsWith("Bp")) return percent(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value, today);
    if (field === "pauseReason") return pauseReasonText(value as Parameters<typeof pauseReasonText>[0]);
    if (field === "status") return STATUS[value] ?? value.replace(/_/g, " ");
    if (field === "basis") return BASIS[value]?.replace(/^an? /, "") ?? value.replace(/_/g, " ");
    return value.replace(/_/g, " ");
  }
  return null;
}

const WAITING: Record<string, string> = { weather: "weather", materials: "materials", client: "the client", other_job: "another job", other: "something else" };

/** "Pay run for 14 Sep" in the middle of a sentence is "pay run for 14 Sep". */
const mid = (subject: string): string => subject.replace(/^Pay run(?: for)?\b/, "pay run");

/** A pay run status change as one verb: "Approved pay run Mon 14 Sep to Sun 20 Sep"; null for anything else. */
function payRunSentence(row: AuditRow): string | null {
  if (row.table !== "pay_run" || row.action !== "update" || row.fields.some((f) => f !== "status")) return null;
  const now = row.after?.status;
  if (now === "approved") return `Approved ${mid(row.subject)}`;
  if (now === "exported") return `Exported ${mid(row.subject)}`;
  if (now === "draft") return `Moved ${mid(row.subject)} back to draft`;
  return null;
}

/** A stage pause, restart or finish as one plain sentence; null when the change is anything else. */
function stageSentence(row: AuditRow): string | null {
  if (row.table !== "stage" || row.action !== "update" || !row.fields.includes("status")) return null;
  if (row.fields.some((f) => f !== "status" && f !== "pauseReason")) return null;
  const was = row.before?.status;
  const now = row.after?.status;
  if (now === "paused") {
    const why = typeof row.after?.pauseReason === "string" ? WAITING[row.after.pauseReason] : undefined;
    return `Paused ${row.subject}${why ? `, waiting on ${why}` : ""}`;
  }
  if (now === "active") return was === "paused" ? `Restarted ${row.subject}` : `Started ${row.subject}`;
  if (now === "done") return `Marked ${row.subject} done`;
  return null;
}

/** The sentence cut at each dollar amount, so the amounts can be set in figure style (N17). */
export function moneyParts(text: string): { text: string; money: boolean }[] {
  return text
    .split(/(\$[\d,]+\.\d{2})/)
    .filter((t) => t !== "")
    .map((t) => ({ text: t, money: /^\$[\d,]+\.\d{2}$/.test(t) }));
}

/** An expense's total is its amount plus GST; only the part present in the change counts. */
function expenseTotal(side: Record<string, unknown> | null): number | null {
  if (!side) return null;
  const parts = [side.amountExGstCents, side.gstCents].filter((x): x is number => typeof x === "number");
  return parts.length === 0 ? null : sum(parts);
}

function clause(label: string, from: string | null, to: string | null): string {
  if (to === null && from === null) return label;
  if (from === null) return `${label} to ${to}`;
  return `${label} from ${from} to ${to ?? "blank"}`;
}

function changeClauses(row: AuditRow, today: string): string[] {
  const out: string[] = [];
  const money = row.table === "expense" && row.fields.some((f) => f === "amountExGstCents" || f === "gstCents");
  if (money) {
    out.push(clause("total", expenseTotal(row.before) === null ? null : formatMoney(expenseTotal(row.before)!), expenseTotal(row.after) === null ? null : formatMoney(expenseTotal(row.after)!)));
  }
  for (const f of row.fields) {
    if (money && (f === "amountExGstCents" || f === "gstCents")) continue;
    out.push(clause(labelOf(f), valueText(f, row.before?.[f], today), valueText(f, row.after?.[f], today)));
  }
  return out;
}

/** The change in one plain sentence: "Changed total from $120.00 to $132.00 on Bunnings receipt". No table or field names. */
export function historySentence(row: AuditRow, today: string): string {
  if (row.action === "delete") return `Removed ${mid(row.subject)}`;
  if (row.action === "insert") {
    const a = row.after ?? {};
    if (typeof a.adjustsLogId === "string" && typeof a.amountCents === "number") {
      return `Added a ${formatMoney(a.amountCents)} pay adjustment to ${mid(row.subject)}`;
    }
    const amount = typeof a.amountCents === "number" ? ` of ${formatMoney(a.amountCents)}${typeof a.basis === "string" && BASIS[a.basis] ? ` ${BASIS[a.basis]}` : ""}` : "";
    const from = typeof a.effectiveFrom === "string" ? `, from ${formatDate(a.effectiveFrom, today)}` : "";
    return `Added ${mid(row.subject)}${amount}${from}`;
  }
  const stage = stageSentence(row) ?? payRunSentence(row);
  if (stage) return stage;
  const clauses = changeClauses(row, today);
  return clauses.length === 0 ? `Changed ${mid(row.subject)}` : `Changed ${clauses.join(" and ")} on ${mid(row.subject)}`;
}
