import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { LevelsForm } from "@/components/screens/settings-forms";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Levels & floor rates" };

const INTRO = "Each level's floor is the lowest hourly rate its crew can be paid. Pay runs from now on check against it; approved pay runs stay as they are.";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Levels & floor rates" }, async ({ data, actor, offline, empty }) => {
    const levels = empty ? [] : await data.workspace.levels(actor);
    return (
      <SettingsPageFrame title="Levels & floor rates" intro={INTRO}>
        {levels.length ? (
          <LevelsForm levels={levels} demoOffline={offline} />
        ) : (
          <p className="text-body text-ink">No levels yet. Levels come with your trade when you set up Roofy.</p>
        )}
      </SettingsPageFrame>
    );
  });
}
