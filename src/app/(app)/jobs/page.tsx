import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { parseStatusFilter } from "@/components/screens/job-input";
import { JobsError, JobsListBody, JobsSkeleton } from "@/components/screens/jobs-list";
import { loadJobs } from "./load-jobs";

export const metadata: Metadata = { title: "Jobs" };

/** Jobs list: every job with a status filter (Active by default). A foreman sees only their jobs, with no money. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  if (demo.loading) return <JobsSkeleton manager={actor.role !== "foreman"} />;
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "jobs")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const filter = parseStatusFilter((await searchParams).status);
  const canAdd = actor.role === "owner" || actor.role === "manager";
  const jobs = await loadJobs(ctx, filter);
  if (jobs.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (jobs.kind === "unavailable") return <JobsError canAdd={canAdd} filter={filter} demo={demo.state ?? undefined} />;
  return <JobsListBody list={jobs.list} filter={filter} anyJobs={jobs.anyJobs} canAdd={canAdd} demo={demo.state ?? undefined} />;
}
