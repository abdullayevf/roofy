import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { HistoryError, HistoryList, HistorySkeleton } from "@/components/screens/history";
import { parseHistoryFilter } from "@/components/screens/history-text";
import { updatedText } from "../reports/load-reports";
import { loadHistory } from "./load-history";

export const metadata: Metadata = { title: "Record history" };

/**
 * Record history (flows.md screen 25): who changed what and when, newest first, in plain words. `?job=` and `?crew=`
 * narrow it (the data layer filters) with a "Showing" line and a way to clear it. Owner and Manager only; an
 * Accountant or Foreman gets no permission and no rows.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo, today } = ctx;
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "history")) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const filter = parseHistoryFilter(await searchParams);
  const frame = { filter, today, updated: updatedText(demo.offline), demo: demo.state ?? undefined };
  if (demo.loading) return <HistorySkeleton {...frame} />;
  const result = await loadHistory(ctx, filter);
  if (result.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (result.kind === "unavailable") return <HistoryError {...frame} />;
  return <HistoryList {...frame} {...result.value} />;
}
