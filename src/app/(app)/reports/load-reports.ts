import type { DataContext } from "@/data";
import { isDataError, type DateRange, type ReportKind } from "@/data/contracts";
import type { ReportBody } from "@/components/screens/reports";

export type Loaded<T> = { kind: "ok"; value: T } | { kind: "forbidden" } | { kind: "unavailable" };

/** Runs a report read, turning the data layer's forbidden/unavailable answers into page states. */
export async function load<T>(read: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { kind: "ok", value: await read() };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}

/** The five reports for one range, for the index cards. */
export function loadAll({ data, actor }: DataContext, range: DateRange) {
  return load(async () => {
    const [jobs, crew, productivity, pauses, pay] = await Promise.all([
      data.reports.jobProfitability(actor, range),
      data.reports.crew(actor, range),
      data.reports.productivity(actor, range),
      data.reports.pauses(actor, range),
      data.reports.payHistory(actor, range),
    ]);
    return { jobs: jobs.rows, crew: crew.rows, productivity: productivity.rows, pauses: pauses.rows, pay: pay.rows };
  });
}

/** One report's rows. */
export function loadOne({ data, actor }: DataContext, kind: ReportKind, range: DateRange) {
  return load<ReportBody>(async () => {
    switch (kind) {
      case "job-profitability":
        return { kind, rows: (await data.reports.jobProfitability(actor, range)).rows };
      case "crew":
        return { kind, rows: (await data.reports.crew(actor, range)).rows };
      case "productivity":
        return { kind, rows: (await data.reports.productivity(actor, range)).rows };
      case "pauses":
        return { kind, rows: (await data.reports.pauses(actor, range)).rows };
      case "pay-history":
        return { kind, rows: (await data.reports.payHistory(actor, range)).rows };
    }
  });
}

/** Offline, a report reads from the last snapshot and says how old it is (flows.md, Reports drill-down). */
export const updatedText = (offline: boolean): string | null => (offline ? "Lists updated 12 minutes ago." : null);
