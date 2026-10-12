import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { WorkspaceSettings } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { List, type ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS } from "./home-parts";
import { bpText, payPeriodText } from "./settings-input";

/** Full width from 1024 px (lesson: desktop uses the width). */
export const SETTINGS_WIDE = cx(COLUMN, "lg:max-w-none");

/** Back row, title and an optional plain sentence under it. */
export function SettingsHead({ title, intro, back = { href: "/settings", label: "Back to Settings" } }: { title: string; intro?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-1">
      <Link href={back.href} prefetch={false} className={cx("flex min-h-12 items-center gap-1 self-start text-body-strong text-chalk-link", FOCUS)}>
        <CaretLeft size={24} aria-hidden="true" />
        {back.label}
      </Link>
      <div className="flex min-h-12 items-center">
        <h1 className="text-title text-ink">{title}</h1>
      </div>
      {typeof intro === "string" && intro ? <p className="max-w-180 text-body text-ink-2">{intro}</p> : null}
      {intro && typeof intro !== "string" ? <div className="mt-1 flex max-w-180 flex-col items-start gap-3">{intro}</div> : null}
    </div>
  );
}

export function SettingsPageFrame({ title, intro, children }: { title: string; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={SETTINGS_WIDE}>
      <SettingsHead title={title} intro={intro} />
      {children}
    </div>
  );
}

export function SettingsSkeleton({
  title,
  rows = 4,
  list = false,
  groups = 1,
}: {
  title: string;
  rows?: number;
  /** A list page (the index, templates, categories, members): grouped 64 px rows, not label and input pairs. */
  list?: boolean;
  groups?: number;
}) {
  if (list)
    return (
      <div className={SETTINGS_WIDE} aria-busy="true">
        <SettingsHead title={title} />
        <div className="flex flex-col gap-6">
          {Array.from({ length: groups }, (_, g) => (
            <div key={g} className="flex flex-col gap-2">
              {groups > 1 ? <Skeleton width={160} height={24} /> : null}
              <div className={`divide-y divide-line rounded-group border-group bg-surface ${groups > 1 ? "" : "lg:max-w-3xl"}`}>
                {Array.from({ length: rows }, (_, i) => (
                  <div key={i} className="flex min-h-[64px] items-center justify-between gap-4 px-4 lg:min-h-12">
                    <div className="flex flex-col gap-2">
                      <Skeleton width={160} height={20} />
                      <Skeleton width={96} height={16} />
                    </div>
                    <Skeleton width={24} height={24} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className={SETTINGS_WIDE} aria-busy="true">
      <SettingsHead title={title} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-x-8">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton width={128} height={20} />
            <Skeleton height={52} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsError({ title }: { title: string }) {
  return (
    <div className={SETTINGS_WIDE}>
      <SettingsHead title={title} />
      <LoadError primary />
    </div>
  );
}

type IndexProps = { owner: boolean; settings: WorkspaceSettings; ownerTwoFactor: boolean; levelCount: number };

function Group({ id, title, rows }: { id: string; title: string; rows: ListRow[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-heading text-ink">{title}</h2>
      <List rows={rows} />
    </section>
  );
}

/** Settings hub (flows.md screen 23): one grouped list per area; Owner-only rows only for the Owner. */
export function SettingsIndex({ owner, settings, ownerTwoFactor, levelCount }: IndexProps) {
  const business: ListRow[] = [
    { key: "business", primary: "Business", meta: settings.name || "No business name yet", href: "/settings/business" },
    { key: "pay-period", primary: "Pay period & working days", meta: payPeriodText(settings.payFrequency, settings.payWeekStart), href: "/settings/pay-period" },
    { key: "on-cost", primary: "On-cost", meta: `${bpText(settings.onCostBp)}% on employee pay`, href: "/settings/on-cost" },
    { key: "levels", primary: "Levels & floor rates", meta: levelCount === 1 ? "1 level" : `${levelCount} levels`, href: "/settings/levels" },
    { key: "templates", primary: "Templates", meta: "Stage lists for each job type", href: "/settings/templates" },
    { key: "categories", primary: "Expense categories", meta: "What expenses are filed under", href: "/settings/categories" },
  ];
  const people: ListRow[] = [
    ...(owner ? [{ key: "members", primary: "Members & roles", meta: "Who can sign in and what they can do", href: "/settings/members" }] : []),
    { key: "assignments", primary: "Foreman assignments", meta: "Which jobs each foreman sees", href: "/settings/assignments" },
    ...(owner
      ? [
          { key: "two-factor", primary: "Two-factor", meta: ownerTwoFactor ? "On" : "Off. Turn it on before you approve a pay run.", href: "/settings/two-factor" },
          { key: "export", primary: "Workspace export", meta: "Every job, crew member and pay run in one file", href: "/export" },
        ]
      : []),
  ];
  return (
    <div className={SETTINGS_WIDE}>
      <SettingsHead title="Settings" back={{ href: "/more", label: "Back to More" }} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
        <Group id="settings-business" title="Business and pay" rows={business} />
        <Group id="settings-people" title="People and access" rows={people} />
      </div>
    </div>
  );
}
