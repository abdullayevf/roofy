/**
 * Mutable builder behind `buildSeed()`: row factories, the stage lifecycle (start / pause / resume /
 * done → segments), crew-day grid logs, progress entries, lump sums, expenses, post-hoc budgets and
 * weekly pay runs with ledger entries. Every money figure comes from `src/domain`.
 */
import type { NoWorkReason } from "@/domain/attendance";
import { labourCost } from "@/domain/costing";
import { addDays, daysBetween } from "@/domain/dates";
import { receiptTotal, splitReceipt } from "@/domain/gst";
import { ledgerBalance } from "@/domain/ledger";
import { dailyAmount, defaultHours, hourlyAmount } from "@/domain/lines";
import { mulDivRound, sum } from "@/domain/money";
import { buildPayRun, type PayLog, type PayPerson, type PayReimbursement } from "@/domain/payrun";
import { lumpSumLines, pieceRateLines } from "@/domain/piece";
import { forecastLabour, stagePercentBp } from "@/domain/progress";
import { resolveRate } from "@/domain/rates";
import type { PauseReason } from "@/domain/segments";
import { splitWeighted, type Shares } from "@/domain/split";
import type { BasisPoints, Cents, Hundredths, LocalDate, RateBasis, Unit } from "@/domain/types";
import type { GridBasis, Id, Instant, JobType, PaidBy, PayoutMethod, ProjectStatus } from "../contracts";
import { Rng } from "./rng";
import type {
  CrewMemberRow,
  ExpenseRow,
  ProjectRow,
  RateRow,
  RowBase,
  SeedTables,
  StageRow,
  StageSegmentRow,
  WorkLogRow,
  WorkspaceRow,
} from "./rows";

export const TIMEZONE = "Australia/Sydney";
export const WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5];
export const STANDARD_DAY: Hundredths = 800;

export interface TemplateItemDef {
  name: string;
  unit: Unit | null;
  labourShareBp: BasisPoints;
  materialsShareBp: BasisPoints;
}

interface StageMeta {
  labourShareBp: BasisPoints;
  materialsShareBp: BasisPoints;
  fixedLabour: boolean;
  fixedMaterials: boolean;
  open: StageSegmentRow | null;
  pausedBy: PauseReason | null;
  /** Distinct crew with a non-lump-sum log, in first-log order (pay rules §5 proposal). */
  loggers: Id[];
}

export interface GridSpec {
  crewId: Id;
  /** Force a time-only log (hours, $0) even for a time-paid person. */
  timeOnly?: boolean;
  hours?: Hundredths;
  days?: Hundredths;
  /** Adds a ×1.5 overtime line of this many hours (hourly workers). */
  overtimeHours?: Hundredths;
  createdAt?: Instant;
}

export interface EntryOpts {
  enteredBy: Id;
  createdAt?: Instant;
}

const OFFSET_FORMAT = new Intl.DateTimeFormat("en-AU", { timeZone: TIMEZONE, timeZoneName: "longOffset" });

export class SeedBuilder {
  readonly rng: Rng;
  readonly t: SeedTables;
  private readonly offsets = new Map<LocalDate, string>();
  private readonly instants = new Map<string, Instant>();
  private readonly stageMeta = new Map<Id, StageMeta>();
  private readonly ratesByCrew = new Map<Id, RateRow[]>();
  private readonly stagesById = new Map<Id, StageRow>();
  private readonly crewById = new Map<Id, CrewMemberRow>();
  private readonly noWorkKeys = new Set<string>();
  private readonly loggedKeys = new Set<string>();
  private readonly logsByStage = new Map<Id, WorkLogRow[]>();
  private readonly measuredByStage = new Map<Id, Hundredths>();
  private readonly projectsById = new Map<Id, ProjectRow>();

