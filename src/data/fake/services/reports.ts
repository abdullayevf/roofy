import { dayKey } from "@/domain/attendance";
import { addDays, countWorkingDays } from "@/domain/dates";
import { sum } from "@/domain/money";
import { centsPerUnit, quantityPerDay, ratioBp } from "@/domain/ratios";
import { pausePeriods } from "@/domain/segments";
import type { Unit } from "@/domain/types";
import { formatDecimal } from "@/lib/format";
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

const money = (cents: number | null) => (cents === null ? null : formatDecimal(cents));

export function createReportService(c: FakeContext): ReportService {
  const logsIn = (r: DateRange): WorkLogRow[] => c.ix.liveLogs.filter((l) => inRange(l.date, r));

  function report<Row>(actor: Actor, range: DateRange, rows: () => Row[]): Report<Row> {
    const access = c.access(actor);
    return { view: "manager", access, range, rows: rows() };
  }

  /**
   * Jobs with a log or expense in the range, or active now. Figures are each job's to date (pay
   * rules §12 margins), so a row always reconciles with its Job detail page.
   */
  function jobProfitability(range: DateRange): JobProfitRow[] {
    const touched = new Set([
      ...logsIn(range).map((l) => l.projectId),
      ...c.t.expenses.filter((e) => inRange(e.date, range)).map((e) => e.projectId),
    ]);
    return c.t.projects
      .filter((p) => p.status === "active" || touched.has(p.id))
      .sort(
        (a, b) =>
          (b.startDate ?? "").localeCompare(a.startDate ?? "") || a.nickname.localeCompare(b.nickname),
      )
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
      });
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
        const groups = new Map<
          string,
          { stageName: string; unit: Unit; logs: WorkLogRow[]; qty: number[] }
        >();
        for (const l of perUnit) {
          const stageName = c.ix.stages.get(l.stageId)!.name;
          const key = `${stageName}|${l.unit}`;
          if (!groups.has(key)) groups.set(key, { stageName, unit: l.unit!, logs: [], qty: [] });
          groups.get(key)!.qty.push(l.quantity);
        }
        for (const l of mine) {
          const st = c.ix.stages.get(l.stageId)!;
          groups.get(`${st.name}|${st.unit}`)?.logs.push(l);
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
            const cents = centsPerUnit(c.fig.labourOf(g.logs), sum(g.qty));
            return cents === null ? [] : [{ stageName: g.stageName, unit: g.unit, centsPerUnit: cents }];
          }),
          jobs: new Set(mine.map((l) => l.projectId)).size,
          utilisationBp: util?.bp ?? null,
        };
      });
  }

  function productivity(range: DateRange): ProductivityRow[] {
    const groups = new Map<string, ProductivityRow & { qty: number[]; stageIds: Set<string> }>();
    for (const p of c.t.progressEntries.filter((x) => inRange(x.date, range))) {
      const st = c.ix.stages.get(p.stageId)!;
      const project = c.ix.projects.get(st.projectId)!;
      const month = p.date.slice(0, 7);
      const key = `${month}|${st.name}|${project.jobType}|${st.unit}`;
      if (!groups.has(key)) {
        groups.set(key, {
          month,
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
        const days = new Set(
          [...stageIds].flatMap((id) =>
            c.ix
              .logsOfStage(id)
              .filter((l) => l.date.startsWith(row.month) && inRange(l.date, range))
              .map((l) => dayKey(l.crewMemberId, l.date)),
          ),
        ).size;
        const quantity = sum(qty);
        return { ...row, quantity, crewDays: days, perCrewDay: quantityPerDay(quantity, days) ?? 0 };
      })
      .sort((a, b) => b.month.localeCompare(a.month) || a.stageName.localeCompare(b.stageName));
  }

  function pauses(range: DateRange): PauseReportRow[] {
    const wd = c.t.workspace.workingDays;
    const rows: { start: string; row: PauseReportRow }[] = c.t.stages.flatMap((st) =>
      pausePeriods(c.ix.segmentsOf(st.id), c.today)
        .filter((p) => inRange(p.start, range))
        .map((p) => {
          const project = c.ix.projects.get(st.projectId)!;
          return {
            start: p.start,
            row: {
              month: p.start.slice(0, 7),
              projectId: project.id,
              projectName: project.nickname,
              stageName: st.name,
              reason: p.reason,
              workingDays: countWorkingDays(p.start, p.end, wd),
            },
          };
        }),
    );
    return rows
      .sort((a, b) => b.start.localeCompare(a.start) || a.row.projectName.localeCompare(b.row.projectName))
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
          header: ["Name", "Type", "Days", "Hours", "m2", "lm", "each", "Earnings", "Jobs", "Utilisation %"],
          rows: crew(range).map((r) => [
            r.name,
            r.type,
            r.days,
            formatDecimal(r.hours),
            ...UNITS.map((u) => formatDecimal(r.units.find((x) => x.unit === u)?.quantity ?? 0)),
            money(r.earningsCents),
            r.jobs,
            r.utilisationBp === null ? null : formatDecimal(r.utilisationBp),
          ]),
        };
      case "productivity":
        return {
          header: ["Month", "Stage", "Job type", "Unit", "Quantity", "Crew-days", "Per crew-day"],
          rows: productivity(range).map((r) => [
            r.month,
            r.stageName,
            r.jobType,
            r.unit,
            formatDecimal(r.quantity),
            r.crewDays,
            formatDecimal(r.perCrewDay),
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
      return report(actor, range, () => jobProfitability(range));
    },
    async crew(actor, range) {
      return report(actor, range, () => crew(range));
    },
    async productivity(actor, range) {
      return report(actor, range, () => productivity(range));
    },
    async pauses(actor, range) {
      return report(actor, range, () => pauses(range));
    },
    async payHistory(actor, range) {
      return report(actor, range, () => payHistory(range));
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
