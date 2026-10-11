import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { EmptyState } from "@/components/empty-state";
import { List } from "@/components/ui/list";
import { JOB_TYPES, jobTypeLabel } from "@/components/screens/job-input";
import { SETTINGS_WIDE, SettingsHead, SettingsPageFrame } from "@/components/screens/settings-index";
import { TemplateForm } from "@/components/screens/settings-lists";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Templates" };

const INTRO = "New jobs start from the stage list for their job type, unless you copy an earlier job. Changing a template does not change jobs you have already made.";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const type = (await searchParams).type;
  const picked = JOB_TYPES.find((t) => t.value === type)?.value;
  return settingsPage(searchParams, { title: "Templates", rows: 5, list: true }, async ({ data, actor, offline, empty }) => {
    const templates = empty ? [] : await data.workspace.templates(actor);
    if (picked) {
      const items = templates.find((t) => t.jobType === picked)?.items ?? [];
      return (
        <div className={SETTINGS_WIDE}>
          <SettingsHead title={`${jobTypeLabel(picked)} stages`} intro="Labour shares add up to 100%. Materials shares add up to 100%, or are all 0% when the job has no materials." back={{ href: "/settings/templates", label: "Back to Templates" }} />
          <TemplateForm key={picked} jobType={picked} items={items} demoOffline={offline} />
        </div>
      );
    }
    return (
      <SettingsPageFrame title="Templates" intro={INTRO}>
        {templates.length ? (
          <List
            rows={JOB_TYPES.map((t) => {
              const n = templates.find((x) => x.jobType === t.value)?.items.length ?? 0;
              return { key: t.value, primary: t.label, meta: n === 0 ? "No stages yet" : n === 1 ? "1 stage" : `${n} stages`, href: `/settings/templates?type=${t.value}` };
            })}
          />
        ) : (
          <EmptyState message="No templates yet. Add the stages for your first job type." actionLabel="Add stages" href={`/settings/templates?type=${JOB_TYPES[0]!.value}`} />
        )}
      </SettingsPageFrame>
    );
  });
}
