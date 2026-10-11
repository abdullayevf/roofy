import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { EmptyState } from "@/components/empty-state";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { AssignmentsForm } from "@/components/screens/settings-lists";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Foreman assignments" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Foreman assignments" }, async ({ data, actor, owner, offline, empty }) => {
    const foremen = empty ? [] : await data.workspace.assignments(actor);
    const list = empty ? null : await data.projects.list(actor, { status: "all" });
    const jobs = (list?.rows ?? []).map((j) => ({ id: j.id, name: j.name }));
    return (
      <SettingsPageFrame title="Foreman assignments" intro="A foreman sees and logs to the jobs ticked here, and no others.">
        {foremen.length === 0 ? (
          <EmptyState message={owner ? "No foremen yet. Invite one to give them jobs." : "No foremen yet. Ask the owner to invite one."} actionLabel={owner ? "Invite a foreman" : undefined} href={owner ? "/settings/members" : undefined} />
        ) : jobs.length === 0 ? (
          <EmptyState message="No jobs yet. Create a job to give a foreman." actionLabel="Create job" href="/jobs/new" />
        ) : (
          <AssignmentsForm foremen={foremen} jobs={jobs} demoOffline={offline} />
        )}
      </SettingsPageFrame>
    );
  });
}
