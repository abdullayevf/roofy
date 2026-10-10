import type { Metadata } from "next";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { ExpenseForm, ExpenseFormError, ExpenseFormSkeleton } from "@/components/screens/expense-form";

export const metadata: Metadata = { title: "Add expense" };

/**
 * Add expense (screen 17): owner, manager and foreman (a field entry, queued through the outbox like a crew day).
 * The pickers come from the reference snapshot, which carries no rates or amounts. `?job=` comes from a job's Add
 * expense and chooses the job; the accountant, who only reads expenses, gets the no-access page.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  if (demo.loading) return <ExpenseFormSkeleton />;
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "expenses") || actor.role === "accountant") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const sp = await searchParams;
  const job = typeof sp.job === "string" ? sp.job : null;
  let snap;
  try {
    snap = await ctx.data.sync.snapshot(actor);
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <ExpenseFormError backHref="/expenses" />;
    throw e;
  }
  const query = Object.fromEntries(
    ["job", "stage", "total", "supplier", "category", "paid", "crew", "gst", "check", "saved"].flatMap((k) => {
      const v = sp[k];
      const t = Array.isArray(v) ? v[0] : v;
      return t ? [[k, t]] : [];
    }),
  );
  const fromJob = job !== null && snap.projects.some((p) => p.id === job);
  return (
    <ExpenseForm
      key={JSON.stringify(sp)}
      foreman={actor.role === "foreman"}
      projects={snap.projects}
      categories={snap.categories}
      crew={snap.crew}
      today={ctx.today}
      query={query}
      backHref={fromJob && job ? `/expenses?job=${job}` : "/expenses"}
    />
  );
}
