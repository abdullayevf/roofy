import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { EntryError } from "@/components/screens/field-entry";
import { LogCrewDay, LogSkeleton } from "@/components/screens/log-crew-day";
import { loadLogScreen } from "./load-log";

export const metadata: Metadata = { title: "Log" };

/** Log crew-day grid. The day, job, stage and pre-ticked crew ("Same as yesterday", or an entry reopened from the outbox) come from the address. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  if (ctx.demo.loading) return <LogSkeleton />;
  const back = backLink(ctx.actor.role);
  if (!canOpen(ctx.actor.role, "log")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const screen = await loadLogScreen(ctx, await searchParams);
  if (screen.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (screen.kind === "unavailable") return <EntryError screen="log" active="crew-day" demo={ctx.demo.state ?? undefined} />;
  const { defaults, ticked, picks, dateFromAddress, today, demo } = screen;
  return (
    <LogCrewDay
      key={`${defaults.date}|${defaults.projectId}|${defaults.stageId}|${ticked.join(",")}|${JSON.stringify(picks)}`}
      defaults={defaults}
      initialTicked={ticked}
      initialPicks={picks}
      today={today}
      dateFromAddress={dateFromAddress}
      demo={demo}
    />
  );
}
