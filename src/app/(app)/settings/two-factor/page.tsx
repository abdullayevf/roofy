import type { Metadata } from "next";
import { getAuth, isFakeMode } from "@/data";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { StatusChip } from "@/components/ui/status-chip";
import { TwoFactorForm } from "@/components/screens/settings-forms";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Two-factor" };

/** Owner only. Off (`?demo=blocked`) blocks pay-run approval, so the page says so and sets it up. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Two-factor", ownerOnly: true, rows: 1 }, async ({ ownerTwoFactor, offline }) =>
    ownerTwoFactor ? (
      <SettingsPageFrame
        title="Two-factor"
        intro={
          <>
            <StatusChip status="on" />
            <p className="text-body text-ink">Two-factor is on. When you sign in, Roofy asks for the code from your authenticator app.</p>
          </>
        }
      />
    ) : (
      <SettingsPageFrame title="Two-factor" intro="Turn on two-factor before you approve a pay run. It keeps your crew's pay safe if your password leaks.">
        {/* The prototype shows the QR code straight away; the real sign-in asks for the password first. */}
        <TwoFactorForm
          demoOffline={offline}
          setup={isFakeMode() ? await getAuth().startTwoFactor("") : null}
          hasPassword={await getAuth().hasPassword()}
        />
      </SettingsPageFrame>
    ),
  );
}
