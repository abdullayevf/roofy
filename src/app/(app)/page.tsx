import type { Metadata } from "next";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { HomeForemanBody, HomeForemanSkeleton } from "@/components/screens/home-foreman";
import { HomeManagerBody, HomeSkeleton } from "@/components/screens/home-manager";

export const metadata: Metadata = { title: { absolute: "Roofy" } };

/** Home: the Monday screen for an owner, manager or accountant; assigned jobs, Log today and the outbox for a foreman. */
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { data, actor, demo } = await getData({ searchParams });
  if (demo.loading) return actor.role === "foreman" ? <HomeForemanSkeleton /> : <HomeSkeleton />;
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
  if (home.view === "foreman") return <HomeForemanBody home={home} outbox={demo.outbox} />;
  return <HomeManagerBody home={home} />;
}
