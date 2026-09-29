import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { List } from "@/components/ui/list";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen, moreItems } from "@/components/shell/access";

export const metadata: Metadata = { title: "More" };

/** The phone's More menu: the pages the role can reach that don't have a tab. Task 19 adds theme and sign out. */
export default async function MorePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { actor, demo } = await getData({ searchParams });
  if (demo.state === "error") throw new Error("Demo: this screen could not load.");
  if (!canOpen(actor.role, "more") || demo.state === "noperm") {
    const back = backLink(actor.role);
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  }
  return (
    <>
      <h1 className="mb-4 font-display text-title text-ink">More</h1>
      <List rows={moreItems(actor.role).map((i) => ({ key: i.key, primary: i.label, meta: i.meta, href: i.href }))} />
    </>
  );
}
