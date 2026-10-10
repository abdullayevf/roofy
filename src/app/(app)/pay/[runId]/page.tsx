import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError, type PayRunReview } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { PayRunReviewBody, PayRunReviewError, PayRunReviewSkeleton } from "@/components/screens/pay-run-review";

export const metadata: Metadata = { title: "Pay run" };

/**
 * Pay run review (flows.md screen 19): flags first, then each person's lines, contractor GST, reimbursements and the
 * run totals. Owner and Manager review; an Accountant reads. A foreman gets no-permission before any data is asked for,
 * so no figure is in the HTML.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const back = backLink(actor.role);
  if (actor.role === "foreman") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (demo.loading) return <PayRunReviewSkeleton />;
  const { runId } = await params;
  let review: PayRunReview;
  try {
    review = await ctx.data.payRuns.get(actor, runId);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <PayRunReviewError />;
    throw e;
  }
  return <PayRunReviewBody review={review} role={actor.role} today={ctx.today} />;
}
