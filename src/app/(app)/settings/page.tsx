import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { SettingsIndex } from "@/components/screens/settings-index";
import { settingsPage } from "./load-settings";

export const metadata: Metadata = { title: "Settings" };

/** Settings hub (flows.md screen 23). Reads stay available offline; each page's Save says Needs connection. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Settings", rows: 6 }, async ({ data, actor, settings, ownerTwoFactor, owner }) => {
    const levels = await data.workspace.levels(actor);
    return <SettingsIndex owner={owner} settings={settings} ownerTwoFactor={ownerTwoFactor} levelCount={levels.length} />;
  });
}
