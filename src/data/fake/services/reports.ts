import { dayKey } from "@/domain/attendance";
import { addDays, countWorkingDays } from "@/domain/dates";
import { sum } from "@/domain/money";
import { centsPerUnit, quantityPerDay, ratioBp } from "@/domain/ratios";
import { pausePeriods } from "@/domain/segments";
import type { Unit } from "@/domain/types";
import { formatDecimal, formatFixed2 } from "@/lib/format";
import type {
  Actor,
  CrewReportRow,
  DateRange,
  ExportFile,
  JobProfitRow,
  PauseReportRow,
  PayHistoryRow,
  ProductivityRow,
  Report,
  ReportKeyFigure,
  ReportKind,
  ReportService,
} from "../../contracts";
import type { WorkLogRow } from "../rows";
import type { FakeContext } from "./context";

const UNITS: readonly Unit[] = ["m2", "lm", "each"];

const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to;

/** CSV (RFC 4180): quote a field when it holds a comma, quote or line break. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** The calendar month "YYYY-MM" as a range. */
function monthRange(month: string): DateRange {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: addDays(`${next}-01`, -1) };
}

/** The part of `r` inside `within`: a month only partly in the range shows the dates it covers. */
const clampRange = (r: DateRange, within: DateRange): DateRange => ({
  from: r.from > within.from ? r.from : within.from,
  to: r.to < within.to ? r.to : within.to,
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const money = (cents: number | null) => (cents === null ? null : formatDecimal(cents));

export function createReportService(c: FakeContext): ReportService {
  const logsIn = (r: DateRange): WorkLogRow[] => c.ix.liveLogs.filter((l) => inRange(l.date, r));

  function report<Row>(
    actor: Actor,
    range: DateRange,
    rows: () => Row[],
    keyFigure: (rows: Row[]) => ReportKeyFigure,
  ): Report<Row> {
    const access = c.access(actor);
    const list = rows();
    return { view: "manager", access, range, rows: list, keyFigure: keyFigure(list) };
  }

  /**
   * Jobs with a log or expense in the range, lowest forecast margin first so a losing job leads. Figures are
   * each job's to date (pay rules §12 margins), so a row always reconciles with its Job detail page.
   */
  function jobProfitability(range: DateRange): JobProfitRow[] {
    const touched = new Set([
      ...logsIn(range).map((l) => l.projectId),
      ...c.t.expenses.filter((e) => inRange(e.date, range)).map((e) => e.projectId),
    ]);
    return c.t.projects
      .filter((p) => touched.has(p.id))
      .map((p) => {
        const f = c.fig.project(p.id);
        return {
          projectId: p.id,
          name: p.nickname,
          jobType: p.jobType,
          status: p.status,
          contractCents: p.contractValueCents,
          pctBp: f.pctBp,
          labourCents: f.labourActualCents,
          expensesCents: f.expensesCents,
          marginToDateCents: f.margins.marginToDateCents,
          forecastMarginCents: f.margins.forecastMarginCents,
          marginBp: ratioBp(f.margins.forecastMarginCents, p.contractValueCents),
          href: `/jobs/${p.id}`,
        };
      })
      .sort((a, b) => a.forecastMarginCents - b.forecastMarginCents || a.name.localeCompare(b.name));
  }

  function crew(range: DateRange): CrewReportRow[] {
    const logs = logsIn(range);
    const endExclusive = addDays(range.to, 1) < c.today ? addDays(range.to, 1) : c.today;
    return c.t.crewMembers
      .map((m) => ({ m, mine: logs.filter((l) => l.crewMemberId === m.id) }))
      .filter(({ mine }) => mine.length > 0)
      .sort((a, b) => a.m.name.localeCompare(b.m.name))
      .map(({ m, mine }) => {
        const perUnit = mine.filter((l) => l.basis === "per_unit" && l.unit !== null);
        // One key for labour and quantity: the stage's name and unit. Only per-unit logs count, so the labour and the
        // quantity come from the same logs (hourly time on a unit stage is not paid by the unit). A stage with an
        // unpriced per-unit log has no known cost, so it is left out (an unpriced stage must not read as a free one, E4.3).
        const groups = new Map<
          string,
          { stageName: string; unit: Unit; logs: WorkLogRow[]; qty: number[]; unpriced: boolean }
        >();
        for (const l of mine) {
          const st = c.ix.stages.get(l.stageId)!;
          if (st.unit === null || l.basis !== "per_unit") continue;
          const key = `${st.name}|${st.unit}`;
          if (!groups.has(key)) groups.set(key, { stageName: st.name, unit: st.unit, logs: [], qty: [], unpriced: false });
          const g = groups.get(key)!;
          g.logs.push(l);
          g.qty.push(l.quantity);
          if (l.missingRate || l.rateCents === null) g.unpriced = true;
        }
        const util = endExclusive > range.from ? c.fig.utilisationOf(m.id, range.from, endExclusive) : null;
        return {
          crewMemberId: m.id,
          name: m.name,
          type: m.type,
          days: new Set(mine.map((l) => l.date)).size,
          hours: sum(mine.map((l) => l.hours)),
          units: UNITS.map((unit) => ({
            unit,
            quantity: sum(perUnit.filter((l) => l.unit === unit).map((l) => l.quantity)),
          })).filter((u) => u.quantity !== 0),
          earningsCents: sum(mine.map((l) => l.amountCents)),
          costPerUnit: [...groups.values()].flatMap((g) => {
            if (g.unpriced) return [];
            const cents = centsPerUnit(c.fig.labourOf(g.logs), sum(g.qty));
            return cents === null ? [] : [{ stageName: g.stageName, unit: g.unit, centsPerUnit: cents }];
          }),
          jobs: new Set(mine.map((l) => l.projectId)).size,
          utilisationBp: util?.bp ?? null,
        };
      });
  }

  /** Rows plus each row's crew-days as person-day keys, so the headline pace counts a shared day once. */
  function productivityWithDays(range: DateRange): { row: ProductivityRow; dayKeys: Set<string> }[] {
    const groups = new Map<string, ProductivityRow & { qty: number[]; stageIds: Set<string> }>();
    for (const p of c.t.progressEntries.filter((x) => inRange(x.date, range))) {
      const st = c.ix.stages.get(p.stageId)!;
      const project = c.ix.projects.get(st.projectId)!;
      const month = p.date.slice(0, 7);
      const key = `${month}|${st.name}|${project.jobType}|${st.unit}`;
      if (!groups.has(key)) {
        groups.set(key, {
          month,
          period: clampRange(monthRange(month), range),
          stageName: st.name,
          jobType: project.jobType,
          unit: st.unit!,
          quantity: 0,
          crewDays: 0,
          perCrewDay: 0,
          qty: [],
          stageIds: new Set(),
        });
      }
      const g = groups.get(key)!;
      g.qty.push(p.quantity);
      g.stageIds.add(st.id);
    }
    return [...groups.values()]
      .map(({ qty, stageIds, ...row }) => {
        const dayKeys = new Set(
          [...stageIds].flatMap((id) =>
            c.ix
              .logsOfStage(id)
              .filter((l) => l.date.startsWith(row.month) && inRange(l.date, range))
              .map((l) => dayKey(l.crewMemberId, l.date)),
          ),
        );
        const quantity = sum(qty);
        const days = dayKeys.size;
        return { row: { ...row, quantity, crewDays: days, perCrewDay: quantityPerDay(quantity, days) ?? 0 }, dayKeys };
      })
      .sort((a, b) => b.row.month.localeCompare(a.row.month) || a.row.stageName.localeCompare(b.row.stageName));
  }

  const productivity = (range: DateRange): ProductivityRow[] => productivityWithDays(range).map((x) => x.row);

  /** Headline pace: m² (or the first row's unit) per crew-day over the whole range. */
  function productivityFigure(range: DateRange): ReportKeyFigure {
    const all = productivityWithDays(range);
    const unit: Unit = all.some((x) => x.row.unit === "m2") ? "m2" : (all[0]?.row.unit ?? "m2");
    const mine = all.filter((x) => x.row.unit === unit);
    const days = new Set(mine.flatMap((x) => [...x.dayKeys])).size;
    const stages = new Set(mine.map((x) => x.row.stageName)).size;
    return {
      format: "per-crew-day",
      unit,
      value: quantityPerDay(sum(mine.map((x) => x.row.quantity)), days) ?? 0,
      label: `Average across ${plural(stages, "stage")}`,
    };
  }

  function pauses(range: DateRange): PauseReportRow[] {
    const wd = c.t.workspace.workingDays;
    const rows: { start: string; row: PauseReportRow }[] = c.t.stages.flatMap((st) =>
      pausePeriods(c.ix.segmentsOf(st.id), c.today)
        .filter((p) => p.start <= range.to && p.end >= range.from)
        .map((p) => {
          const project = c.ix.projects.get(st.projectId)!;
          return {
            start: p.start,
            row: {
              month: p.start.slice(0, 7),
              projectId: project.id,
              stageId: st.id,
              projectName: project.nickname,
              stageName: st.name,
              reason: p.reason,
              start: p.start,
              end: p.end,
              workingDays: countWorkingDays(p.start > range.from ? p.start : range.from, p.end < range.to ? p.end : range.to, wd),
            },
          };
        }),
    );
    return rows
      .sort(
        (a, b) =>
          b.row.workingDays - a.row.workingDays ||
          b.start.localeCompare(a.start) ||
          a.row.projectName.localeCompare(b.row.projectName),
      )
      .map((x) => x.row);
  }

  function payHistory(range: DateRange): PayHistoryRow[] {
    return c.t.payRuns
      .filter((r) => r.periodStart <= range.to && r.periodEnd >= range.from)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((r) => {
        const f = c.fig.run(r.id);
        return { payRunId: r.id, period: f.period, status: r.status, ...f.totals };
      });
  }

  function csvFor(
    kind: ReportKind,
    range: DateRange,
  ): { header: string[]; rows: (string | number | null)[][] } {
    switch (kind) {
      case "job-profitability":
        return {
          header: [
            "Job",
            "Type",
            "Status",
            "Contract",
            "Complete %",
            "Labour",
            "Expenses",
            "Margin to date",
            "Forecast margin",
            "Margin %",
          ],
          rows: jobProfitability(range).map((r) => [
            r.name,
            r.jobType,
            r.status,
            money(r.contractCents),
            formatDecimal(r.pctBp),
            money(r.labourCents),
            money(r.expensesCents),
            money(r.marginToDateCents),
            money(r.forecastMarginCents),
            r.marginBp === null ? null : formatDecimal(r.marginBp),
          ]),
        };
      case "crew":
        return {
          header: [
            "Name",
            "Type",
            "Days",
            "Hours",
            "m2",
            "lm",
            "each",
            "Earnings",
            "Cost per unit by stage",
            "Jobs",
            "Utilisation %",
          ],
          rows: crew(range).map((r) => [
            r.name,
            r.type,
            r.days,
            formatDecimal(r.hours),
            ...UNITS.map((u) => formatDecimal(r.units.find((x) => x.unit === u)?.quantity ?? 0)),
            money(r.earningsCents),
            r.costPerUnit.map((u) => `${u.stageName} ${formatDecimal(u.centsPerUnit)}/${u.unit}`).join("; "),
            r.jobs,
            r.utilisationBp === null ? null : formatDecimal(r.utilisationBp),
          ]),
        };
      case "productivity":
        return {
          header: ["From", "To", "Stage", "Job type", "Unit", "Quantity", "Crew-days", "Per crew-day"],
          rows: productivity(range).map((r) => [
            r.period.from,
            r.period.to,
            r.stageName,
            r.jobType,
            r.unit,
            formatDecimal(r.quantity),
            r.crewDays,
            formatFixed2(r.perCrewDay),
          ]),
        };
      case "pauses":
        return {
          header: ["Month", "Job", "Stage", "Reason", "Working days"],
          rows: pauses(range).map((r) => [r.month, r.projectName, r.stageName, r.reason, r.workingDays]),
        };
      case "pay-history":
        return {
          header: [
            "Period start",
            "Period end",
            "Status",
            "Employees",
            "Contractors",
            "GST",
            "Reimbursements",
            "Total",
          ],
          rows: payHistory(range).map((r) => [
            r.period.start,
            r.period.end,
            r.status,
            money(r.employeesCents),
            money(r.contractorsCents),
            money(r.gstCents),
            money(r.reimbursementsCents),
            money(r.totalCents),
          ]),
        };
    }
  }

  return {
    async jobProfitability(actor, range) {
      return report(actor, range, () => jobProfitability(range), (rows) => ({
        format: "money",
        value: sum(rows.map((r) => r.forecastMarginCents)),
        label: `Forecast margin on ${plural(rows.length, "job")}`,
      }));
    },
    async crew(actor, range) {
      return report(actor, range, () => crew(range), (rows) => ({
        format: "money",
        value: sum(rows.map((r) => r.earningsCents)),
        label: `Earned by ${plural(rows.length, "person", "people")}`,
      }));
    },
    async productivity(actor, range) {
      return report(actor, range, () => productivity(range), () => productivityFigure(range));
    },
    async pauses(actor, range) {
      return report(actor, range, () => pauses(range), (rows) => ({
        format: "days",
        value: sum(rows.map((r) => r.workingDays)),
        label: `Working days lost across ${plural(new Set(rows.map((r) => r.projectId)).size, "job")}`,
      }));
    },
    async payHistory(actor, range) {
      return report(actor, range, () => payHistory(range), (rows) => {
        const paid = rows.filter((r) => r.status === "approved" || r.status === "exported");
        return {
          format: "money",
          value: sum(paid.map((r) => r.totalCents)),
          label: `Paid in ${plural(paid.length, "pay run")}`,
          draftCents: sum(rows.filter((r) => r.status === "draft").map((r) => r.totalCents)),
        };
      });
    },
    async csv(actor: Actor, kind: ReportKind, range: DateRange): Promise<ExportFile> {
      c.access(actor);
      const { header, rows } = csvFor(kind, range);
      return {
        filename: `${kind}-${range.from}-to-${range.to}.csv`,
        contentType: "text/csv; charset=utf-8",
        body: toCsv(header, rows),
      };
    },
  };
}
