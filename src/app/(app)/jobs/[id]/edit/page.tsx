import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { JobError } from "@/components/screens/job-error";
import { JobForm, JobFormSkeleton } from "@/components/screens/job-form";
import { loadJobForm } from "../../load-job-form";

export const metadata: Metadata = { title: "Edit job" };

/** Edit job: owner and manager only. Stages are changed on the job's own page, not here. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const back = backLink(ctx.actor.role);
  if (ctx.demo.loading) return <JobFormSkeleton mode="edit" />;
  if (ctx.actor.role !== "owner" && ctx.actor.role !== "manager") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const { id } = await params;
  const form = await loadJobForm(ctx, false);
  if (form.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (form.kind === "unavailable") return <JobError mode="edit" />;
  let job;
  try {
    job = await ctx.data.projects.get(ctx.actor, id);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <JobError mode="edit" />;
    throw e;
  }
  if (job.view !== "manager") return <NoPermission backHref={back.href} backLabel={back.label} />;
  return (
    <JobForm
      mode="edit"
      projectId={job.id}
      clients={form.clients}
      initial={{
        clientId: job.client.id,
        jobType: job.jobType,
        nickname: job.name,
        siteAddress: job.siteAddress,
        contractCents: job.contractCents,
        status: job.status,
        startDate: job.startDate ?? "",
        targetFinish: job.targetFinish ?? "",
      }}
      proposals={{}}
      demoOffline={ctx.demo.offline}
    />
  );
}