  constructor(
    seed: number,
    workspace: Omit<WorkspaceRow, "id" | "createdAt" | "updatedAt">,
    createdOn: LocalDate,
  ) {
    this.rng = new Rng(seed);
    const at = this.at(createdOn, "09:00");
    const ws: WorkspaceRow = { id: this.rng.uuid(), createdAt: at, updatedAt: at, ...workspace };
    this.t = {
      workspace: ws,
      members: [],
      projectAssignments: [],
      clients: [],
      projects: [],
      stageTemplates: [],
      stageTemplateItems: [],
      stages: [],
      stageSegments: [],
      stageCompletionShares: [],
      crewLevels: [],
      crewMembers: [],
      rates: [],
      progressEntries: [],
      progressShares: [],
      workLogs: [],
      noWork: [],
      expenseCategories: [],
      expenses: [],
      payRuns: [],
      payRunLines: [],
      ledgerEntries: [],
      statementLinks: [],
      files: [],
      clientMutations: [],
      auditEvents: [],
    };
  }

  // ─── Rows and time ────────────────────────────────────────────────────────

  id(): Id {
    return this.rng.uuid();
  }

  /** The instant of a Sydney wall-clock time on a local date ("HH:MM"). */
  at(date: LocalDate, hhmm = "17:30"): Instant {
    const key = `${date}T${hhmm}`;
    const hit = this.instants.get(key);
    if (hit !== undefined) return hit;
    let offset = this.offsets.get(date);
    if (offset === undefined) {
      const name = OFFSET_FORMAT.formatToParts(new Date(`${date}T02:00:00Z`)).find(
        (p) => p.type === "timeZoneName",
      )!.value;
      offset = name === "GMT" ? "+00:00" : name.slice(3);
      this.offsets.set(date, offset);
    }
    const instant = new Date(`${date}T${hhmm}:00${offset}`).toISOString();
    this.instants.set(key, instant);
    return instant;
  }

  base(createdAt: Instant): RowBase {
    return { id: this.id(), workspaceId: this.t.workspace.id, createdAt, updatedAt: createdAt };
  }

  // ─── Crew and rates ───────────────────────────────────────────────────────

  addCrew(row: Omit<CrewMemberRow, keyof RowBase>): CrewMemberRow {
    const crew: CrewMemberRow = { ...this.base(this.at(row.activeFrom, "08:00")), ...row };
    this.t.crewMembers.push(crew);
    this.crewById.set(crew.id, crew);
    this.ratesByCrew.set(crew.id, []);
    return crew;
  }

  crewRow(id: Id): CrewMemberRow {
    return this.crewById.get(id)!;
  }

  addRate(
    crewId: Id,
    basis: RateBasis,
    unit: Unit | null,
    amountCents: Cents,
    effectiveFrom: LocalDate,
    projectId: Id | null = null,
  ): RateRow {
    const rate: RateRow = {
      ...this.base(this.at(addDays(effectiveFrom, -1), "16:00")),
      crewMemberId: crewId,
      basis,
      unit,
      amountCents,
      effectiveFrom,
      projectId,
    };
    this.t.rates.push(rate);
    this.ratesByCrew.get(crewId)!.push(rate);
    return rate;
  }

  rateFor(crewId: Id, basis: RateBasis, unit: Unit | null, projectId: Id, date: LocalDate): Cents | null {
    return (
      resolveRate(this.ratesByCrew.get(crewId)!, { crewMemberId: crewId, basis, unit, projectId, date })
        ?.amountCents ?? null
    );
  }

  // ─── Projects and stages ──────────────────────────────────────────────────

  addProject(p: {
    clientId: Id;
    nickname: string;
    siteAddress: string;
    jobType: JobType;
    status: ProjectStatus;
    createdOn: LocalDate;
  }): ProjectRow {
    const row: ProjectRow = {
      ...this.base(this.at(p.createdOn, "10:00")),
      clientId: p.clientId,
      siteAddress: p.siteAddress,
      nickname: p.nickname,
      jobType: p.jobType,
      contractValueCents: 0,
      status: p.status,
      startDate: null,
      targetFinish: null,
    };
    this.t.projects.push(row);
    this.projectsById.set(row.id, row);
    return row;
  }

