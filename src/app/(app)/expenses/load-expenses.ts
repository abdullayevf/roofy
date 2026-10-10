import type { DataContext } from "@/data";
import { isDataError, type ExpenseList } from "@/data/contracts";
import type { ExpenseFilter } from "@/components/screens/expense-input";
import type { ExpenseNames } from "@/components/screens/expense-list";

export type ExpensesData =
  | { kind: "ok"; list: ExpenseList; filter: ExpenseFilter; names: ExpenseNames; anyExpenses: boolean }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

const NONE: ExpenseFilter = { projectId: null, stageId: null };

/**
 * The expenses under a job and stage filter, the names the filter chips show, and whether the workspace has any
 * expense at all (for the empty-state wording). A job or stage that isn't found drops the filter: the whole list shows.
 */
export async function loadExpenses({ data, actor }: DataContext, wanted: ExpenseFilter): Promise<ExpensesData> {
  try {
    const filtered = wanted.projectId !== null || wanted.stageId !== null;
    let filter = wanted;
    let list: ExpenseList;
    try {
      list = await data.expenses.list(actor, {
        ...(wanted.projectId ? { projectId: wanted.projectId } : {}),
        ...(wanted.stageId ? { stageId: wanted.stageId } : {}),
      });
    } catch (e) {
      if (!filtered || !isDataError(e) || e.code === "forbidden" || e.code === "unavailable") throw e;
      filter = NONE;
      list = await data.expenses.list(actor);
    }
    const everyone = filter === NONE && !filtered ? list : filtered && filter !== NONE ? await data.expenses.list(actor) : list;
    const find = (pick: (r: ExpenseList["rows"][number]) => boolean) => [...list.rows, ...everyone.rows].find(pick);
    const names: ExpenseNames = {
      job: filter.projectId ? (find((r) => r.projectId === filter.projectId)?.projectName ?? null) : null,
      stage: filter.stageId ? (find((r) => r.stageId === filter.stageId)?.stageName ?? null) : null,
    };
    if ((filter.projectId && names.job === null) || (filter.stageId && names.stage === null)) {
      // No expense on the job yet: the chip still names it, from the jobs list.
      const job = filter.projectId ? await data.projects.get(actor, filter.projectId).catch(() => null) : null;
      names.job ??= job?.name ?? null;
      if (filter.stageId) names.stage ??= job?.stages.find((s) => s.id === filter.stageId)?.name ?? null;
    }
    return { kind: "ok", list, filter, names, anyExpenses: everyone.rows.length > 0 };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
