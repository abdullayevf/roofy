import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { parseExpenseFilter } from "@/components/screens/expense-input";
import { ExpenseListBody, ExpensesError, ExpensesSkeleton } from "@/components/screens/expense-list";
import { loadExpenses } from "./load-expenses";

export const metadata: Metadata = { title: "Expenses" };

/**
 * Expenses list: every receipt, newest first, with ex GST and GST totals (owner, manager, accountant). A foreman sees
 * the receipts on their jobs with no amounts. `?job=` and `?stage=` narrow it, with a chip that takes the filter off.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  if (demo.loading) return <ExpensesSkeleton manager={actor.role !== "foreman"} canAdd={actor.role !== "accountant"} />;
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "expenses")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const result = await loadExpenses(ctx, parseExpenseFilter(await searchParams));
  if (result.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (result.kind === "unavailable")
    return <ExpensesError filter={parseExpenseFilter(await searchParams)} names={{ job: null, stage: null }} demo={demo.state ?? undefined} />;
  return (
    <ExpenseListBody
      list={result.list}
      filter={result.filter}
      names={result.names}
      anyExpenses={result.anyExpenses}
      canAdd={actor.role !== "accountant"}
      today={ctx.today}
      demo={demo.state ?? undefined}
    />
  );
}
