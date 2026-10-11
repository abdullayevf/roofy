import type { DataContext } from "@/data";
import { isDataError, type DateRange, type ReportKeyFigure, type ReportKind } from "@/data/contracts";
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
    return {
      jobs: jobs.rows,
      crew: crew.rows,
      productivity: productivity.rows,
      pauses: pauses.rows,
      pay: pay.rows,
      figures: {
        "job-profitability": jobs.keyFigure,
        crew: crew.keyFigure,
        productivity: productivity.keyFigure,
        pauses: pauses.keyFigure,
        "pay-history": pay.keyFigure,
      } satisfies Record<ReportKind, ReportKeyFigure>,
    };
  });
}

/** One report's rows and its key figure. */
export function loadOne({ data, actor }: DataContext, kind: ReportKind, range: DateRange) {
  return load<ReportBody>(async () => {
    switch (kind) {
      case "job-profitability": {
        const r = await data.reports.jobProfitability(actor, range);
        return { kind, rows: r.rows, keyFigure: r.keyFigure };
      }
      case "crew": {
        const r = await data.reports.crew(actor, range);
        return { kind, rows: r.rows, keyFigure: r.keyFigure };
      }
      case "productivity": {
        const r = await data.reports.productivity(actor, range);
        return { kind, rows: r.rows, keyFigure: r.keyFigure };
      }
      case "pauses": {
        const r = await data.reports.pauses(actor, range);
        return { kind, rows: r.rows, keyFigure: r.keyFigure };
      }
      case "pay-history": {
        const r = await data.reports.payHistory(actor, range);
        return { kind, rows: r.rows, keyFigure: r.keyFigure };
      }
    }
  });
}

/** Offline, a report reads from the last snapshot and says how old it is (flows.md, Reports drill-down). */
// TODO(Phase 3): take the age from the real snapshot time, as Crew and Home do, not a fixed 12 minutes.
export const updatedText = (offline: boolean): string | null => (offline ? "Lists updated 12 minutes ago." : null);
