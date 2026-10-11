import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { BusinessForm } from "@/components/screens/settings-forms";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Business" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Business" }, async ({ settings, offline }) => (
    <SettingsPageFrame title="Business" intro="Your business name and ABN show on pay runs, statements and exports.">
      <BusinessForm settings={settings} demoOffline={offline} />
    </SettingsPageFrame>
  ));
}
