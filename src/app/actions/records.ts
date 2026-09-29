"use server";
/** Edits of saved logs and expenses (Owner/Manager; online only). Locked lines become adjustments. */
import { expensePatchSchema, idSchema, logEditSchema } from "@/data/admin-inputs";
import type { ActionResult, EntryResult, ExpenseInput, Hundredths, Id } from "@/data/contracts";
import { act, PATHS } from "./run";

const RECORDS = [
  PATHS.home,
  PATHS.jobs,
  PATHS.log,
  PATHS.crew,
  PATHS.expenses,
  PATHS.pay,
  PATHS.reports,
  PATHS.history,
];

export async function editLog(
  logId: Id,
  input: { hours?: Hundredths; days?: Hundredths; quantity?: Hundredths },
): Promise<ActionResult<{ result: EntryResult }>> {
  return act(
    [idSchema, logEditSchema],
    [logId, input],
    async ({ data, actor }, id, i) => ({ result: await data.logs.editLog(actor, id, i) }),
    RECORDS,
  );
}

export async function deleteLog(logId: Id): Promise<ActionResult<{ result: EntryResult }>> {
  return act(
    [idSchema],
    [logId],
    async ({ data, actor }, id) => ({ result: await data.logs.deleteLog(actor, id) }),
    RECORDS,
  );
}

export async function updateExpense(
  expenseId: Id,
  input: Partial<ExpenseInput>,
): Promise<ActionResult<{ result: EntryResult }>> {
  return act(
    [idSchema, expensePatchSchema],
    [expenseId, input],
    async ({ data, actor }, id, i) => ({ result: await data.expenses.update(actor, id, i) }),
    RECORDS,
  );
}
