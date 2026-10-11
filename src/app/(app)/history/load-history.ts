import type { DataContext } from "@/data";
import type { AuditRow } from "@/data/contracts";
import type { HistoryFilter } from "@/components/screens/history-text";
import { load } from "../reports/load-reports";

/** How many changes show: the newest first, so a long history stays quick to open. */
export const HISTORY_SHOWN = 100;

export type HistoryOption = { value: string; label: string };
export type HistoryBody = {
  rows: AuditRow[];
  timeZone: string;
  names: { job: string | null; crew: string | null; row: string | null };
  /** Every job and person, for the filters on the page (N14). */
  options: { jobs: HistoryOption[]; crew: HistoryOption[] };
};

/**
 * The changes under a filter (the data layer does the filtering), the workspace timezone for their times, and the
 * names the "Showing" line uses. A job or person with no changes yet is still named, from their own page.
 */
export function loadHistory({ data, actor }: DataContext, filter: HistoryFilter) {
  return load<HistoryBody>(async () => {
    const [rows, settings, jobList, crewList] = await Promise.all([
      data.audit.history(actor, {
        projectId: filter.projectId ?? undefined,
        crewMemberId: filter.crewMemberId ?? undefined,
        table: filter.table ?? undefined,
        rowId: filter.rowId ?? undefined,
        limit: HISTORY_SHOWN,
      }),
      data.workspace.settings(actor),
      data.projects.list(actor, { status: "all" }),
      data.crew.list(actor, { includeInactive: true }),
    ]);
    const job = filter.projectId ? (rows[0]?.projectName ?? (await data.projects.get(actor, filter.projectId).catch(() => null))?.name ?? null) : null;
    const crew = filter.crewMemberId ? ((await data.crew.get(actor, filter.crewMemberId).catch(() => null))?.name ?? null) : null;
    const row = filter.rowId ? (rows[0]?.subject ?? null) : null;
    return { rows, timeZone: settings.view === "manager" ? settings.settings.timezone : settings.workspace.timezone, names: { job, crew, row },
      options: {
        jobs: jobList.rows.map((r) => ({ value: r.id, label: r.name })),
        crew: crewList.rows.map((r) => ({ value: r.id, label: r.name })),
      },
    };
  });
}
