import type { Metadata } from "next";
import { getData } from "@/data";
import { isDataError, type Statement } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { CrewStatement, StatementError, StatementGone, StatementSkeleton } from "@/components/screens/crew-statement";

export const metadata: Metadata = { title: "Pay statement", robots: { index: false, follow: false } };

/**
 * Crew statement (flows.md screen 21, pay rules §16): one person's statement for one approved pay run, opened from a
 * private link. Outside the app shell — no nav and no role: the unguessable, revocable, 90-day token is the permission.
 * An expired, turned-off or unknown token gets one plain sentence.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  if (ctx.demo.loading) return <StatementSkeleton />;
  const { token } = await params;
  let statement: Statement;
  try {
    statement = await ctx.data.statements.open(token);
  } catch (e) {
    if (isDataError(e) && (e.code === "not_found" || e.code === "forbidden")) return <StatementGone />;
    if (isDataError(e) && e.code === "unavailable") return <StatementError />;
    throw e;
  }
  return <CrewStatement statement={statement} today={ctx.today} />;
}
