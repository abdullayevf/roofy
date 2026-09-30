import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { NoWorkEntry, NoWorkSkeleton } from "@/components/screens/log-no-work";
import { loadNoWorkScreen } from "../load-no-work";

export const metadata: Metadata = { title: "Mark no work" };

/** No-work marker: who didn't work, on which day, and why. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  if (ctx.demo.loading) return <NoWorkSkeleton />;
  const back = backLink(ctx.actor.role);
  if (!canOpen(ctx.actor.role, "log")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const screen = await loadNoWorkScreen(ctx, await searchParams);
  if (screen.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const { defaults, today, start, demo } = screen;
  return (
    <NoWorkEntry
      key={`${defaults.date}|${start.crewMemberIds.join(",")}|${start.reason}`}
      defaults={defaults}
      today={today}
      start={start}
      demo={demo}
    />
  );
}
