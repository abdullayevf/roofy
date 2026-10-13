import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { PayoutError, PayoutForm, PayoutSkeleton } from "@/components/screens/payout-form";
import { payoutFromQuery } from "@/components/screens/payout-input";

export const metadata: Metadata = { title: "Record payout" };

/**
 * Record payout (screen 20): an advance or a payment to one crew member, dated today in the workspace timezone.
 * Manager and owner only; a foreman or an accountant gets the no-access page, and no figure is fetched for them.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const back = backLink(actor.role);
  if (actor.role !== "owner" && actor.role !== "manager") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (demo.loading) return <PayoutSkeleton />;
  const { id } = await params;
  let crew;
  try {
    crew = await ctx.data.crew.get(actor, id);
  } catch (e) {
    if (isDataError(e) && e.code === "not_found") notFound();
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
    if (isDataError(e) && e.code === "unavailable") return <PayoutError crewId={id} />;
    throw e;
  }
  if (!crew.access.canApprove) return <NoPermission backHref={back.href} backLabel={back.label} />;
  const sp = await searchParams;
  const { values, check } = payoutFromQuery(sp, ctx.today);
  const amountText = typeof sp.amount === "string" ? sp.amount : undefined;
  return (
    <PayoutForm
      crewId={crew.id}
      name={crew.name}
      balanceCents={crew.balanceCents}
      initial={values}
      initialCheck={check}
      amountText={amountText}
      demoOffline={demo.state === "offline"}
    />
  );
}