  addStage(
    project: ProjectRow,
    item: TemplateItemDef,
    position: number,
    o: {
      budgetQty?: Hundredths | null;
      labourBudgetCents?: Cents;
      materialsBudgetCents?: Cents;
      lumpSumCents?: Cents | null;
      manualPctBp?: BasisPoints | null;
    } = {},
  ): StageRow {
    const row: StageRow = {
      ...this.base(project.createdAt),
      projectId: project.id,
      name: item.name,
      position,
      status: "not_started",
      unit: item.unit,
      budgetQty: o.budgetQty ?? null,
      labourBudgetCents: o.labourBudgetCents ?? 0,
      materialsBudgetCents: o.materialsBudgetCents ?? 0,
      lumpSumCents: o.lumpSumCents ?? null,
      manualPctBp: o.manualPctBp ?? null,
      completedOn: null,
      completionNote: null,
    };
    this.t.stages.push(row);
    this.stagesById.set(row.id, row);
    this.stageMeta.set(row.id, {
      labourShareBp: item.labourShareBp,
      materialsShareBp: item.materialsShareBp,
      fixedLabour: o.labourBudgetCents !== undefined,
      fixedMaterials: o.materialsBudgetCents !== undefined,
      open: null,
      pausedBy: null,
      loggers: [],
    });
    return row;
  }

  stage(id: Id): StageRow {
    return this.stagesById.get(id)!;
  }

  loggers(stageId: Id): Id[] {
    return this.stageMeta.get(stageId)!.loggers;
  }

  pausedBy(stageId: Id): PauseReason | null {
    return this.stageMeta.get(stageId)!.pausedBy;
  }

  startStage(stageId: Id, date: LocalDate): void {
    const st = this.stage(stageId);
    if (st.status !== "not_started") throw new Error(`${st.name} already started`);
    st.status = "active";
    this.openSegment(stageId, date);
    const project = this.projectsById.get(st.projectId)!;
    if (project.startDate === null || date < project.startDate) project.startDate = date;
  }

  pauseStage(stageId: Id, date: LocalDate, reason: PauseReason, note: string | null = null): void {
    const st = this.stage(stageId);
    const meta = this.stageMeta.get(stageId)!;
    if (st.status !== "active" || !meta.open) throw new Error(`${st.name} is not active`);
    meta.open.endDate = date;
    meta.open.pauseReason = reason;
    meta.open.pauseNote = note;
    meta.open.updatedAt = this.at(date, "07:30");
    meta.open = null;
    meta.pausedBy = reason;
    st.status = "paused";
  }

  resumeStage(stageId: Id, date: LocalDate): void {
    const st = this.stage(stageId);
    if (st.status !== "paused") throw new Error(`${st.name} is not paused`);
    st.status = "active";
    this.stageMeta.get(stageId)!.pausedBy = null;
    this.openSegment(stageId, date);
  }

  doneStage(stageId: Id, date: LocalDate, note: string | null = null): void {
    const st = this.stage(stageId);
    const meta = this.stageMeta.get(stageId)!;
    if (st.status !== "active" || !meta.open) throw new Error(`${st.name} is not active`);
    meta.open.endDate = addDays(date, 1);
    meta.open.updatedAt = this.at(date, "16:30");
    meta.open = null;
    st.status = "done";
    st.completedOn = date;
    st.completionNote = note;
    if (st.lumpSumCents !== null) this.lumpSum(stageId, date);
  }

