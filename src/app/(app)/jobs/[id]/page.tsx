import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { JobDetailBody, JobDetailError, JobDetailSkeleton } from "@/components/screens/job-detail";

export const metadata: Metadata = { title: "Job" };

/**
 * Job detail (screen 11): the job, its stages and, for an owner or manager, its money. A foreman opens only a job they
 * are on, and their copy carries no rates, amounts, budgets or margins.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  if (demo.loading) return <JobDetailSkeleton manager={actor.role !== "foreman"} />;
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "jobs")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const { id } = await params;
  let job;
  try {
    job = await ctx.data.projects.get(actor, id);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <JobDetailError />;
    throw e;
  }
  return <JobDetailBody job={job} today={ctx.today} />;
}
