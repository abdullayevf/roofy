import type { Metadata } from "next";
import { WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { InviteForm, MembersForm } from "@/components/screens/settings-lists";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Members & roles" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Members & roles", ownerOnly: true, rows: 4, list: true }, async ({ data, actor, offline, empty, ownerTwoFactor }) => {
    const members = empty ? [] : await data.workspace.members(actor);
    return (
      <SettingsPageFrame title="Members & roles" intro="Managers run jobs, crew and pay. Foremen log work on the jobs you give them. Accountants read pay, expenses and reports.">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
          <section aria-labelledby="members-list" className="flex flex-col gap-4">
            <h2 id="members-list" className="text-heading text-ink">People</h2>
            {ownerTwoFactor ? (
              <p className="break-words text-body text-ink-2">Two-factor is on for the owner.</p>
            ) : (
              // A blocker is a needs-attention row, not a grey line: the warning icon, the consequence, and the way to fix it (D14 + F10).
              <div className="flex flex-col gap-1 rounded-group border-group bg-surface px-4 py-3">
                <div className="flex items-start gap-3">
                  <WarningDiamond size={24} aria-hidden="true" className="shrink-0 text-watch" />
                  <p className="min-w-0 break-words text-body text-ink">
                    Two-factor is off for the owner. Turn it on before you approve a pay run.
                  </p>
                </div>
                <Button variant="link" href="/settings/two-factor" className="self-start">
                  Set up two-factor
                </Button>
              </div>
            )}
            {members.length ? (
              <MembersForm members={members} demoOffline={offline} />
            ) : (
              <p className="text-body text-ink-2">No members yet. Invite your first manager or foreman.</p>
            )}
          </section>
          <section aria-labelledby="members-invite" className="flex flex-col gap-4">
            <h2 id="members-invite" className="text-heading text-ink">Invite someone</h2>
            <InviteForm demoOffline={offline} quiet={members.length > 0} />
          </section>
        </div>
      </SettingsPageFrame>
    );
  });
}