  private openSegment(stageId: Id, date: LocalDate): void {
    const seg: StageSegmentRow = {
      ...this.base(this.at(date, "07:00")),
      stageId,
      startDate: date,
      endDate: null,
      pauseReason: null,
      pauseNote: null,
    };
    this.t.stageSegments.push(seg);
    this.stageMeta.get(stageId)!.open = seg;
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────

  /** Pay rules §4/§5 and product spec §5.5: which basis the grid uses for this person on this stage. */
  gridBasis(crew: CrewMemberRow, stage: StageRow, timeOnly = false): GridBasis {
    if (timeOnly || stage.lumpSumCents !== null) return "time_only";
    if (crew.defaultBasis === "per_unit") {
      return stage.unit !== null && stage.unit === crew.defaultUnit ? "time_only" : "daily";
    }
    return crew.defaultBasis;
  }

  private pushLog(log: Omit<WorkLogRow, keyof RowBase>, createdAt: Instant): WorkLogRow {
    const row: WorkLogRow = { ...this.base(createdAt), ...log };
    this.t.workLogs.push(row);
    const onStage = this.logsByStage.get(log.stageId);
    if (onStage) onStage.push(row);
    else this.logsByStage.set(log.stageId, [row]);
    this.loggedKeys.add(`${log.crewMemberId}|${log.date}`);
    const meta = this.stageMeta.get(log.stageId)!;
    if (log.basis !== "lump_sum" && !meta.loggers.includes(log.crewMemberId))
      meta.loggers.push(log.crewMemberId);
    return row;
  }

  private ensureActive(stageId: Id, date: LocalDate): StageRow {
    const st = this.stage(stageId);
    if (st.status === "not_started") this.startStage(stageId, date);
    if (st.status !== "active") throw new Error(`log on ${st.name} (${st.status}) on ${date}`);
    return st;
  }

  /** One crew-day grid submission: same entry id for everyone on it. */
  grid(date: LocalDate, stageId: Id, specs: readonly GridSpec[], opts: EntryOpts): WorkLogRow[] {
    const st = this.ensureActive(stageId, date);
    const entryId = this.id();
    const createdAt = opts.createdAt ?? this.at(date);
    const logs: WorkLogRow[] = [];
    for (const spec of specs) {
      const crew = this.crewRow(spec.crewId);
      const basis = this.gridBasis(crew, st, spec.timeOnly);
      const common = {
        date,
        crewMemberId: crew.id,
        projectId: st.projectId,
        stageId,
        source: "grid" as const,
        adjustsLogId: null,
        progressEntryId: null,
        entryId,
        payRunId: null,
        enteredBy: opts.enteredBy,
        mutationId: entryId,
        deletedAt: null,
      };
      const at = spec.createdAt ?? createdAt;
      if (basis === "time_only") {
        logs.push(
          this.pushLog(
            {
              ...common,
              basis,
              unit: null,
              quantity: 0,
              hours: spec.hours ?? STANDARD_DAY,
              multiplier: null,
              rateCents: null,
              amountCents: 0,
              missingRate: false,
            },
            at,
          ),
        );
        continue;
      }
      const rate = this.rateFor(crew.id, basis, null, st.projectId, date);
      if (rate === null) throw new Error(`no ${basis} rate for ${crew.name} on ${date}`);
      if (basis === "daily") {
        const days = spec.days ?? 100;
        logs.push(
          this.pushLog(
            {
              ...common,
              basis,
              unit: null,
              quantity: days,
              hours: defaultHours(days, this.t.workspace.standardDayHours),
              multiplier: null,
              rateCents: rate,
              amountCents: dailyAmount(days, rate),
              missingRate: false,
            },
            at,
          ),
        );
        continue;
      }
      const lines: [Hundredths, Hundredths][] = [[spec.hours ?? STANDARD_DAY, 100]];
      if (spec.overtimeHours) lines.push([spec.overtimeHours, 150]);
      for (const [hours, multiplier] of lines) {
        logs.push(
          this.pushLog(
            {
              ...common,
              basis,
              unit: null,
              quantity: hours,
              hours,
              multiplier,
              rateCents: rate,
              amountCents: hourlyAmount(hours, rate, multiplier),
              missingRate: false,
            },
            at,
          ),
        );
      }
    }
    return logs;
  }

  /** Pay rules §4: a progress entry and its per-unit logs (missing rate → $0.00 + flag). */
  progress(
    date: LocalDate,
    stageId: Id,
    crewIds: readonly Id[],
    quantity: Hundredths,
    shares: Shares,
    opts: EntryOpts & { note?: string },
  ): WorkLogRow[] {
    const st = this.ensureActive(stageId, date);
    if (st.unit === null) throw new Error(`${st.name} has no unit`);
    const createdAt = opts.createdAt ?? this.at(date, "16:00");
    const entry = {
      ...this.base(createdAt),
      stageId,
      projectId: st.projectId,
      date,
      quantity,
      splitMode: shares.mode,
      enteredBy: opts.enteredBy,
      photoFileId: null,
      note: opts.note ?? null,
      mutationId: null as Id | null,
    };
    entry.mutationId = this.id();
    this.t.progressEntries.push(entry);
    this.measuredByStage.set(stageId, (this.measuredByStage.get(stageId) ?? 0) + quantity);
    const bp =
      shares.mode === "equal"
        ? splitWeighted(
            10_000,
            crewIds.map(() => 1),
          )
        : [...shares.bp];
    crewIds.forEach((crewMemberId, position) =>
      this.t.progressShares.push({
        ...this.base(createdAt),
        progressEntryId: entry.id,
        crewMemberId,
        position,
        shareBp: bp[position]!,
      }),
    );
    const members = crewIds.map((id) => ({
      crewMemberId: id,
      rateCents: this.rateFor(id, "per_unit", st.unit, st.projectId, date),
    }));
    return pieceRateLines(quantity, st.unit, members, shares).map((line) =>
      this.pushLog(
        {
          date,
          crewMemberId: line.crewMemberId,
          projectId: st.projectId,
          stageId,
          basis: "per_unit",
          unit: st.unit,
          quantity: line.quantity,
          hours: 0,
          multiplier: null,
          rateCents: line.rateCents,
          amountCents: line.amountCents,
          missingRate: line.missingRate,
          source: "progress",
          adjustsLogId: null,
          progressEntryId: entry.id,
          entryId: entry.id,
          payRunId: null,
          enteredBy: opts.enteredBy,
          mutationId: entry.mutationId,
          deletedAt: null,
        },
        createdAt,
      ),
    );
  }

  /** Pay rules §5: equal split of the lump sum among everyone who logged, dated the completion date. */
  private lumpSum(stageId: Id, date: LocalDate): void {
    const st = this.stage(stageId);
    const crewIds = this.loggers(stageId);
    const createdAt = this.at(date, "16:30");
    const bp = splitWeighted(
      10_000,
      crewIds.map(() => 1),
    );
    crewIds.forEach((crewMemberId, i) =>
      this.t.stageCompletionShares.push({ ...this.base(createdAt), stageId, crewMemberId, shareBp: bp[i]! }),
    );
    const entryId = this.id();
    for (const line of lumpSumLines(st.lumpSumCents!, crewIds, { mode: "equal" })) {
      this.pushLog(
        {
          date,
          crewMemberId: line.crewMemberId,
          projectId: st.projectId,
          stageId,
          basis: "lump_sum",
          unit: null,
          quantity: 0,
          hours: line.hours,
          multiplier: null,
          rateCents: null,
          amountCents: line.amountCents,
          missingRate: false,
          source: "lump_sum",
          adjustsLogId: null,
          progressEntryId: null,
          entryId,
          payRunId: null,
          enteredBy: this.t.members.find((m) => m.role === "manager")!.userId,
          mutationId: null,
          deletedAt: null,
        },
        createdAt,
      );
    }
  }

  /** Pay rules §8: an adjustment log carrying only the difference, linked to the locked original. */
  adjustment(
    original: WorkLogRow,
    delta: { quantity: Hundredths; hours: Hundredths; amountCents: Cents },
    opts: EntryOpts,
  ): WorkLogRow {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, workspaceId, createdAt, updatedAt, ...fields } = original;
    return this.pushLog(
      {
        ...fields,
        quantity: delta.quantity,
        hours: delta.hours,
        amountCents: delta.amountCents,
        source: "adjustment",
        adjustsLogId: original.id,
        entryId: this.id(),
        payRunId: null,
        enteredBy: opts.enteredBy,
        mutationId: null,
      },
      opts.createdAt ?? this.at(original.date),
    );
  }

