import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { EntryError } from "@/components/screens/field-entry";
import { ProgressEntry, ProgressSkeleton } from "@/components/screens/log-progress";
import { loadProgressScreen } from "../load-progress";

export const metadata: Metadata = { title: "Log progress" };

/** Progress entry: the quantity done on a stage, and who it is split between. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  if (ctx.demo.loading) return <ProgressSkeleton />;
  const back = backLink(ctx.actor.role);
  if (!canOpen(ctx.actor.role, "log")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const screen = await loadProgressScreen(ctx, await searchParams);
  if (screen.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (screen.kind === "unavailable") return <EntryError screen="log-progress" active="progress" demo={ctx.demo.state ?? undefined} />;
  const { defaults, start, today, demo } = screen;
  return (
    <ProgressEntry
      key={`${defaults.date}|${start.stageId}|${start.quantity}|${start.crewMemberIds.join(",")}|${start.shares?.join(",")}`}
      defaults={defaults}
      start={start}
      today={today}
      demo={demo}
    />
  );
}
