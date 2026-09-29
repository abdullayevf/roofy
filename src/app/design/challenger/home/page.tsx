import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { HomeManagerBody } from "@/components/screens/home-manager";
import { ChallengerFrame } from "../frame";

export const metadata: Metadata = { title: "Docket: Home" };

/** TEMPORARY (Task 10 A/B): the Home body from `/`, in the Docket direction. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { data, actor } = await getData({ searchParams });
  const home = await data.home.get(actor);
  if (home.view !== "manager") throw new Error("The A/B pages are for a manager.");
  return (
    <ChallengerFrame>
      <HomeManagerBody home={home} />
    </ChallengerFrame>
  );
}
