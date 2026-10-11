import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import type { ReportKind } from "@/data/contracts";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { keyFigureText, ReportsIndex, ReportsIndexError, ReportsIndexSkeleton, type ReportCard } from "@/components/screens/reports";
import { defaultReportRange } from "@/components/screens/reports-text";
import { loadAll, updatedText } from "./load-reports";

export const metadata: Metadata = { title: "Reports" };

/**
 * Reports (flows.md screen 22): five cards for the last 3 months, each with its key figure. Owner, Manager and
 * Accountant read reports; a foreman gets no permission before any data is asked for, so no figure is in the HTML.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo, today } = ctx;
  const back = backLink(actor.role);
  if (actor.role === "foreman") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (demo.loading) return <ReportsIndexSkeleton />;
  const range = defaultReportRange(today);
  const result = await loadAll(ctx, range);
  if (result.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (result.kind === "unavailable") return <ReportsIndexError />;
  const { jobs, crew, productivity, pauses, pay, figures } = result.value;
  const losing = jobs.filter((j) => j.forecastMarginCents < 0).length;
  const none = "Nothing in this range yet.";
  /** Each card's figure and label come from the report's own key figure, so the hub and the report agree. */
  const card = (kind: ReportKind, count: number, extra = ""): ReportCard => ({
    kind,
    money: figures[kind].format === "money",
    figure: count ? keyFigureText(figures[kind]) : "",
    line: count ? `${figures[kind].label}.${extra}` : none,
  });
  const cards: ReportCard[] = [
    card("job-profitability", jobs.length, ` ${losing === 1 ? "1 is" : `${losing} are`} losing money.`),
    card("crew", crew.length),
    card("productivity", productivity.length),
    card("pauses", pauses.length),
    card("pay-history", pay.length),
  ];
  return <ReportsIndex cards={cards} range={range} today={today} updated={updatedText(demo.offline)} />;
}
