import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { JobError } from "@/components/screens/job-error";
import { JobForm, JobFormSkeleton } from "@/components/screens/job-form";
import { parseJobPrefill } from "@/components/screens/job-input";
import { loadJobForm } from "../load-job-form";

export const metadata: Metadata = { title: "New job" };

/** New job: owner and manager only. The address can open it already filled in (`client`, `type`, `name`, `address`, `contract`, `status`, `start`, `finish`, `accepted=1`). */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const back = backLink(ctx.actor.role);
  if (ctx.demo.loading) return <JobFormSkeleton mode="new" />;
  if (ctx.actor.role !== "owner" && ctx.actor.role !== "manager") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const form = await loadJobForm(ctx, true);
  if (form.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (form.kind === "unavailable") return <JobError mode="new" />;
  const { accepted, ...initial } = parseJobPrefill(await searchParams, new Set(form.clients.map((c) => c.id)));
  return (
    <JobForm
      mode="new"
      clients={form.clients}
      initial={initial}
      proposals={form.proposals}
      initialAccepted={accepted && initial.jobType !== "" && form.proposals[initial.jobType] !== null}
      demoOffline={ctx.demo.offline}
    />
  );
}
