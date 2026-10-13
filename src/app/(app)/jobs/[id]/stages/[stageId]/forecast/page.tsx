import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { StageForecastBody, StageForecastError, StageForecastSkeleton } from "@/components/screens/stage-forecast";

export const metadata: Metadata = { title: "Forecast labour" };

/** The lines behind a stage's forecast labour and the working (flows "Find the job losing money", tap 2). No foreman: it is all money. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string; stageId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const { id, stageId } = await params;
  const back = backLink(actor.role);
  if (actor.role === "foreman" || !canOpen(actor.role, "jobs")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (demo.loading) return <StageForecastSkeleton jobId={id} stageId={stageId} />;
  let stage;
  try {
    stage = await ctx.data.stages.get(actor, stageId);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <StageForecastError jobId={id} stageId={stageId} />;
    throw e;
  }
  if (stage.projectId !== id) notFound();
  if (stage.view !== "manager") return <NoPermission backHref={back.href} backLabel={back.label} />;
  return <StageForecastBody stage={stage} today={ctx.today} />;
}
