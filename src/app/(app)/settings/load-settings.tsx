import type { ReactNode } from "react";
import { getData } from "@/data";
import type { DataContext } from "@/data";
import type { SearchParams } from "@/data/session";
import type { WorkspaceSettings } from "@/data/contracts";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen, whoToAsk } from "@/components/shell/access";
import { SettingsError, SettingsSkeleton } from "@/components/screens/settings-index";
import { load } from "../reports/load-reports";

export type SettingsCtx = { data: DataContext["data"]; actor: DataContext["actor"]; settings: WorkspaceSettings; ownerTwoFactor: boolean; owner: boolean; offline: boolean; empty: boolean };

/**
 * Every settings page: Owner and Manager (Owner-only pages refuse the Manager with "Ask the owner"),
 * accountant and foreman get no permission; `?demo=loading` the skeleton, a failed read the error with Try again.
 */
export async function settingsPage(
  searchParams: Promise<SearchParams>,
  opts: { title: string; ownerOnly?: boolean; rows?: number; list?: boolean; groups?: number },
  render: (ctx: SettingsCtx) => Promise<ReactNode> | ReactNode,
): Promise<ReactNode> {
  const { data, actor, demo } = await getData({ searchParams });
  const back = backLink(actor.role);
  const owner = actor.role === "owner";
  const refused = !canOpen(actor.role, "settings") || demo.state === "noperm" || (opts.ownerOnly && !owner);
  if (refused) return <NoPermission backHref={back.href} backLabel={back.label} ask={whoToAsk(actor.role)} />;
  if (demo.loading) return <SettingsSkeleton title={opts.title} rows={opts.rows} list={opts.list} groups={opts.groups} />;
  const view = await load(() => data.workspace.settings(actor));
  if (view.kind === "forbidden" || (view.kind === "ok" && view.value.view !== "manager"))
    return <NoPermission backHref={back.href} backLabel={back.label} ask={whoToAsk(actor.role)} />;
  if (view.kind !== "ok" || view.value.view !== "manager") return <SettingsError title={opts.title} />;
  const { settings, ownerTwoFactor } = view.value;
  return render({ data, actor, settings, ownerTwoFactor, owner, offline: demo.offline, empty: demo.state === "empty" });
}
