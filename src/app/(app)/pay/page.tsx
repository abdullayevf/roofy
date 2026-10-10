import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { PayRunsError, PayRunsListBody, PayRunsSkeleton } from "@/components/screens/pay-runs-list";
import { loadPayRuns } from "./load-pay-runs";

export const metadata: Metadata = { title: "Pay runs" };

/**
 * Pay runs list (flows.md screen 18): the draft to review first, then every other run with its status and total.
 * Owner and Manager review and approve; an Accountant reads and exports. A foreman never reaches pay runs: the page
 * answers no-permission before asking for any data, so no figure is in the HTML.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const back = backLink(actor.role);
  if (actor.role === "foreman") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (demo.loading) return <PayRunsSkeleton />;
  const result = await loadPayRuns(ctx);
  if (result.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (result.kind === "unavailable") return <PayRunsError />;
  return (
    <PayRunsListBody
      runs={result.runs}
      reviewId={result.reviewId}
      reviewFlags={result.reviewFlags}
      role={actor.role}
      today={ctx.today}
    />
  );
}
