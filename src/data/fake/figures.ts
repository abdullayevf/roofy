/**
 * Every figure the fake services show, computed only by `src/domain` functions over the store
 * (Review Focus 2). Memoised per store version, work date and Owner-2FA reading. Sums are domain
 * `sum` over cents the domain already computed; nothing here multiplies or divides money.
 */
import { findGaps, utilisation, type AttendanceInput, type CrewActive } from "@/domain/attendance";
import { expenseCost, labourCost, type CostContext } from "@/domain/costing";
import { addDays, countWorkingDays, daysBetween } from "@/domain/dates";
import { doublePayFlags, duplicateFlags, pausedStageFlags, type FlagLog } from "@/domain/flags";
import { floorCheck, type FloorResult } from "@/domain/floor";
import type { PersonTotals } from "@/domain/gst";
import { receiptTotal } from "@/domain/gst";
import { ledgerBalance, oldestUnpaidCreditDate, unpaidTooLong, type LedgerEntry } from "@/domain/ledger";
import { sum } from "@/domain/money";
import { buildPayRun, type LineLabel, type PayPerson, type PayReimbursement } from "@/domain/payrun";
import { payPeriodContaining, type PayPeriod } from "@/domain/periods";
import {
  budgetAlert,
  forecastLabour,
  projectMargins,
  projectPercentBp,
  stageExpectedLabour,
  stagePercentBp,
} from "@/domain/progress";
import { ratioBp } from "@/domain/ratios";
import { pausePeriods, pausedTooLong, type StageSegment } from "@/domain/segments";
import type { Basis, BasisPoints, Cents, Hundredths, LocalDate, Unit } from "@/domain/types";
import type {
  BudgetAlertDto,
  Id,
  PauseInfo,
  PayFlag,
  PayFlagKind,
  PayRunTotals,
  StageChip,
  TapeManager,
} from "../contracts";
import type { StoreIndex } from "./indexes";
import type { CrewMemberRow, ExpenseRow, PayRunRow, ProjectRow, StageRow, WorkLogRow } from "./rows";
import type { Seed } from "./seed";
import { toPayLog } from "./seed-builder";

export interface StageFigures {
  stage: StageRow;
  measured: Hundredths;
  pctBp: BasisPoints;
  actualCents: Cents;
  forecastCents: Cents | null;
  /** Pay rules §12: forecast if any, else max(budget, actual). */
  expectedCents: Cents;
  alert: BudgetAlertDto | null;
  tape: TapeManager;
  segments: StageSegment[];
}

export interface ProjectFigures {
  project: ProjectRow;
  stages: StageFigures[];
  pctBp: BasisPoints;
  labourActualCents: Cents;
  labourBudgetCents: Cents;
  labourExpectedCents: Cents;
  materialsActualCents: Cents;
  materialsBudgetCents: Cents;
  expensesCents: Cents;
  margins: { earnedValueCents: Cents; marginToDateCents: Cents; forecastMarginCents: Cents };
  alert: BudgetAlertDto | null;
  lastLogDate: LocalDate | null;
  daysSinceLastLog: number | null;
}

export interface RunLine {
  logId: Id;
  date: LocalDate;
  projectId: Id;
  stageId: Id;
  basis: Basis;
  unit: Unit | null;
  quantity: Hundredths;
  hours: Hundredths;
  multiplier: Hundredths | null;
  rateCents: Cents | null;
  amountCents: Cents;
  label: LineLabel;
  missingRate: boolean;
}

export interface RunReimbursement {
  expenseId: Id;
  date: LocalDate;
  supplier: string;
  projectId: Id;
  amountCents: Cents;
}

export interface RunPerson {
  crew: CrewMemberRow;
  lines: RunLine[];
  reimbursements: RunReimbursement[];
  totals: PersonTotals;
  hours: Hundredths;
  floorRateCents: Cents | null;
  floor: FloorResult | null;
  noHours: boolean;
  missingRate: boolean;
}

export interface RunFigures {
  run: PayRunRow;
  period: PayPeriod;
  people: RunPerson[];
  /** Drafts only (approved runs are frozen); most severe first. */
  flags: PayFlag[];
  totals: PayRunTotals;
  blockedBy: ("missing_rate" | "owner_2fa_off")[];
}

export interface LedgerFigures {
  entries: LedgerEntry[];
  balanceCents: Cents;
  oldestUnpaidDate: LocalDate | null;
  unpaidTooLong: boolean;
}

