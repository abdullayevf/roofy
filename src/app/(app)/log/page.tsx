import type { Metadata } from "next";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { LogCrewDay, LogSkeleton } from "@/components/screens/log-crew-day";

export const metadata: Metadata = { title: "Log" };

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

/** Log crew-day grid. The job, stage and pre-ticked crew ("Same as yesterday") come from the address. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { data, actor, demo } = await getData({ searchParams });
  const params = await searchParams;
  if (demo.loading) return <LogSkeleton />;
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "log")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const project = one(params.project);
  const stage = one(params.stage);
  const crew = one(params.crew)?.split(",").filter(Boolean) ?? [];
  let defaults;
  try {
    defaults = await data.logs.crewDayDefaults(actor, { projectId: project, stageId: stage });
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") {
      return <NoPermission backHref={back.href} backLabel={back.label} />;
    }
    throw e;
  }
  return (
    <LogCrewDay
      key={`${defaults.projectId}|${defaults.stageId}|${crew.join(",")}`}
      defaults={defaults}
      initialTicked={crew}
      demo={one(params.demo)}
    />
  );
}
