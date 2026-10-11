import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { List } from "@/components/ui/list";
import { NoPermission } from "@/components/page-states";
import { MoreExtras } from "@/components/screens/more-extras";
import { backLink, canOpen, moreItems } from "@/components/shell/access";

export const metadata: Metadata = { title: "More" };

/** The More menu: the pages the role can reach that don't have a tab, the theme and Sign out. The foreman's is short: no settings, no money. */
export default async function MorePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { actor, demo } = await getData({ searchParams });
  if (demo.state === "error") throw new Error("Demo: this screen could not load.");
  if (!canOpen(actor.role, "more") || demo.state === "noperm") {
    const back = backLink(actor.role);
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  }
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <h1 className="mb-4 font-display text-title text-ink">More</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
        <List rows={moreItems(actor.role).map((i) => ({ key: i.key, primary: i.label, meta: i.meta, href: i.href }))} />
        <MoreExtras theme={theme} demoOffline={demo.offline} />
      </div>
    </>
  );
}