/** Pay rules §9 table order: blocking flags first, then warnings. */
export const PAY_FLAG_ORDER: readonly PayFlagKind[] = [
  "missing_rate",
  "owner_2fa_off",
  "below_floor",
  "double_pay",
  "paused_stage",
  "gap",
  "possible_duplicate",
  "no_hours",
];

const MATERIALS = "Materials";

export function toAlertDto(alert: ReturnType<typeof budgetAlert>): BudgetAlertDto | null {
  if (alert === null) return null;
  return { level: alert.level, severity: alert.level === "over" ? "over" : "watch", byCents: alert.byCents };
}

/** Over beats trending; then the larger amount. */
function worse(a: BudgetAlertDto | null, b: BudgetAlertDto | null): BudgetAlertDto | null {
  if (a === null) return b;
  if (b === null) return a;
  if (a.level !== b.level) return a.level === "over" ? a : b;
  return b.byCents > a.byCents ? b : a;
}

export class Figures {
  readonly ctx: CostContext;
  readonly periodDays: number;
  private readonly stageMemo = new Map<Id, StageFigures>();
  private readonly projectMemo = new Map<Id, ProjectFigures>();
  private readonly ledgerMemo = new Map<Id, LedgerFigures>();
  private readonly runMemo = new Map<Id, RunFigures>();
  private readonly materialsId: Id | null;

  constructor(
    readonly t: Seed,
    readonly ix: StoreIndex,
    readonly today: LocalDate,
    readonly ownerTwoFactor: boolean,
  ) {
    this.ctx = { workspaceGstRegistered: t.workspace.gstRegistered, onCostBp: t.workspace.onCostBp };
    this.periodDays = t.workspace.payPeriod === "weekly" ? 7 : 14;
    this.materialsId = t.expenseCategories.find((c) => c.name === MATERIALS)?.id ?? null;
  }

  // ─── Costing (pay rules §11) ──────────────────────────────────────────────

  crewOf(id: Id): CrewMemberRow {
    const crew = this.ix.crew.get(id);
    if (!crew) throw new Error(`no crew member ${id}`);
    return crew;
  }

  labourCostOf(log: WorkLogRow): Cents {
    return labourCost(log.amountCents, this.crewOf(log.crewMemberId), this.ctx);
  }

  labourOf(logs: readonly WorkLogRow[]): Cents {
    return sum(logs.map((l) => this.labourCostOf(l)));
  }

  expenseCostOf(e: ExpenseRow): Cents {
    return expenseCost(e.amountExGstCents, e.gstCents, this.ctx.workspaceGstRegistered);
  }

  expenseTotalOf(e: ExpenseRow): Cents {
    return receiptTotal(e);
  }

  isMaterials(e: ExpenseRow): boolean {
    return e.categoryId === this.materialsId;
  }

  // ─── Stages and projects (pay rules §12–§13) ──────────────────────────────

  stage(stageId: Id): StageFigures {
    const hit = this.stageMemo.get(stageId);
    if (hit) return hit;
    const st = this.ix.stages.get(stageId);
    if (!st) throw new Error(`no stage ${stageId}`);
    const measured = sum(this.ix.progressOf(stageId).map((p) => p.quantity));
    const pctBp = stagePercentBp({
      status: st.status,
      unit: st.unit,
      budgetQty: st.budgetQty,
      measuredQty: measured,
      manualPctBp: st.manualPctBp,
    });
    const actualCents = this.labourOf(this.ix.logsOfStage(stageId));
    const forecastCents = st.status === "not_started" ? null : forecastLabour(st.status, pctBp, actualCents);
    const alert = toAlertDto(budgetAlert(actualCents, forecastCents, st.labourBudgetCents));
    const figures: StageFigures = {
      stage: st,
      measured,
      pctBp,
      actualCents,
      forecastCents,
      expectedCents: stageExpectedLabour(forecastCents, st.labourBudgetCents, actualCents),
      alert,
      tape: {
        pctBp,
        overMarkerBp: forecastCents === null ? null : ratioBp(forecastCents, st.labourBudgetCents),
      },
      segments: this.ix.segmentsOf(stageId),
    };
    this.stageMemo.set(stageId, figures);
    return figures;
  }

