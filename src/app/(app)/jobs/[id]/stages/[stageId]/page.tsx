import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { StageDetailBody, StageDetailError, StageDetailSkeleton } from "@/components/screens/stage-detail";

export const metadata: Metadata = { title: "Stage" };

/** Stage detail (screen 12): status, what can be done now, segments, lost days and progress. Foreman copy has no money. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string; stageId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const { id, stageId } = await params;
  if (demo.loading) return <StageDetailSkeleton jobId={id} />;
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "jobs")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  let stage;
  try {
    stage = await ctx.data.stages.get(actor, stageId);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <StageDetailError jobId={id} />;
    throw e;
  }
  if (stage.projectId !== id) notFound();
  return <StageDetailBody stage={stage} today={ctx.today} demoOffline={demo.offline} />;
}
