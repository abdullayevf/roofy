import type { Metadata } from "next";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { HomeError } from "@/components/screens/home-error";
import { HomeForemanBody, HomeForemanSkeleton } from "@/components/screens/home-foreman";
import { HomeManagerBody, HomeSkeleton } from "@/components/screens/home-manager";

export const metadata: Metadata = { title: { absolute: "Roofy" } };

/** Home: the Monday screen for an owner, manager or accountant; assigned jobs, Log today and the outbox for a foreman. */
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { data, actor, demo, today } = await getData({ searchParams });
  const foreman = actor.role === "foreman";
  if (demo.loading) return foreman ? <HomeForemanSkeleton today={today} /> : <HomeSkeleton />;
  let home;
  try {
    home = await data.home.get(actor);
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") {
      const back = backLink(actor.role);
      return <NoPermission backHref={back.href} backLabel={back.label} />;
    }
    // Home stays on screen with its own message and Try again; other screens use the route's error page.
    if (isDataError(e) && e.code === "unavailable") return <HomeError foreman={foreman} today={today} />;
    throw e;
  }
  if (home.view === "foreman") return <HomeForemanBody home={home} outbox={demo.outbox} />;
  const attention = demo.outbox.filter((i) => i.state === "needs_attention").length;
  return (
    <HomeManagerBody
      home={home}
      role={actor.role === "foreman" ? "manager" : actor.role}
      outbox={{ waiting: demo.outbox.length - attention, attention }}
      offline={demo.offline}
    />
  );
}