  pauseOf(stageId: Id): PauseInfo | null {
    const st = this.ix.stages.get(stageId)!;
    if (st.status !== "paused") return null;
    const ongoing = pausePeriods(this.ix.segmentsOf(stageId), this.today).find((p) => p.ongoing);
    if (!ongoing) return null;
    const note = this.ix.segmentRowsOf(stageId).find((g) => g.endDate === ongoing.start)?.pauseNote ?? null;
    return {
      reason: ongoing.reason,
      note,
      since: ongoing.start,
      workingDays: countWorkingDays(ongoing.start, ongoing.end, this.t.workspace.workingDays),
    };
  }

  pausedTooLong(stageId: Id): boolean {
    return pausedTooLong(this.ix.segmentsOf(stageId), this.t.workspace.workingDays, this.today);
  }

  chip(st: StageRow): StageChip {
    return {
      stageId: st.id,
      name: st.name,
      status: st.status,
      pauseReason: this.pauseOf(st.id)?.reason ?? null,
    };
  }

  /** Stages being worked or waiting: Active and Paused, in order. */
  currentStages(projectId: Id): StageChip[] {
    return this.ix
      .stagesOf(projectId)
      .filter((s) => s.status === "active" || s.status === "paused")
      .map((s) => this.chip(s));
  }

  project(projectId: Id): ProjectFigures {
    const hit = this.projectMemo.get(projectId);
    if (hit) return hit;
    const project = this.ix.projects.get(projectId);
    if (!project) throw new Error(`no project ${projectId}`);
    const stages = this.ix.stagesOf(projectId).map((s) => this.stage(s.id));
    const expenses = this.ix.expensesOf(projectId);
    const pctBp = projectPercentBp(
      stages.map((s) => ({ pctBp: s.pctBp, labourBudgetCents: s.stage.labourBudgetCents })),
    );
    const labourActualCents = sum(stages.map((s) => s.actualCents));
    const expensesCents = sum(expenses.map((e) => this.expenseCostOf(e)));
    const materialsActualCents = sum(
      expenses.filter((e) => this.isMaterials(e)).map((e) => this.expenseCostOf(e)),
    );
    const materialsBudgetCents = sum(stages.map((s) => s.stage.materialsBudgetCents));
    const margins = projectMargins({
      contractCents: project.contractValueCents,
      projectPctBp: pctBp,
      labourCostCents: labourActualCents,
      expenseCostCents: expensesCents,
      materialsBudgetCents,
      materialsExpenseCents: materialsActualCents,
      stages: stages.map((s) => ({
        forecastCents: s.forecastCents,
        labourBudgetCents: s.stage.labourBudgetCents,
        actualLabourCents: s.actualCents,
      })),
    });
    const logs = this.ix.logsOfProject(projectId);
    const lastLogDate = logs.reduce<LocalDate | null>(
      (m, l) => (m === null || l.date > m ? l.date : m),
      null,
    );
    const figures: ProjectFigures = {
      project,
      stages,
      pctBp,
      labourActualCents,
      labourBudgetCents: sum(stages.map((s) => s.stage.labourBudgetCents)),
      labourExpectedCents: sum(stages.map((s) => s.expectedCents)),
      materialsActualCents,
      materialsBudgetCents,
      expensesCents,
      margins,
      alert: stages.reduce<BudgetAlertDto | null>((a, s) => worse(a, s.alert), null),
      lastLogDate,
      daysSinceLastLog: lastLogDate === null ? null : daysBetween(lastLogDate, this.today),
    };
    this.projectMemo.set(projectId, figures);
    return figures;
  }

  // ─── Ledger (pay rules §15) ───────────────────────────────────────────────

  ledger(crewId: Id): LedgerFigures {
    const hit = this.ledgerMemo.get(crewId);
    if (hit) return hit;
    const entries = this.ix
      .ledgerOf(crewId)
      .map((e) => ({ date: e.date, kind: e.kind, amountCents: e.amountCents }));
    const figures = {
      entries,
      balanceCents: ledgerBalance(entries),
      oldestUnpaidDate: oldestUnpaidCreditDate(entries),
      unpaidTooLong: unpaidTooLong(entries, this.today, this.periodDays),
    };
    this.ledgerMemo.set(crewId, figures);
    return figures;
  }

  // ─── Attendance (pay rules §14) ───────────────────────────────────────────

  attendance(start: LocalDate, endExclusive: LocalDate): AttendanceInput {
    return {
      start,
      endExclusive,
      workingDays: this.t.workspace.workingDays,
      loggedDays: this.ix.loggedDays,
      noWork: this.ix.noWorkDays,
    };
  }

