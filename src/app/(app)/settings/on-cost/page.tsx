import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { OnCostForm } from "@/components/screens/settings-forms";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "On-cost" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "On-cost", rows: 1 }, async ({ settings, offline }) => (
    <SettingsPageFrame title="On-cost" intro="On-cost is added to employee pay in every job cost and forecast. Contractors have none.">
      <OnCostForm settings={settings} demoOffline={offline} />
    </SettingsPageFrame>
  ));
}
