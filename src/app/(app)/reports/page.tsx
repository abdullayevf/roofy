import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { sum } from "@/domain/money";
import { formatMoney } from "@/lib/format";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { ReportsIndex, ReportsIndexError, ReportsIndexSkeleton, type ReportCard } from "@/components/screens/reports";
import { countText, defaultReportRange } from "@/components/screens/reports-text";
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
  const { jobs, crew, productivity, pauses, pay } = result.value;
  const losing = jobs.filter((j) => j.forecastMarginCents < 0).length;
  const none = "Nothing in this range yet.";
  const cards: ReportCard[] = [
    {
      kind: "job-profitability",
      money: true,
      figure: jobs.length ? formatMoney(sum(jobs.map((j) => j.forecastMarginCents))) : "",
      line: jobs.length ? `Forecast margin on ${countText(jobs.length, "job")}. ${losing === 1 ? "1 is" : `${losing} are`} losing money.` : none,
    },
    {
      kind: "crew",
      money: true,
      figure: crew.length ? formatMoney(sum(crew.map((c) => c.earningsCents))) : "",
      line: crew.length ? `Earned by ${crew.length === 1 ? "1 person" : `${crew.length} people`}.` : none,
    },
    {
      kind: "productivity",
      money: false,
      figure: productivity.length ? countText(new Set(productivity.map((p) => p.stageName)).size, "stage") : "",
      line: productivity.length ? "Units per crew-day, by stage and month." : none,
    },
    {
      kind: "pauses",
      money: false,
      figure: pauses.length ? `${countText(sum(pauses.map((p) => p.workingDays)), "working day")} paused` : "",
      line: pauses.length ? `Across ${countText(new Set(pauses.map((p) => p.projectId)).size, "job")}.` : none,
    },
    {
      kind: "pay-history",
      money: true,
      figure: pay.length ? formatMoney(sum(pay.map((p) => p.totalCents))) : "",
      line: pay.length ? `Paid in ${countText(pay.length, "pay run")}.` : none,
    },
  ];
  return <ReportsIndex cards={cards} range={range} today={today} updated={updatedText(demo.offline)} />;
}