  crewActive(c: CrewMemberRow): CrewActive {
    return { crewMemberId: c.id, activeFrom: c.activeFrom, activeTo: c.activeTo };
  }

  /** Gaps in [start, end], never counting today or later (the day isn't over). */
  gaps(period: PayPeriod): { crewMemberId: Id; date: LocalDate }[] {
    const endExclusive = addDays(period.end, 1) < this.today ? addDays(period.end, 1) : this.today;
    if (endExclusive <= period.start) return [];
    return findGaps(
      this.attendance(period.start, endExclusive),
      this.t.crewMembers.map((c) => this.crewActive(c)),
    );
  }

  utilisationOf(crewId: Id, start: LocalDate, endExclusive: LocalDate) {
    return utilisation(this.attendance(start, endExclusive), this.crewActive(this.crewOf(crewId)));
  }

  // ─── Pay periods and runs (pay rules §6–§10) ──────────────────────────────

  periodContaining(date: LocalDate): PayPeriod {
    const w = this.t.workspace;
    return payPeriodContaining(date, {
      frequency: w.payPeriod,
      weekStartDay: w.payWeekStart,
      anchor: w.payAnchor,
    });
  }

  /** The draft to review now: the oldest draft. */
  reviewRun(): PayRunRow | null {
    return (
      this.t.payRuns
        .filter((r) => r.status === "draft")
        .sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0] ?? null
    );
  }

  private payPeople(): PayPerson[] {
    return this.t.crewMembers.map((c) => ({
      id: c.id,
      type: c.type,
      gstRegistered: c.gstRegistered,
      floorHourlyCents: this.floorRateOf(c),
    }));
  }

  floorRateOf(c: CrewMemberRow): Cents | null {
    return c.levelId === null ? null : (this.ix.levels.get(c.levelId)?.floorRateCents ?? null);
  }

  run(runId: Id): RunFigures {
    const hit = this.runMemo.get(runId);
    if (hit) return hit;
    const run = this.ix.payRuns.get(runId);
    if (!run) throw new Error(`no pay run ${runId}`);
    const figures = run.status === "draft" ? this.draftRun(run) : this.frozenRun(run);
    this.runMemo.set(runId, figures);
    return figures;
  }

  private draftRun(run: PayRunRow): RunFigures {
    const period = { start: run.periodStart, end: run.periodEnd };
    // buildPayRun's precondition: while an earlier draft is open, this one takes only its own dates.
    const earlierDraft = this.t.payRuns.some((r) => r.status === "draft" && r.periodStart < run.periodStart);
    const inScope = (date: LocalDate) => date <= period.end && (!earlierDraft || date >= period.start);
    const logs = this.ix.openLogs.filter((l) => inScope(l.date));
    const reimbursements: PayReimbursement[] = this.t.expenses
      .filter(
        (e) =>
          e.paidBy === "crew" &&
          e.crewMemberId !== null &&
          e.reimbursedInPayRunId === null &&
          inScope(e.date),
      )
      .map((e) => ({
        expenseId: e.id,
        crewMemberId: e.crewMemberId!,
        date: e.date,
        amountCents: receiptTotal(e),
        reimbursed: false,
      }));
    const built = buildPayRun(period, this.payPeople(), logs.map(toPayLog), reimbursements);
    const people: RunPerson[] = built.map((p) => {
      const crew = this.crewOf(p.crewMemberId);
      return {
        crew,
        lines: p.lines.map(({ log, label }) => {
          const row = this.ix.logs.get(log.id)!;
          return {
            logId: row.id,
            date: row.date,
            projectId: row.projectId,
            stageId: row.stageId,
            basis: row.basis,
            unit: row.unit,
            quantity: row.quantity,
            hours: row.hours,
            multiplier: row.multiplier,
            rateCents: row.rateCents,
            amountCents: row.amountCents,
            label,
            missingRate: row.missingRate,
          };
        }),
        reimbursements: p.reimbursements.map((r) => {
          const e = this.ix.expenses.get(r.expenseId)!;
          return {
            expenseId: e.id,
            date: e.date,
            supplier: e.supplier,
            projectId: e.projectId,
            amountCents: r.amountCents,
          };
        }),
        totals: p.totals,
        hours: p.hours,
        floorRateCents: crew.type === "employee" ? this.floorRateOf(crew) : null,
        floor: p.floor,
        noHours: p.noHours,
        missingRate: p.missingRate,
      };
    });
    const flags = this.draftFlags(run, period, people, logs);
    const blockedBy = [
      ...(flags.some((f) => f.kind === "missing_rate") ? (["missing_rate"] as const) : []),
      ...(flags.some((f) => f.kind === "owner_2fa_off") ? (["owner_2fa_off"] as const) : []),
    ];
    return { run, period, people, flags, totals: this.runTotals(people), blockedBy };
  }

  private frozenRun(run: PayRunRow): RunFigures {
    const period = { start: run.periodStart, end: run.periodEnd };
    const byCrew = new Map<Id, { lines: RunLine[]; reimbursements: RunReimbursement[]; gst: Cents[] }>();
    for (const line of this.ix.linesOf(run.id)) {
      let bucket = byCrew.get(line.crewMemberId);
      if (!bucket) byCrew.set(line.crewMemberId, (bucket = { lines: [], reimbursements: [], gst: [] }));
      const s = line.snapshot;
      if (s.kind === "log") {
        bucket.lines.push({
          logId: line.refId!,
          date: s.date,
          projectId: s.projectId,
          stageId: s.stageId,
          basis: s.basis,
          unit: s.unit,
          quantity: s.quantity,
          hours: s.hours,
          multiplier: s.multiplier,
          rateCents: s.rateCents,
          amountCents: line.amountCents,
          label: s.label,
          missingRate:
            s.rateCents === null && (s.basis === "hourly" || s.basis === "daily" || s.basis === "per_unit"),
        });
      } else if (s.kind === "reimbursement") {
        bucket.reimbursements.push({
          expenseId: line.refId!,
          date: s.date,
          supplier: s.supplier,
          projectId: s.projectId,
          amountCents: line.amountCents,
        });
      } else bucket.gst.push(line.amountCents);
    }
    const people: RunPerson[] = this.t.crewMembers
      .filter((c) => byCrew.has(c.id))
      .map((crew) => {
        const b = byCrew.get(crew.id)!;
        const subtotalCents = sum(b.lines.map((l) => l.amountCents));
        const gstCents = sum(b.gst);
        const reimbursementsCents = sum(b.reimbursements.map((r) => r.amountCents));
        const hours = sum(b.lines.map((l) => l.hours));
        const floorRateCents = crew.type === "employee" ? this.floorRateOf(crew) : null;
        return {
          crew,
          lines: b.lines,
          reimbursements: b.reimbursements,
          totals: {
            subtotalCents,
            gstCents,
            reimbursementsCents,
            totalCents: sum([subtotalCents, gstCents, reimbursementsCents]),
          },
          hours,
          floorRateCents,
          floor:
            floorRateCents !== null && hours > 0 ? floorCheck(subtotalCents, hours, floorRateCents) : null,
          noHours: crew.type === "employee" && subtotalCents !== 0 && hours === 0,
          missingRate: b.lines.some((l) => l.missingRate),
        };
      });
    return { run, period, people, flags: [], totals: this.runTotals(people), blockedBy: [] };
  }

  private runTotals(people: RunPerson[]): PayRunTotals {
    const total = (type: "employee" | "contractor") =>
      sum(people.filter((p) => p.crew.type === type).map((p) => p.totals.totalCents));
    return {
      employeesCents: total("employee"),
      contractorsCents: total("contractor"),
      gstCents: sum(people.map((p) => p.totals.gstCents)),
      reimbursementsCents: sum(people.map((p) => p.totals.reimbursementsCents)),
      totalCents: sum(people.map((p) => p.totals.totalCents)),
    };
  }

  private draftFlags(run: PayRunRow, period: PayPeriod, people: RunPerson[], logs: WorkLogRow[]): PayFlag[] {
    const blank = (kind: PayFlagKind, blocking: boolean): PayFlag => ({
      kind,
      blocking,
      crewMemberId: null,
      crewName: null,
      dates: [],
      projectName: null,
      stageName: null,
      basis: null,
      unit: null,
      logIds: [],
      href: null,
      floor: null,
    });
    const crewPart = (id: Id) => ({ crewMemberId: id, crewName: this.crewOf(id).name });
    const stagePart = (stageId: Id) => {
      const st = this.ix.stages.get(stageId)!;
      return {
        projectName: this.ix.projects.get(st.projectId)!.nickname,
        stageName: st.name,
        href: `/jobs/${st.projectId}/stages/${st.id}`,
      };
    };
    const uniqueDates = (dates: LocalDate[]) => [...new Set(dates)].sort();
    const flags: PayFlag[] = [];

    for (const p of people) {
      const missing = new Map<string, RunLine[]>();
      for (const l of p.lines.filter((x) => x.missingRate)) {
        const key = `${l.basis}|${l.unit}`;
        missing.set(key, [...(missing.get(key) ?? []), l]);
      }
      for (const lines of missing.values()) {
        const first = lines[0]!;
        flags.push({
          ...blank("missing_rate", true),
          ...crewPart(p.crew.id),
          ...stagePart(first.stageId),
          dates: uniqueDates(lines.map((l) => l.date)),
          basis:
            first.basis === "hourly" || first.basis === "daily" || first.basis === "per_unit"
              ? first.basis
              : null,
          unit: first.unit,
          logIds: lines.map((l) => l.logId),
          href: `/crew/${p.crew.id}`,
        });
      }
    }
    if (!this.ownerTwoFactor) flags.push({ ...blank("owner_2fa_off", true), href: "/settings/members" });
    for (const p of people) {
      if (p.floor?.below && p.floorRateCents !== null) {
        flags.push({
          ...blank("below_floor", false),
          ...crewPart(p.crew.id),
          href: `/pay/${run.id}#crew-${p.crew.id}`,
          floor: {
            floorRateCents: p.floorRateCents,
            effectiveHourlyCents: p.floor.effectiveHourlyCents!,
            shortfallCents: p.floor.shortfallCents,
          },
        });
      }
    }
    const flagLogs: FlagLog[] = logs.map((l) => ({
      id: l.id,
      crewMemberId: l.crewMemberId,
      date: l.date,
      stageId: l.stageId,
      basis: l.basis,
      source: l.source,
      entryId: l.entryId,
    }));
    for (const g of doublePayFlags(flagLogs)) {
      flags.push({
        ...blank("double_pay", false),
        ...crewPart(g.crewMemberId),
        ...stagePart(g.stageId),
        dates: [g.date],
        logIds: g.logIds,
      });
    }
    const segments = new Map(
      [...new Set(logs.map((l) => l.stageId))].map((id) => [id, this.ix.segmentsOf(id)]),
    );
    for (const logId of pausedStageFlags(flagLogs, segments)) {
      const l = this.ix.logs.get(logId)!;
      flags.push({
        ...blank("paused_stage", false),
        ...crewPart(l.crewMemberId),
        ...stagePart(l.stageId),
        dates: [l.date],
        logIds: [l.id],
      });
    }
    const gapsByCrew = new Map<Id, LocalDate[]>();
    for (const g of this.gaps(period))
      gapsByCrew.set(g.crewMemberId, [...(gapsByCrew.get(g.crewMemberId) ?? []), g.date]);
    for (const [crewId, dates] of gapsByCrew) {
      flags.push({ ...blank("gap", false), ...crewPart(crewId), dates, href: `/log?date=${dates[0]}` });
    }
    for (const g of duplicateFlags(flagLogs)) {
      flags.push({
        ...blank("possible_duplicate", false),
        ...crewPart(g.crewMemberId),
        ...stagePart(g.stageId),
        dates: [g.date],
        logIds: g.logIds,
      });
    }
    for (const p of people.filter((x) => x.noHours)) {
      flags.push({ ...blank("no_hours", false), ...crewPart(p.crew.id), href: `/crew/${p.crew.id}` });
    }
    const rank = (k: PayFlagKind) => PAY_FLAG_ORDER.indexOf(k);
    return flags
      .map((f, i) => [f, i] as const)
      .sort(([a, i], [b, j]) => rank(a.kind) - rank(b.kind) || i - j)
      .map(([f]) => f);
  }

  /** Crew-paid expense → its reimbursement state (pay rules §7). */
  reimbursementOf(
    e: ExpenseRow,
  ): { payRunId: Id | null; status: "waiting" | "in_draft" | "reimbursed" } | null {
    if (e.paidBy !== "crew") return null;
    if (e.reimbursedInPayRunId !== null) return { payRunId: e.reimbursedInPayRunId, status: "reimbursed" };
    const draft = this.t.payRuns
      .filter((r) => r.status === "draft" && r.periodEnd >= e.date)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0];
    return draft ? { payRunId: draft.id, status: "in_draft" } : { payRunId: null, status: "waiting" };
  }
}