  isLogged(crewId: Id, date: LocalDate): boolean {
    return this.loggedKeys.has(`${crewId}|${date}`);
  }

  noWork(crewId: Id, date: LocalDate, reason: NoWorkReason, opts: EntryOpts & { note?: string }): void {
    const key = `${crewId}|${date}`;
    if (this.noWorkKeys.has(key) || this.loggedKeys.has(key)) return;
    this.noWorkKeys.add(key);
    this.t.noWork.push({
      ...this.base(opts.createdAt ?? this.at(date, "07:15")),
      crewMemberId: crewId,
      date,
      reason,
      note: opts.note ?? null,
      enteredBy: opts.enteredBy,
    });
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  expense(e: {
    date: LocalDate;
    projectId: Id;
    stageId: Id | null;
    category: string;
    supplier: string;
    totalCents: Cents;
    noGst?: boolean;
    paidBy: PaidBy;
    crewMemberId?: Id | null;
    enteredBy: Id;
    createdAt?: Instant;
  }): ExpenseRow {
    const category = this.t.expenseCategories.find((c) => c.name === e.category);
    if (!category) throw new Error(`no category ${e.category}`);
    const split = e.noGst ? splitReceipt(e.totalCents, 0) : splitReceipt(e.totalCents);
    const row: ExpenseRow = {
      ...this.base(e.createdAt ?? this.at(e.date, "12:30")),
      projectId: e.projectId,
      stageId: e.stageId,
      categoryId: category.id,
      supplier: e.supplier,
      date: e.date,
      amountExGstCents: split.amountExGstCents,
      gstCents: split.gstCents,
      paidBy: e.paidBy,
      crewMemberId: e.paidBy === "crew" ? (e.crewMemberId ?? null) : null,
      receiptFileId: null,
      reimbursedInPayRunId: null,
      enteredBy: e.enteredBy,
      mutationId: this.id(),
    };
    this.t.expenses.push(row);
    return row;
  }

  // ─── Budgets (set after the work, so the seed controls which stages trend over) ─

  stageLabourCents(stageId: Id): Cents {
    const ctx = {
      workspaceGstRegistered: this.t.workspace.gstRegistered,
      onCostBp: this.t.workspace.onCostBp,
    };
    return sum(
      (this.logsByStage.get(stageId) ?? [])
        .filter((l) => l.deletedAt === null)
        .map((l) => labourCost(l.amountCents, this.crewRow(l.crewMemberId), ctx)),
    );
  }

  measuredQty(stageId: Id): Hundredths {
    return this.measuredByStage.get(stageId) ?? 0;
  }

  /**
   * Budgets for stages without a fixed one: started stages from their actual (or forecast) labour and
   * materials × a factor in [lo, hi] basis points; not-started stages from the template shares of the
   * plan the started stages imply. Contract = (labour + materials budgets + other expenses) × markup.
   */
  finaliseBudgets(
    project: ProjectRow,
    o: {
      labourFactor: [number, number];
      materialsFactor: [number, number];
      markupBp: [number, number];
      contractCents?: Cents;
    },
  ): void {
    const stages = this.t.stages.filter((s) => s.projectId === project.id);
    const expenses = this.t.expenses.filter((e) => e.projectId === project.id);
    const materialsId = this.t.expenseCategories.find((c) => c.name === "Materials")!.id;
    let startedLabour = 0;
    let startedLabourShare = 0;
    let startedMaterials = 0;
    let startedMaterialsShare = 0;
    for (const st of stages) {
      const meta = this.stageMeta.get(st.id)!;
      if (st.status === "not_started") continue;
      if (st.unit !== null && st.budgetQty === null) {
        const measured = this.measuredQty(st.id);
        st.budgetQty = measured > 0 ? measured : this.rng.int(120, 420) * 100;
      }
      if (!meta.fixedLabour) {
        const actual = this.stageLabourCents(st.id);
        const pct = stagePercentBp({
          status: st.status,
          unit: st.unit,
          budgetQty: st.budgetQty,
          measuredQty: this.measuredQty(st.id),
          manualPctBp: st.manualPctBp,
        });
        const forecast = forecastLabour(st.status, pct, actual) ?? 0;
        const basis = Math.max(actual, forecast, 30_000);
        st.labourBudgetCents = roundTo(mulDivRound(basis, this.rng.int(...o.labourFactor), 10_000), 5_000);
      }
      if (!meta.fixedMaterials) {
        const materials = sum(
          expenses
            .filter((e) => e.stageId === st.id && e.categoryId === materialsId)
            .map((e) => e.amountExGstCents),
        );
        st.materialsBudgetCents =
          materials === 0
            ? 0
            : roundTo(mulDivRound(materials, this.rng.int(...o.materialsFactor), 10_000), 5_000);
      }
      startedLabour += st.labourBudgetCents;
      startedLabourShare += meta.labourShareBp;
      startedMaterials += st.materialsBudgetCents;
      startedMaterialsShare += meta.materialsShareBp;
    }
    const labourPlan = startedLabourShare > 0 ? mulDivRound(startedLabour, 10_000, startedLabourShare) : 0;
    const materialsPlan =
      startedMaterialsShare > 0 ? mulDivRound(startedMaterials, 10_000, startedMaterialsShare) : 0;
    for (const st of stages) {
      const meta = this.stageMeta.get(st.id)!;
      if (st.status !== "not_started") continue;
      if (st.unit !== null && st.budgetQty === null) st.budgetQty = this.rng.int(80, 300) * 100;
      if (!meta.fixedLabour)
        st.labourBudgetCents = roundTo(mulDivRound(labourPlan, meta.labourShareBp, 10_000), 5_000);
      if (!meta.fixedMaterials) {
        st.materialsBudgetCents = roundTo(mulDivRound(materialsPlan, meta.materialsShareBp, 10_000), 5_000);
      }
    }
    const other = sum(expenses.filter((e) => e.categoryId !== materialsId).map((e) => e.amountExGstCents));
    const cost = sum([
      ...stages.map((s) => s.labourBudgetCents),
      ...stages.map((s) => s.materialsBudgetCents),
      other,
    ]);
    project.contractValueCents =
      o.contractCents ?? roundTo(mulDivRound(cost, this.rng.int(...o.markupBp), 10_000), 10_000);
  }

  // ─── Pay runs and the ledger ──────────────────────────────────────────────

  /**
   * Approves one weekly pay run per period in [firstStart, lastStart] (Monday starts), approving on the
   * Monday after at 08:30. Logs and crew-paid expenses created after that instant stay open (late
   * entries). Pays every credit in full on the Wednesday after, except where `skipPayment` says no.
   */
  approveWeeks(o: {
    firstStart: LocalDate;
    lastStart: LocalDate;
    approvedBy: Id;
    exportAllBut: number;
    skipPayment: (crewId: Id, approvedOn: LocalDate) => boolean;
    advances: { crewId: Id; date: LocalDate; amountCents: Cents; note: string }[];
  }): void {
    const people: PayPerson[] = this.t.crewMembers.map((c) => ({
      id: c.id,
      type: c.type,
      gstRegistered: c.gstRegistered,
      floorHourlyCents: this.t.crewLevels.find((lv) => lv.id === c.levelId)?.floorRateCents ?? null,
    }));
    const byWeek = new Map<LocalDate, WorkLogRow[]>();
    const weekStarts = new Map<LocalDate, LocalDate>();
    const weekOf = (d: LocalDate) => {
      let w = weekStarts.get(d);
      if (w === undefined) weekStarts.set(d, (w = addDays(o.firstStart, Math.floor(daysBetween(o.firstStart, d) / 7) * 7)));
      return w;
    };
    for (const l of this.t.workLogs) {
      if (l.date < o.firstStart) continue;
      const k = weekOf(l.date);
      const bucket = byWeek.get(k);
      if (bucket) bucket.push(l);
      else byWeek.set(k, [l]);
    }
    const crewExpenses = this.t.expenses.filter((e) => e.paidBy === "crew");
    const expenseById = new Map(crewExpenses.map((e) => [e.id, e]));
    const ledgerByCrew = new Map<
      Id,
      { date: LocalDate; kind: "payrun_credit" | "advance" | "payment"; amountCents: Cents }[]
    >();
    const addLedger = (
      crewId: Id,
      date: LocalDate,
      kind: "payrun_credit" | "advance" | "payment",
      amountCents: Cents,
      extra: { method: PayoutMethod | null; note: string | null; payRunId: Id | null; at: Instant },
    ) => {
      this.t.ledgerEntries.push({
        ...this.base(extra.at),
        crewMemberId: crewId,
        date,
        kind,
        amountCents,
        method: extra.method,
        note: extra.note,
        payRunId: extra.payRunId,
      });
      const list = ledgerByCrew.get(crewId);
      if (list) list.push({ date, kind, amountCents });
      else ledgerByCrew.set(crewId, [{ date, kind, amountCents }]);
    };
    const weeks: LocalDate[] = [];
    for (let w = o.firstStart; w <= o.lastStart; w = addDays(w, 7)) weeks.push(w);
    weeks.forEach((start, index) => {
      const end = addDays(start, 6);
      const approvedOn = addDays(end, 1);
      const approvedAt = this.at(approvedOn, "08:30");
      for (const a of o.advances.filter((x) => x.date >= start && x.date <= end)) {
        addLedger(a.crewId, a.date, "advance", a.amountCents, {
          method: "cash",
          note: a.note,
          payRunId: null,
          at: this.at(a.date, "07:00"),
        });
      }
      const logs = (byWeek.get(start) ?? []).filter((l) => l.createdAt <= approvedAt && l.deletedAt === null);
      const reimbursements: PayReimbursement[] = crewExpenses
        .filter((e) => e.date >= start && e.date <= end && e.createdAt <= approvedAt)
        .map((e) => ({
          expenseId: e.id,
          crewMemberId: e.crewMemberId!,
          date: e.date,
          amountCents: receiptTotal(e),
          reimbursed: false,
        }));
      const run = {
        ...this.base(this.at(approvedOn, "07:45")),
        periodStart: start,
        periodEnd: end,
        status: (index < weeks.length - o.exportAllBut ? "exported" : "approved") as "exported" | "approved",
        approvedBy: o.approvedBy,
        approvedAt,
        exportedAt: null as Instant | null,
      };
      if (run.status === "exported") run.exportedAt = this.at(approvedOn, "09:10");
      run.updatedAt = run.exportedAt ?? approvedAt;
      this.t.payRuns.push(run);
      const pay = buildPayRun({ start, end }, people, logs.map(toPayLog), reimbursements);
      const logById = new Map(logs.map((l) => [l.id, l]));
      for (const person of pay) {
        for (const line of person.lines) {
          const log = logById.get(line.log.id)!;
          log.payRunId = run.id;
          this.t.payRunLines.push({
            ...this.base(approvedAt),
            payRunId: run.id,
            crewMemberId: person.crewMemberId,
            kind: "log",
            refId: log.id,
            snapshot: {
              kind: "log",
              date: log.date,
              projectId: log.projectId,
              stageId: log.stageId,
              basis: log.basis,
              unit: log.unit,
              quantity: log.quantity,
              hours: log.hours,
              multiplier: log.multiplier,
              rateCents: log.rateCents,
              label: line.label,
            },
            amountCents: log.amountCents,
          });
        }
        for (const r of person.reimbursements) {
          const e = expenseById.get(r.expenseId)!;
          e.reimbursedInPayRunId = run.id;
          this.t.payRunLines.push({
            ...this.base(approvedAt),
            payRunId: run.id,
            crewMemberId: person.crewMemberId,
            kind: "reimbursement",
            refId: e.id,
            snapshot: { kind: "reimbursement", date: e.date, projectId: e.projectId, supplier: e.supplier },
            amountCents: r.amountCents,
          });
        }
        if (person.totals.gstCents !== 0) {
          this.t.payRunLines.push({
            ...this.base(approvedAt),
            payRunId: run.id,
            crewMemberId: person.crewMemberId,
            kind: "gst",
            refId: null,
            snapshot: { kind: "gst", subtotalCents: person.totals.subtotalCents },
            amountCents: person.totals.gstCents,
          });
        }
        addLedger(person.crewMemberId, approvedOn, "payrun_credit", person.totals.totalCents, {
          method: null,
          note: null,
          payRunId: run.id,
          at: approvedAt,
        });
        if (o.skipPayment(person.crewMemberId, approvedOn)) continue;
        const paidOn = addDays(approvedOn, 2);
        const balance = ledgerBalance(ledgerByCrew.get(person.crewMemberId)!);
        if (balance > 0) {
          addLedger(person.crewMemberId, paidOn, "payment", balance, {
            method: "bank_transfer",
            note: null,
            payRunId: null,
            at: this.at(paidOn, "10:00"),
          });
        }
      }
    });
    for (const a of o.advances.filter((x) => x.date > addDays(o.lastStart, 6))) {
      addLedger(a.crewId, a.date, "advance", a.amountCents, {
        method: "cash",
        note: a.note,
        payRunId: null,
        at: this.at(a.date, "07:00"),
      });
    }
  }
}

/** Round cents to a whole step (e.g. $50 budgets), half away from zero, via the domain. */
export function roundTo(cents: Cents, step: Cents): Cents {
  return mulDivRound(cents, 1, step) * step;
}

export function toPayLog(l: WorkLogRow): PayLog {
  return {
    id: l.id,
    crewMemberId: l.crewMemberId,
    date: l.date,
    projectId: l.projectId,
    stageId: l.stageId,
    basis: l.basis,
    source: l.source,
    quantity: l.quantity,
    hours: l.hours,
    rateCents: l.rateCents,
    amountCents: l.amountCents,
    missingRate: l.missingRate,
    locked: l.payRunId !== null,
  };
}
