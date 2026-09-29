import { receiptTotal, splitReceipt } from "@/domain/gst";
import { sum } from "@/domain/money";
import type {
  Actor,
  DateRange,
  EntryFlag,
  EntryResult,
  ExpenseDetail,
  ExpenseInput,
  ExpenseList,
  ExpenseService,
  Id,
} from "../../contracts";
import type { ExpenseRow } from "../rows";
import { FIELD_ACCESS, notFound, type FakeContext } from "./context";
import {
  approvedRunOn,
  entryResult,
  invalid,
  requireCrewOn,
  requireEditor,
  requireFieldWriter,
  snapshot,
  write,
} from "./writes";

/** Job, stage, category and payer references an expense may point at, else `invalid`. */
function checkRefs(c: FakeContext, actor: Actor, e: Omit<ExpenseInput, "totalCents" | "gstCents">): void {
  c.requireProject(actor, e.projectId);
  if (e.stageId !== null && c.ix.stages.get(e.stageId)?.projectId !== e.projectId)
    throw invalid("That stage isn't on this job. Pick the stage again.");
  if (!c.ix.categories.has(e.categoryId)) throw invalid("Pick a category from the list.");
  if (e.paidBy === "crew") {
    if (e.crewMemberId === null) throw invalid("Pick who paid.");
    requireCrewOn(c, e.crewMemberId, e.date);
  } else if (e.crewMemberId !== null) {
    throw invalid("Only a crew-paid expense names a crew member.");
  }
}

/** Product spec §5.7: stored as ex GST + GST; GST defaults to total ÷ 11 (`splitReceipt`). */
function amounts(totalCents: number, gstCents: number | null) {
  if (gstCents !== null && gstCents > totalCents) throw invalid("GST can't be more than the total.");
  return gstCents === null ? splitReceipt(totalCents) : splitReceipt(totalCents, gstCents);
}

/** Crew-paid, dated in an approved period → reimbursed in the next draft (pay rules §7). */
const lateReimbursement = (c: FakeContext, e: ExpenseRow): EntryFlag[] =>
  e.paidBy === "crew" && approvedRunOn(c.t, e.date) ? ["late_entry"] : [];

export function createExpenseService(c: FakeContext): ExpenseService {
  return {
    async list(actor: Actor, filter?: { projectId?: Id; range?: DateRange }): Promise<ExpenseList> {
      if (filter?.projectId) c.requireProject(actor, filter.projectId);
      const range = filter?.range;
      const rows = (filter?.projectId ? [...c.ix.expensesOf(filter.projectId)] : c.t.expenses)
        .filter(
          (e) =>
            (!range || (e.date >= range.from && e.date <= range.to)) && c.canSeeProject(actor, e.projectId),
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      if (c.isForeman(actor))
        return { view: "foreman", access: FIELD_ACCESS, rows: rows.map((e) => c.expenseForeman(e)) };
      return {
        view: "manager",
        access: c.access(actor),
        rows: rows.map((e) => c.expenseManager(e)),
        totals: {
          exGstCents: sum(rows.map((e) => e.amountExGstCents)),
          gstCents: sum(rows.map((e) => e.gstCents)),
        },
      };
    },

    async get(actor: Actor, expenseId: Id): Promise<ExpenseDetail> {
      const e = c.ix.expenses.get(expenseId);
      if (!e) throw notFound("expense");
      c.requireProject(actor, e.projectId);
      const file = e.receiptFileId === null ? undefined : c.ix.files.get(e.receiptFileId);
      const receipt = file ? c.fileRef(file) : null;
      if (c.isForeman(actor))
        return { view: "foreman", access: FIELD_ACCESS, expense: c.expenseForeman(e), receipt };
      const run = e.reimbursedInPayRunId === null ? undefined : c.ix.payRuns.get(e.reimbursedInPayRunId);
      return {
        view: "manager",
        access: c.access(actor),
        expense: c.expenseManager(e),
        receipt,
        inApprovedPayRun: run !== undefined && run.status !== "draft",
        historyHref: `/history?table=expense&rowId=${e.id}`,
      };
    },

    /** Field entry: Owner, Manager, Foreman on assigned jobs (the result carries no amounts). */
    async create(actor: Actor, input: ExpenseInput, mutationId?: Id): Promise<EntryResult> {
      requireFieldWriter(c, actor);
      checkRefs(c, actor, input);
      const split = amounts(input.totalCents, input.gstCents);
      const row = write(c, actor, "expense", (w) => {
        const row: ExpenseRow = {
          ...w.base(),
          projectId: input.projectId,
          stageId: input.stageId,
          categoryId: input.categoryId,
          supplier: input.supplier,
          date: input.date,
          amountExGstCents: split.amountExGstCents,
          gstCents: split.gstCents,
          paidBy: input.paidBy,
          crewMemberId: input.crewMemberId,
          receiptFileId: input.receiptFileId,
          reimbursedInPayRunId: null,
          enteredBy: actor.userId,
          mutationId: mutationId ?? null,
        };
        w.t.expenses.push(row);
        w.audit("expense", row.id, "insert", null, snapshot(row));
        return row;
      });
      return entryResult(actor, [row.id], lateReimbursement(c, row));
    },

    /**
     * Owner/Manager edit; audited. A new total without a GST keeps "No GST" if it had none, else
     * re-defaults to total ÷ 11. An expense already reimbursed in an approved pay run keeps that
     * reimbursement (the difference isn't carried to a later run in Phase 2 — see PROGRESS open issues).
     */
    async update(actor: Actor, expenseId: Id, input: Partial<ExpenseInput>): Promise<EntryResult> {
      requireEditor(c, actor);
      const e = c.ix.expenses.get(expenseId);
      if (!e) throw notFound("expense");
      c.requireProject(actor, e.projectId);
      const next = {
        date: input.date ?? e.date,
        supplier: input.supplier ?? e.supplier,
        projectId: input.projectId ?? e.projectId,
        stageId: input.stageId !== undefined ? input.stageId : e.stageId,
        categoryId: input.categoryId ?? e.categoryId,
        paidBy: input.paidBy ?? e.paidBy,
        crewMemberId: input.crewMemberId !== undefined ? input.crewMemberId : e.crewMemberId,
        receiptFileId: input.receiptFileId !== undefined ? input.receiptFileId : e.receiptFileId,
      };
      if (input.paidBy !== undefined && input.paidBy !== "crew" && input.crewMemberId === undefined)
        next.crewMemberId = null;
      checkRefs(c, actor, next);
      const total = input.totalCents ?? receiptTotal(e);
      const gst =
        input.gstCents !== undefined
          ? input.gstCents
          : input.totalCents === undefined || e.gstCents === 0
            ? e.gstCents
            : null;
      const split = amounts(total, gst);
      write(c, actor, "expense_update", (w) => {
        const before = snapshot(e);
        Object.assign(e, next, split, { updatedAt: w.at });
        w.audit("expense", e.id, "update", before, snapshot(e));
      });
      return entryResult(actor, [e.id], []);
    },
  };
}
