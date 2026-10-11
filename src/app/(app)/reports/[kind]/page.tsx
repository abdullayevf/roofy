import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { ReportError, ReportSkeleton, ReportView } from "@/components/screens/reports";
import { isReportKind, readReportRange, reportTitle } from "@/components/screens/reports-text";
import { loadOne, updatedText } from "../load-reports";

type Props = { params: Promise<{ kind: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  return { title: isReportKind(kind) ? reportTitle(kind) : "Reports" };
}

const one = (v: string | string[] | undefined): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * One report (flows.md screen 22): the range filter (last 3 months by default), phone rows or the desktop table, and
 * every row drills down to its source. An unknown kind is not found; a foreman gets no permission and no figures.
 */
export default async function Page({ params, searchParams }: Props) {
  const { kind } = await params;
  if (!isReportKind(kind)) notFound();
  const sp = await searchParams;
  const ctx = await getData({ searchParams });
  const { actor, demo, today } = ctx;
  const back = backLink(actor.role);
  if (actor.role === "foreman") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const { range, chosen } = readReportRange(today, { from: one(sp.from), to: one(sp.to) });
  const frame = { range, chosen, today, updated: updatedText(demo.offline) };
  if (demo.loading) return <ReportSkeleton kind={kind} {...frame} />;
  const result = await loadOne(ctx, kind, range);
  if (result.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (result.kind === "unavailable") return <ReportError kind={kind} {...frame} />;
  return <ReportView body={result.value} {...frame} />;
}
