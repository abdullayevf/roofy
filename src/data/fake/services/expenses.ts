import { sum } from "@/domain/money";
import type { Actor, DateRange, ExpenseDetail, ExpenseList, ExpenseService, Id } from "../../contracts";
import { FIELD_ACCESS, notFound, notYet, type FakeContext } from "./context";

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

    create: () => notYet("expenses.create"),
    update: () => notYet("expenses.update"),
  };
}
