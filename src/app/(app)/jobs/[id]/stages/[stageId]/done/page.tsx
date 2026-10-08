import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { StageDone, StageDoneError, StageDoneSkeleton } from "@/components/screens/stage-done";

export const metadata: Metadata = { title: "Mark stage done" };

/** Stage done (screen 13): Manager/Owner only. A foreman never gets the proposal (it carries the lump sum), only No permission. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string; stageId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const { id, stageId } = await params;
  if (demo.loading) return <StageDoneSkeleton jobId={id} stageId={stageId} />;
  const back = backLink(actor.role);
  const noPermission = <NoPermission backHref={back.href} backLabel={back.label} />;
  if (!canOpen(actor.role, "jobs")) return noPermission;
  let stage, proposal;
  try {
    stage = await ctx.data.stages.get(actor, stageId);
    if (stage.projectId !== id) notFound();
    if (!stage.actions.canMarkDone) {
      if (stage.view === "foreman") return noPermission;
      redirect(`/jobs/${id}/stages/${stageId}`);
    }
    proposal = await ctx.data.stages.doneProposal(actor, stageId);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return noPermission;
    if (isDataError(e) && e.code === "unavailable") return <StageDoneError jobId={id} stageId={stageId} />;
    throw e;
  }
  return <StageDone proposal={proposal} today={ctx.today} demoOffline={demo.offline} />;
}
