import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { InviteForm, MembersForm } from "@/components/screens/settings-lists";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Members & roles" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Members & roles", ownerOnly: true, rows: 4, list: true }, async ({ data, actor, offline, empty }) => {
    const members = empty ? [] : await data.workspace.members(actor);
    return (
      <SettingsPageFrame title="Members & roles" intro="Managers run jobs, crew and pay. Foremen log work on the jobs you give them. Accountants read pay, expenses and reports.">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
          <section aria-labelledby="members-list" className="flex flex-col gap-4">
            <h2 id="members-list" className="text-heading text-ink">People</h2>
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
