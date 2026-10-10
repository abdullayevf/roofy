import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError, type ExpenseDetail } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { ExpenseDetailSkeleton, ExpenseDetailView } from "@/components/screens/expense-detail";
import { ExpenseForm, ExpenseFormError, ExpenseFormSkeleton } from "@/components/screens/expense-form";
import { expenseValuesFrom } from "@/components/screens/expense-input";

export const metadata: Metadata = { title: "Expense" };

/**
 * One expense (screen 17, edit): Owner and Manager see it and change it; `?edit=1` opens the filled-in form. Saving
 * an edit needs a connection (flows.md "Expense edit"). A foreman or accountant gets the no-access page.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const back = backLink(actor.role);
  if (actor.role !== "owner" && actor.role !== "manager")
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  const { id } = await params;
  const sp = await searchParams;
  if (demo.loading) return sp.edit === "1" ? <ExpenseFormSkeleton edit /> : <ExpenseDetailSkeleton />;
  let detail: ExpenseDetail;
  let snap;
  try {
    detail = await ctx.data.expenses.get(actor, id);
    snap = await ctx.data.sync.snapshot(actor);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden")
      return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable")
      return sp.edit === "1" ? (
        <ExpenseFormError backHref={`/expenses/${id}`} title="Edit expense" back="Back to this expense" />
      ) : (
        <ExpenseFormError backHref="/expenses" title="Expense" />
      );
    throw e;
  }
  if (detail.view !== "manager") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const receiptName = detail.receipt?.name ?? null;
  const demoParam = typeof sp.demo === "string" ? `&demo=${sp.demo}` : "";
  if (sp.edit === "1") {
    return (
      <ExpenseForm
        foreman={false}
        projects={snap.projects}
        categories={snap.categories}
        crew={snap.crew}
        today={ctx.today}
        query={{}}
        backHref={`/expenses/${id}`}
        edit={{
          expenseId: id,
          values: expenseValuesFrom(detail.expense),
          inApprovedPayRun: detail.inApprovedPayRun,
          receiptName,
          demoOffline: demo.offline,
        }}
      />
    );
  }
  return (
    <ExpenseDetailView
      expense={detail.expense}
      receiptName={receiptName}
      inApprovedPayRun={detail.inApprovedPayRun}
      historyHref={detail.historyHref}
      today={ctx.today}
      saved={sp.saved === "1"}
      editHref={`/expenses/${id}?edit=1${demoParam}`}
    />
  );
}
