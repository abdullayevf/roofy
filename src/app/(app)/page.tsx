import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { HomeManagerBody, HomeSkeleton } from "@/components/screens/home-manager";

export const metadata: Metadata = { title: { absolute: "Roofy" } };

/** Home for an owner, manager or accountant. A foreman has no Home tab: they start on Log. */
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { data, actor, demo } = await getData({ searchParams });
  if (actor.role === "foreman") redirect("/log");
  if (demo.loading) return <HomeSkeleton />;
  let home;
  try {
    home = await data.home.get(actor);
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") {
      const back = backLink(actor.role);
      return <NoPermission backHref={back.href} backLabel={back.label} />;
    }
    throw e;
  }
  if (home.view !== "manager") redirect("/log");
  return <HomeManagerBody home={home} />;
}
