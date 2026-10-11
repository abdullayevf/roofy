import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { PayPeriodForm } from "@/components/screens/settings-forms";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Pay period & working days" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Pay period & working days" }, async ({ settings, offline }) => (
    <SettingsPageFrame title="Pay period & working days" intro="Changes apply to pay runs from the next one; approved pay runs stay as they are.">
      <PayPeriodForm settings={settings} demoOffline={offline} />
    </SettingsPageFrame>
  ));
}
