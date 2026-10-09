import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { CrewDetailBody, CrewDetailError, CrewDetailSkeleton } from "@/components/screens/crew-detail";

export const metadata: Metadata = { title: "Crew member" };

/**
 * Crew member detail (screen 15): one person's balance, pay and payments, statements, rates and recent work. Manager
 * and owner only; a foreman or an accountant gets the no-access page, and no figure is fetched for them.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  if (demo.loading) return <CrewDetailSkeleton />;
  const back = backLink(actor.role);
  if (actor.role !== "owner" && actor.role !== "manager") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const { id } = await params;
  let crew;
  try {
    crew = await ctx.data.crew.get(actor, id);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <CrewDetailError />;
    throw e;
  }
  return <CrewDetailBody crew={crew} today={ctx.today} demoOffline={demo.state === "offline"} />;
}
