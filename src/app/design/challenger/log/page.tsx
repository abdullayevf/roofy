import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { LogCrewDay } from "@/components/screens/log-crew-day";
import { loadLogScreen } from "../../../(app)/log/load-log";
import { ChallengerFrame } from "../frame";

export const metadata: Metadata = { title: "Docket: Log" };

/** TEMPORARY (Task 10 A/B): the Log grid body from `/log`, in the Docket direction. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const screen = await loadLogScreen(ctx, await searchParams);
  if (screen.kind === "forbidden") throw new Error("The A/B pages are for a manager.");
  const { defaults, ticked, demo } = screen;
  return (
    <ChallengerFrame>
      <LogCrewDay
        key={`${defaults.projectId}|${defaults.stageId}|${ticked.join(",")}`}
        defaults={defaults}
        initialTicked={ticked}
        demo={demo}
        basePath="/design/challenger/log"
      />
    </ChallengerFrame>
  );
}
