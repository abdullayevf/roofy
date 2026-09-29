import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";

export const metadata: Metadata = { title: { absolute: "Roofy" } };

/** Home (a stand-in until Task 11). A foreman has no Home tab: they start on Log. */
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { actor, demo } = await getData({ searchParams });
  if (actor.role === "foreman") redirect("/log");
  if (demo.state === "error") throw new Error("Demo: this screen could not load.");
  if (demo.state === "noperm") {
    const back = backLink(actor.role);
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  }
  return (
    <>
      <h1 className="font-display text-title text-ink">Home</h1>
      <EmptyState message="What needs your attention today will show here." actionLabel="Open Log" href="/log" />
    </>
  );
}
