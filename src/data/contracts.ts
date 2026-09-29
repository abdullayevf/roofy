/**
 * Data contracts: what every screen reads and writes, independent of the implementation
 * (the fake layer in Phase 2, Postgres services from Phase 3).
 *
 * Units: money = integer cents (`Cents`), quantities/hours/days = integer hundredths
 * (`Hundredths`), percentages = basis points (`BasisPoints`), work dates = `LocalDate` in the
 * workspace timezone, instants = ISO-8601 strings. Nothing here is formatted — the UI formats
 * with `src/lib/format.ts`.
 *
 * Role shaping: every read a foreman can reach returns a union discriminated by
 * `view: "manager" | "foreman"`. Foreman types are declared without money fields and with keys
 * that never match `MONEY_KEY` in `./dto` (e.g. `quantityDone`, `plannedQuantity`). Accountants get
 * the manager view with `access.canEdit === false`. Reads a foreman can never reach return the
 * manager type only and throw `DataError("forbidden")` for a foreman.
 */
import type { PersonTotals } from "@/domain/gst";
import type { LedgerKind } from "@/domain/ledger";
import type { LineLabel } from "@/domain/payrun";
import type { PayFrequency, PayPeriod } from "@/domain/periods";
import type { StageStatus } from "@/domain/progress";
import type { PauseReason } from "@/domain/segments";
import type { NoWorkReason } from "@/domain/attendance";
import type { Shares } from "@/domain/split";
import type {
  Basis,
  BasisPoints,
  Cents,
  Hundredths,
  LocalDate,
  LogSource,
  RateBasis,
  Unit,
  WorkerType,
} from "@/domain/types";

export type {
  Basis,
  BasisPoints,
  Cents,
  Hundredths,
  LedgerKind,
  LineLabel,
  LocalDate,
  LogSource,
  NoWorkReason,
  PauseReason,
  PayFrequency,
  PayPeriod,
  RateBasis,
  Shares,
  StageStatus,
  Unit,
  WorkerType,
};

// ─── Primitives ─────────────────────────────────────────────────────────────

export type Id = string;
/** ISO-8601 instant, e.g. "2026-09-27T21:00:00.000Z". */
export type Instant = string;

export type Role = "owner" | "manager" | "foreman" | "accountant";

/** Who is asking. Every service method takes it first. */
export interface Actor {
  userId: Id;
  workspaceId: Id;
  role: Role;
  name: string;
}

export type ProjectStatus = "quoted" | "active" | "on_hold" | "complete" | "closed";
export type JobType = "metal_reroof" | "tile_reroof" | "restoration" | "repair" | "new_build";
export type PayRunStatus = "draft" | "approved" | "exported";
export type PaidBy = "company_card" | "cash" | "crew";
export type PayoutMethod = "bank_transfer" | "cash" | "other";
/** Home and alerts: `over` = red (over budget / blocking), `watch` = amber. */
export type Severity = "over" | "watch";
/** Manual % for no-unit stages: 0 / 25 / 50 / 75 / 100 %. */
export type ManualPctBp = 0 | 2500 | 5000 | 7500 | 10000;
/** Grid basis for one person on a crew-day. Per-unit workers get `time_only` (hours, $0). */
export type GridBasis = "hourly" | "daily" | "time_only";
/** A view is either full (manager/owner/accountant) or field (foreman). */
export type View = "manager" | "foreman";

export interface DateRange {
  /** Inclusive. */
  from: LocalDate;
  /** Inclusive. */
  to: LocalDate;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/** `unavailable` = the data layer couldn't answer (the route's `error.tsx` offers "Try again"). */
export type DataErrorCode = "not_found" | "forbidden" | "invalid" | "conflict" | "unavailable";

export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * The one error type services throw. Messages are plain sentences safe to show to the actor
 * (never money for a foreman), e.g. "You don't have access to this. Ask your manager."
 */
export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly issues: readonly FieldIssue[];

  constructor(code: DataErrorCode, message: string, issues: readonly FieldIssue[] = []) {
    super(message);
    this.name = "DataError";
    this.code = code;
    this.issues = issues;
  }
}

export const isDataError = (e: unknown): e is DataError => e instanceof DataError;

// ─── Access (what a screen may offer) ───────────────────────────────────────

/** Manager-view capabilities. Accountant: everything false except `canExport`. */
export interface Access {
  role: Exclude<Role, "foreman">;
  /** Projects, stages, crew, rates, logs, expenses, settings. */
  canEdit: boolean;
  /** Approve/reopen pay runs, record payouts, waive a missing rate. */
  canApprove: boolean;
  canExport: boolean;
  /** Members, roles, billing, workspace export (Owner). */
  canAdminister: boolean;
}

/** Foreman capabilities: field entries on assigned projects only; never Done. */
export interface FieldAccess {
  role: "foreman";
  canLog: boolean;
  canPause: boolean;
  canMarkDone: false;
}

// ─── Shared small shapes ────────────────────────────────────────────────────

export interface Named {
  id: Id;
  name: string;
}

export interface ClientRef {
  id: Id;
  name: string;
}

/** A stage chip: name + status (+ why it's paused). */
export interface StageChip {
  stageId: Id;
  name: string;
  status: StageStatus;
  pauseReason: PauseReason | null;
}

/** Pay rules §12 alert, with its Home severity. `byCents` = actual − budget or forecast − budget. */
export interface BudgetAlertDto {
  level: "over" | "trending";
  severity: Severity;
  byCents: Cents;
}

/** TapeBar data for the manager view: `overMarkerBp` = forecast ÷ budget, when a forecast exists. */
export interface TapeManager {
  pctBp: BasisPoints;
  overMarkerBp: BasisPoints | null;
}

/** TapeBar data for the foreman view: progress only. */
export interface TapeForeman {
  pctBp: BasisPoints;
}

export interface PauseInfo {
  reason: PauseReason;
  note: string | null;
  since: LocalDate;
  /** Working days paused so far (pay rules §13); > 5 → Home alert. */
  workingDays: number;
}

export interface FileRef {
  id: Id;
  name: string;
  mime: string;
  bytes: number;
  kind: "photo" | "pdf" | "other";
  uploadedAt: Instant;
}

// ─── Work logs ──────────────────────────────────────────────────────────────

/** A work log line, foreman-safe: who, where, what, how long — no rate, no amount. */
export interface LogRowForeman {
  id: Id;
  date: LocalDate;
  crewMemberId: Id;
  crewName: string;
  projectId: Id;
  projectName: string;
  stageId: Id;
  stageName: string;
  basis: Basis;
  unit: Unit | null;
  /** Days for daily, hours for hourly, units for per-unit, 0 for time-only and lump sum. */
  quantity: Hundredths;
  hours: Hundredths;
  source: LogSource;
  enteredByName: string;
}

export interface LogRowManager extends LogRowForeman {
  multiplier: Hundredths | null;
  rateCents: Cents | null;
  amountCents: Cents;
  /** Job cost of this line (pay rules §11: on-cost for employees, GST if applicable). */
  labourCostCents: Cents;
  missingRate: boolean;
  /** Set when the log belongs to an approved pay run (locked). */
  payRunId: Id | null;
  adjustsLogId: Id | null;
}

export type LogList =
  | { view: "manager"; access: Access; rows: LogRowManager[] }
  | { view: "foreman"; access: FieldAccess; rows: LogRowForeman[] };

// ─── Progress ───────────────────────────────────────────────────────────────

export interface ProgressRowForeman {
  id: Id;
  stageId: Id;
  date: LocalDate;
  quantity: Hundredths;
  unit: Unit;
  enteredByName: string;
  hasPhoto: boolean;
  split: { crewMemberId: Id; name: string; shareBp: BasisPoints; quantity: Hundredths }[];
}

export interface ProgressRowManager extends Omit<ProgressRowForeman, "split"> {
  split: {
    crewMemberId: Id;
    name: string;
    shareBp: BasisPoints;
    quantity: Hundredths;
    rateCents: Cents | null;
    amountCents: Cents;
    missingRate: boolean;
    logId: Id;
  }[];
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export interface ExpenseRowForeman {
  id: Id;
  date: LocalDate;
  supplier: string;
  projectId: Id;
  projectName: string;
  stageId: Id | null;
  stageName: string | null;
  category: Named;
  paidBy: PaidBy;
  crewMemberId: Id | null;
  crewName: string | null;
  hasReceipt: boolean;
}

export interface ExpenseRowManager extends ExpenseRowForeman {
  amountExGstCents: Cents;
  gstCents: Cents;
  /** What was paid (ex GST + GST). */
  totalCents: Cents;
  /** Job cost (pay rules §11): ex GST, or incl. GST when the workspace isn't GST registered. */
  costCents: Cents;
  /** Crew-paid only: which pay run reimburses it. */
  reimbursement: { payRunId: Id | null; status: "waiting" | "in_draft" | "reimbursed" } | null;
}

export type ExpenseList =
  | {
      view: "manager";
      access: Access;
      rows: ExpenseRowManager[];
      totals: { exGstCents: Cents; gstCents: Cents };
    }
  | { view: "foreman"; access: FieldAccess; rows: ExpenseRowForeman[] };

export type ExpenseDetail =
  | {
      view: "manager";
      access: Access;
      expense: ExpenseRowManager;
      receipt: FileRef | null;
      /** Set when saving an edit would adjust a later pay run (flows "Expense edit"). */
      inApprovedPayRun: boolean;
      historyHref: string;
    }
  | { view: "foreman"; access: FieldAccess; expense: ExpenseRowForeman; receipt: FileRef | null };

// ─── Workspace ──────────────────────────────────────────────────────────────

export interface WorkspaceSettings {
  id: Id;
  name: string;
  abn: string;
  gstRegistered: boolean;
  timezone: string;
  payFrequency: PayFrequency;
  /** 0 = Sunday … 6 = Saturday. */
  payWeekStart: number;
  /** A date on which a pay period starts (anchors fortnightly periods). */
  payAnchor: LocalDate;
  workingDays: number[];
  standardDayHours: Hundredths;
  onCostBp: BasisPoints;
}

/** What a foreman's phone needs: no pay settings, no on-cost. */
export interface WorkspaceBasics {
  id: Id;
  name: string;
  timezone: string;
  workingDays: number[];
  standardDayHours: Hundredths;
}

export type WorkspaceView =
  | { view: "manager"; access: Access; settings: WorkspaceSettings; ownerTwoFactor: boolean }
  | { view: "foreman"; access: FieldAccess; workspace: WorkspaceBasics };

export interface CrewLevel {
  id: Id;
  name: string;
  floorRateCents: Cents;
  position: number;
  crewCount: number;
}

export interface ExpenseCategory {
  id: Id;
  name: string;
  position: number;
}

export interface StageTemplateItem {
  name: string;
  position: number;
  defaultUnit: Unit | null;
  labourShareBp: BasisPoints;
  materialsShareBp: BasisPoints;
}

export interface StageTemplate {
  id: Id;
  jobType: JobType;
  name: string;
  items: StageTemplateItem[];
}

export interface Member {
  id: Id;
  userId: Id;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  /** Foreman only: assigned projects. */
  projectIds: Id[];
}

// ─── Projects and stages ────────────────────────────────────────────────────

export interface ProjectRowForeman {
  id: Id;
  name: string;
  client: ClientRef;
  siteAddress: string;
  jobType: JobType;
  status: ProjectStatus;
  pctBp: BasisPoints;
  currentStages: StageChip[];
  daysSinceLastLog: number | null;
}

export interface ProjectRowManager extends ProjectRowForeman {
  contractCents: Cents;
  labourActualCents: Cents;
  labourBudgetCents: Cents;
  forecastMarginCents: Cents;
  /** Worst stage alert on the job. */
  alert: BudgetAlertDto | null;
}

export type ProjectList =
  | { view: "manager"; access: Access; rows: ProjectRowManager[] }
  | { view: "foreman"; access: FieldAccess; rows: ProjectRowForeman[] };

export interface StageRowForeman {
  id: Id;
  name: string;
  position: number;
  status: StageStatus;
  unit: Unit | null;
  quantityDone: Hundredths;
  plannedQuantity: Hundredths | null;
  pctBp: BasisPoints;
  tape: TapeForeman;
  pause: PauseInfo | null;
  completedOn: LocalDate | null;
  /** Has a lump sum set (the amount is manager-only). */
  lumpSumStage: boolean;
}

export interface StageRowManager extends Omit<StageRowForeman, "tape"> {
  tape: TapeManager;
  labourBudgetCents: Cents;
  labourActualCents: Cents;
  forecastLabourCents: Cents | null;
  materialsBudgetCents: Cents;
  lumpSumCents: Cents | null;
  manualPctBp: BasisPoints | null;
  alert: BudgetAlertDto | null;
}

export interface CrewWeekForeman {
  crewMemberId: Id;
  name: string;
  /** Distinct working days logged this week. */
  days: number;
  hours: Hundredths;
}

export interface CrewWeekManager extends CrewWeekForeman {
  labourCostCents: Cents;
}

export interface ProjectDetailManager {
  view: "manager";
  access: Access;
  id: Id;
  name: string;
  client: ClientRef & { phone: string | null; email: string | null };
  siteAddress: string;
  jobType: JobType;
  status: ProjectStatus;
  startDate: LocalDate | null;
  targetFinish: LocalDate | null;
  pctBp: BasisPoints;
  contractCents: Cents;
  labour: { actualCents: Cents; budgetCents: Cents; expectedCents: Cents };
  materials: { actualCents: Cents; budgetCents: Cents };
  /** All expense cost to date (materials + other categories). */
  expensesCents: Cents;
  margins: { earnedValueCents: Cents; marginToDateCents: Cents; forecastMarginCents: Cents };
  alert: BudgetAlertDto | null;
  stages: StageRowManager[];
  crewThisWeek: CrewWeekManager[];
  recentLogs: LogRowManager[];
  expenses: ExpenseRowManager[];
  files: FileRef[];
}

export interface ProjectDetailForeman {
  view: "foreman";
  access: FieldAccess;
  id: Id;
  name: string;
  client: ClientRef;
  siteAddress: string;
  jobType: JobType;
  status: ProjectStatus;
  pctBp: BasisPoints;
  stages: StageRowForeman[];
  crewThisWeek: CrewWeekForeman[];
  recentLogs: LogRowForeman[];
  expenses: ExpenseRowForeman[];
  files: FileRef[];
}

export type ProjectDetail = ProjectDetailManager | ProjectDetailForeman;

export interface SegmentDto {
  start: LocalDate;
  /** Exclusive; null = open. */
  end: LocalDate | null;
  pauseReason: PauseReason | null;
  pauseNote: string | null;
}

export interface PausePeriodDto {
  start: LocalDate;
  /** Exclusive. */
  end: LocalDate;
  reason: PauseReason;
  ongoing: boolean;
  workingDays: number;
}

export interface StageActions {
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canMarkDone: boolean;
  canReopen: boolean;
  canSetManualPct: boolean;
}

interface StageDetailBase {
  id: Id;
  projectId: Id;
  projectName: string;
  name: string;
  position: number;
  status: StageStatus;
  unit: Unit | null;
  quantityDone: Hundredths;
  plannedQuantity: Hundredths | null;
  pctBp: BasisPoints;
  completedOn: LocalDate | null;
  completionNote: string | null;
  segments: SegmentDto[];
  pauses: PausePeriodDto[];
  lostDays: Record<PauseReason, number>;
  realWorkingDays: number;
  pausedTooLong: boolean;
  actions: StageActions;
}

export interface StageDetailManager extends StageDetailBase {
  view: "manager";
  access: Access;
  tape: TapeManager;
  labourBudgetCents: Cents;
  materialsBudgetCents: Cents;
  lumpSumCents: Cents | null;
  manualPctBp: BasisPoints | null;
  labourActualCents: Cents;
  forecastLabourCents: Cents | null;
  alert: BudgetAlertDto | null;
  /** The arithmetic behind the forecast (flows "Find the job losing money", tap 2). */
  forecastWorking: { actualCents: Cents; pctBp: BasisPoints; forecastCents: Cents | null } | null;
  progress: ProgressRowManager[];
  logs: LogRowManager[];
  lumpSumShares: { crewMemberId: Id; name: string; shareBp: BasisPoints; amountCents: Cents }[];
}

export interface StageDetailForeman extends StageDetailBase {
  view: "foreman";
  access: FieldAccess;
  tape: TapeForeman;
  progress: ProgressRowForeman[];
  logs: LogRowForeman[];
}

export type StageDetail = StageDetailManager | StageDetailForeman;

/** Stage Done screen (manager only): proposed equal lump-sum split among everyone who logged. */
export interface DoneProposal {
  stageId: Id;
  stageName: string;
  projectId: Id;
  projectName: string;
  completedOn: LocalDate;
  lumpSumCents: Cents | null;
  crew: { crewMemberId: Id; name: string; shareBp: BasisPoints; amountCents: Cents }[];
}

/** A stage as proposed for a new job (from the last same-type job, else the template). */
export interface StageDraft {
  name: string;
  position: number;
  unit: Unit | null;
  plannedQuantity: Hundredths | null;
  labourBudgetCents: Cents;
  materialsBudgetCents: Cents;
  lumpSumCents: Cents | null;
}

export interface StageProposal {
  jobType: JobType;
  source: { kind: "last_job"; projectId: Id; projectName: string } | { kind: "template"; templateId: Id };
  stages: StageDraft[];
}

export interface Client {
  id: Id;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  projectCount: number;
}

// ─── Crew ───────────────────────────────────────────────────────────────────

export interface CrewRowForeman {
  id: Id;
  name: string;
  type: WorkerType;
  active: boolean;
  defaultBasis: RateBasis;
  defaultUnit: Unit | null;
}

export interface CrewRowManager extends CrewRowForeman {
  level: Named | null;
  gstRegistered: boolean;
  balanceCents: Cents;
  unpaidTooLong: boolean;
  lastLogDate: LocalDate | null;
}

export type CrewList =
  | { view: "manager"; access: Access; rows: CrewRowManager[] }
  | { view: "foreman"; access: FieldAccess; rows: CrewRowForeman[] };

export interface RateDto {
  id: Id;
  basis: RateBasis;
  unit: Unit | null;
  amountCents: Cents;
  effectiveFrom: LocalDate;
  project: Named | null;
  /** The rate that applies today for its (basis, unit, project). */
  current: boolean;
}

export interface LedgerRow {
  id: Id;
  date: LocalDate;
  kind: LedgerKind;
  amountCents: Cents;
  method: PayoutMethod | null;
  note: string | null;
  payRunId: Id | null;
  balanceAfterCents: Cents;
}

export interface StatementRef {
  payRunId: Id;
  period: PayPeriod;
  status: PayRunStatus;
  totalCents: Cents;
  /** Share is only offered once the run is approved. */
  shareable: boolean;
}

export interface CrewDetail {
  view: "manager";
  access: Access;
  id: Id;
  name: string;
  phone: string | null;
  type: WorkerType;
  level: (Named & { floorRateCents: Cents }) | null;
  abn: string | null;
  gstRegistered: boolean;
  activeFrom: LocalDate;
  activeTo: LocalDate | null;
  defaultBasis: RateBasis;
  defaultUnit: Unit | null;
  rates: RateDto[];
  recentLogs: LogRowManager[];
  balanceCents: Cents;
  oldestUnpaidDate: LocalDate | null;
  unpaidTooLong: boolean;
  ledger: LedgerRow[];
  statements: StatementRef[];
  /** Last four weeks (pay rules §14). */
  utilisation: { availableDays: number; workedDays: number; bp: BasisPoints | null };
}

// ─── Logging (crew-day grid) ────────────────────────────────────────────────

export interface StagePick {
  id: Id;
  name: string;
  status: StageStatus;
  unit: Unit | null;
  lumpSumStage: boolean;
}

export interface ProjectPick {
  id: Id;
  name: string;
  stages: StagePick[];
}

export interface SameAsYesterday {
  /** The previous logged day copied from. */
  fromDate: LocalDate;
  projectId: Id;
  stageId: Id;
  crewMemberIds: Id[];
}

export interface GridCrewForeman {
  crewMemberId: Id;
  name: string;
  type: WorkerType;
  basis: GridBasis;
  unit: Unit | null;
  /** Default hours for a full day (workspace standard). */
  standardHours: Hundredths;
  /** Per-unit worker on this stage: "Paid from progress, not this grid." */
  timeOnly: boolean;
  loggedOnDate: boolean;
  noWorkOnDate: NoWorkReason | null;
}

export interface GridCrewManager extends GridCrewForeman {
  rateCents: Cents | null;
  /** "No rate" note on the chip; saving still works (flows "Log a full crew-day"). */
  missingRate: boolean;
}

interface CrewDayDefaultsBase {
  date: LocalDate;
  projects: ProjectPick[];
  projectId: Id | null;
  stageId: Id | null;
  latestStages: { projectId: Id; stageId: Id; label: string }[];
  /** Null → the button reads "No day to copy yet". */
  sameAsYesterday: SameAsYesterday | null;
}

export type CrewDayDefaults =
  | (CrewDayDefaultsBase & { view: "manager"; access: Access; crew: GridCrewManager[] })
  | (CrewDayDefaultsBase & { view: "foreman"; access: FieldAccess; crew: GridCrewForeman[] });

export interface ProgressDefaults {
  view: View;
  date: LocalDate;
  /** Recent-stage chips: unit stages you logged most recently. (Not "recentStages": it contains "cents".) */
  latestStages: {
    projectId: Id;
    stageId: Id;
    label: string;
    unit: Unit;
    quantityDone: Hundredths;
    plannedQuantity: Hundredths | null;
  }[];
  projects: ProjectPick[];
  crew: CrewRowForeman[];
}

export interface NoWorkRow {
  id: Id;
  crewMemberId: Id;
  name: string;
  date: LocalDate;
  reason: NoWorkReason;
  note: string | null;
}

/**
 * Business outcomes that are applied with a flag, never rejected (architecture §7):
 * `paused_stage` — dated on a day the stage was Paused/Done; `late_entry` — dated inside an approved
 * pay run's period (lands in the next draft, "Late entry for <date>"); `possible_duplicate` — same
 * person, date, stage and basis as another entry's log; `missing_rate` — saved at $0.00 with no rate;
 * `auto_started` — the entry started a Not started stage from its date.
 */
export type EntryFlag =
  "paused_stage" | "late_entry" | "possible_duplicate" | "missing_rate" | "auto_started";

/** Flag order in an `EntryResult`. */
export const ENTRY_FLAGS: readonly EntryFlag[] = [
  "paused_stage",
  "late_entry",
  "possible_duplicate",
  "missing_rate",
  "auto_started",
];

/**
 * Flags that are pay facts, never shown to a foreman: a missing rate, and whether a pay run for the
 * day is already approved (product spec §3: a foreman sees no rate, earning or pay run).
 */
export const FOREMAN_HIDDEN_FLAGS: readonly EntryFlag[] = ["missing_rate", "late_entry"];

/** Result of a field entry: ids created and any flags. Money-free for every role. */
export interface EntryResult {
  ids: Id[];
  flags: EntryFlag[];
}

// ─── Pay runs, statements, ledger ───────────────────────────────────────────

export type PayFlagKind =
  | "missing_rate"
  | "owner_2fa_off"
  | "below_floor"
  | "double_pay"
  | "paused_stage"
  | "gap"
  | "possible_duplicate"
  | "no_hours";

/**
 * A pay-run flag as structured facts; the UI writes the sentence with `src/lib/format.ts`
 * (e.g. missing rate → "No lm rate for Jake — paid $0.00 until this is fixed.").
 */
export interface PayFlag {
  kind: PayFlagKind;
  /** Missing rate and Owner 2FA off block approval. */
  blocking: boolean;
  crewMemberId: Id | null;
  crewName: string | null;
  /** The day (double pay, paused stage, duplicate) or days (gaps) concerned. */
  dates: LocalDate[];
  projectName: string | null;
  stageName: string | null;
  /** Missing rate: the basis and unit with no rate. */
  basis: RateBasis | null;
  unit: Unit | null;
  logIds: Id[];
  href: string | null;
  /** Below floor only (pay rules §10). */
  floor: { floorRateCents: Cents; effectiveHourlyCents: Cents; shortfallCents: Cents } | null;
}

export interface PayLineDto {
  logId: Id;
  date: LocalDate;
  projectId: Id;
  projectName: string;
  stageId: Id;
  stageName: string;
  basis: Basis;
  unit: Unit | null;
  quantity: Hundredths;
  hours: Hundredths;
  multiplier: Hundredths | null;
  rateCents: Cents | null;
  amountCents: Cents;
  /** normal | late ("Late entry for <date>") | adjustment ("Adjustment for <date>"). */
  label: LineLabel;
  missingRate: boolean;
}

export interface ReimbursementDto {
  expenseId: Id;
  date: LocalDate;
  supplier: string;
  projectName: string;
  /** GST-inclusive: what the person paid. */
  amountCents: Cents;
}

export interface PayPersonGroup {
  crewMemberId: Id;
  name: string;
  type: WorkerType;
  abn: string | null;
  gstRegistered: boolean;
  lines: PayLineDto[];
  reimbursements: ReimbursementDto[];
  totals: PersonTotals;
  hours: Hundredths;
  floor: {
    floorRateCents: Cents;
    effectiveHourlyCents: Cents | null;
    below: boolean;
    shortfallCents: Cents;
  } | null;
  missingRate: boolean;
}

export interface PayRunTotals {
  employeesCents: Cents;
  contractorsCents: Cents;
  gstCents: Cents;
  reimbursementsCents: Cents;
  totalCents: Cents;
}

export interface PayRunListItem {
  id: Id;
  period: PayPeriod;
  status: PayRunStatus;
  totalCents: Cents;
  peopleCount: number;
  flagCount: number;
  blocking: boolean;
  approvedAt: Instant | null;
}

export interface PayRunReview {
  view: "manager";
  access: Access;
  id: Id;
  period: PayPeriod;
  status: PayRunStatus;
  approvedAt: Instant | null;
  approvedByName: string | null;
  exportedAt: Instant | null;
  /** Most severe first; blocking before warnings. */
  flags: PayFlag[];
  people: PayPersonGroup[];
  totals: PayRunTotals;
  canApprove: boolean;
  /** Why Approve is disabled; the UI words it ("Fix the missing rate before you approve."). */
  blockedBy: ("missing_rate" | "owner_2fa_off")[];
  canReopen: boolean;
}

export interface Statement {
  payRunId: Id;
  business: { name: string; abn: string };
  person: { id: Id; name: string; type: WorkerType; abn: string | null };
  period: PayPeriod;
  lines: PayLineDto[];
  reimbursements: ReimbursementDto[];
  totals: PersonTotals;
  payouts: {
    date: LocalDate;
    kind: Exclude<LedgerKind, "payrun_credit">;
    amountCents: Cents;
    method: PayoutMethod | null;
  }[];
  balanceAfterCents: Cents;
  /** Contractors get the footer "Statement only — not a tax invoice. …" (pay rules §16), added by the UI. */
  contractorFooter: boolean;
}

export interface StatementShare {
  token: string;
  path: string;
  expiresAt: Instant;
}

export interface BalanceRow {
  crewMemberId: Id;
  name: string;
  type: WorkerType;
  balanceCents: Cents;
  oldestUnpaidDate: LocalDate | null;
  unpaidTooLong: boolean;
}

// ─── Home ───────────────────────────────────────────────────────────────────

interface AttentionBase {
  id: string;
  severity: Severity;
  href: string;
}

/**
 * A Home "Needs attention" row as structured facts, most severe first. The UI writes the sentence
 * with `src/lib/format.ts`, e.g. trending_over → "Smith job is trending $775 over on sheet install."
 * Severity: over_budget is `over` (red); the rest are `watch` (amber). Order: product spec §5.9.
 */
export type AttentionItem =
  | (AttentionBase & {
      kind: "over_budget" | "trending_over";
      projectId: Id;
      projectName: string;
      stageId: Id;
      stageName: string;
      byCents: Cents;
    })
  | (AttentionBase & {
      kind: "paused_too_long";
      projectId: Id;
      projectName: string;
      stageId: Id;
      stageName: string;
      reason: PauseReason;
      since: LocalDate;
      workingDays: number;
    })
  | (AttentionBase & {
      kind: "logging_gaps";
      period: PayPeriod;
      gaps: { crewMemberId: Id; name: string; dates: LocalDate[] }[];
    })
  | (AttentionBase & {
      kind: "unpaid_too_long";
      crewMemberId: Id;
      name: string;
      balanceCents: Cents;
      since: LocalDate;
    })
  | (AttentionBase & {
      kind: "below_floor";
      crewMemberId: Id;
      name: string;
      payRunId: Id;
      shortfallCents: Cents;
    })
  | (AttentionBase & { kind: "outbox_attention"; count: number });

export type AttentionKind = AttentionItem["kind"];

export interface ActiveJobRow {
  projectId: Id;
  name: string;
  currentStages: StageChip[];
  pctBp: BasisPoints;
  labourActualCents: Cents;
  labourBudgetCents: Cents;
  forecastMarginCents: Cents;
  daysSinceLastLog: number | null;
  alert: BudgetAlertDto | null;
  href: string;
}

export interface LastWeekFigures {
  period: PayPeriod;
  labourCostCents: Cents;
  hours: Hundredths;
  /** Person-days with at least one log. */
  crewDays: number;
  installed: { unit: Unit; quantity: Hundredths }[];
  expensesCents: Cents;
  utilisationBp: BasisPoints | null;
  gaps: number;
}

export interface PayPeriodFigures {
  /** The draft to review (last week's on a Monday; see seed meta). */
  payRunId: Id;
  period: PayPeriod;
  status: PayRunStatus;
  draftTotalCents: Cents;
  employeesCents: Cents;
  contractorsCents: Cents;
  outstandingBalancesCents: Cents;
  flagCount: number;
  blocking: boolean;
  href: string;
}

export interface HomeManager {
  view: "manager";
  access: Access;
  today: LocalDate;
  /** Max 7, most severe first. Outbox items are added on the device. */
  needsAttention: AttentionItem[];
  activeJobs: ActiveJobRow[];
  lastWeek: LastWeekFigures;
  payPeriod: PayPeriodFigures | null;
}

export interface ForemanJobRow {
  projectId: Id;
  name: string;
  siteAddress: string;
  currentStages: StageChip[];
  pctBp: BasisPoints;
  loggedToday: boolean;
  daysSinceLastLog: number | null;
  href: string;
}

/** Foreman home. Outbox status is device-local (read on the phone), so it isn't here. */
export interface HomeForeman {
  view: "foreman";
  access: FieldAccess;
  today: LocalDate;
  jobs: ForemanJobRow[];
  logToday: { href: string; projectId: Id | null };
}

export type HomeView = HomeManager | HomeForeman;

// ─── Reports ────────────────────────────────────────────────────────────────

export interface JobProfitRow {
  projectId: Id;
  name: string;
  jobType: JobType;
  status: ProjectStatus;
  contractCents: Cents;
  pctBp: BasisPoints;
  labourCents: Cents;
  expensesCents: Cents;
  marginToDateCents: Cents;
  forecastMarginCents: Cents;
  /** forecast margin ÷ contract. */
  marginBp: BasisPoints | null;
  href: string;
}

export interface CrewReportRow {
  crewMemberId: Id;
  name: string;
  type: WorkerType;
  days: number;
  hours: Hundredths;
  units: { unit: Unit; quantity: Hundredths }[];
  earningsCents: Cents;
  /** Labour cost per unit by stage name (e.g. "Sheet install" → cents per m²). */
  costPerUnit: { stageName: string; unit: Unit; centsPerUnit: Cents }[];
  jobs: number;
  utilisationBp: BasisPoints | null;
}

export interface ProductivityRow {
  /** "YYYY-MM". */
  month: string;
  stageName: string;
  jobType: JobType;
  unit: Unit;
  quantity: Hundredths;
  crewDays: number;
  /** Units per crew-day, in hundredths. */
  perCrewDay: Hundredths;
}

export interface PauseReportRow {
  month: string;
  projectId: Id;
  projectName: string;
  stageName: string;
  reason: PauseReason;
  workingDays: number;
}

export interface PayHistoryRow extends PayRunTotals {
  payRunId: Id;
  period: PayPeriod;
  status: PayRunStatus;
}

export interface Report<Row> {
  view: "manager";
  access: Access;
  range: DateRange;
  rows: Row[];
}

// ─── Sync (field entries through the outbox, architecture §7) ───────────────

export type MutationType = "crew_day" | "progress" | "no_work" | "stage_pause" | "stage_resume" | "expense";

export const MUTATION_TYPES: readonly MutationType[] = [
  "crew_day",
  "progress",
  "no_work",
  "stage_pause",
  "stage_resume",
  "expense",
];

/** Architecture §7: a push carries at most this many mutations. */
export const MAX_PUSH_BATCH = 25;

export interface MutationPayloads {
  crew_day: CrewDayInput;
  progress: ProgressInput;
  no_work: NoWorkInput;
  stage_pause: StagePauseInput;
  stage_resume: StageResumeInput;
  expense: ExpenseInput;
}

export type MutationEnvelope = {
  [T in MutationType]: {
    /** UUIDv7 created on the phone; the idempotency key. */
    id: Id;
    type: T;
    schemaVersion: 1;
    appVersion: string;
    createdAt: Instant;
    payload: MutationPayloads[T];
  };
}[MutationType];

/** At most 25 mutations (`MAX_PUSH_BATCH`), in creation order; applied in that order. */
export interface PushRequest {
  mutations: MutationEnvelope[];
}

/**
 * Per mutation: `applied` (also on a repeat id — the stored result, nothing applied twice),
 * `rejected` (can't be saved: no permission, gone, invalid — the message says how to fix it; not
 * stored, so an edited resend with the same id is applied fresh) or `retry` (try again later).
 */
export type PushResult =
  | { id: Id; status: "applied"; result: EntryResult }
  | { id: Id; status: "rejected"; code: DataErrorCode; message: string }
  | { id: Id; status: "retry" };

export interface PushResponse {
  results: PushResult[];
}

/** Reference cache for pickers without signal. No rates for anyone (foreman-safe by construction). */
export interface Snapshot {
  takenAt: Instant;
  today: LocalDate;
  workspace: WorkspaceBasics;
  projects: (ProjectPick & { status: ProjectStatus })[];
  crew: CrewRowForeman[];
  categories: ExpenseCategory[];
}

// ─── Outbox (device-local from Phase 5; forced by `?demo=` in the prototype) ─

export type OutboxState = "waiting" | "sending" | "sent" | "needs_attention";

/**
 * A queued field entry as the phone keeps it: the envelope's fields, with the payload as `input`
 * (the key "payload" would read as money to the foreman scan in `./dto`).
 */
export type OutboxEntry = {
  [T in MutationType]: { id: Id; type: T; createdAt: Instant; input: MutationPayloads[T] };
}[MutationType];

/**
 * One queued field entry as the outbox screen and badge show it. "Edit & resend" pre-fills the
 * original screen from `entry.input`. The demo outbox never holds an expense, so it is money-free.
 */
export interface OutboxItem {
  entry: OutboxEntry;
  state: OutboxState;
  date: LocalDate;
  projectName: string | null;
  stageName: string | null;
  crewNames: string[];
  /** Needs attention: the server's own rejection, shown verbatim (flows "Outbox needs attention"). */
  rejection: { code: DataErrorCode; message: string } | null;
}

/**
 * Design states forced with `?demo=<state>` in fake mode (plan Task 6); ignored otherwise.
 * empty · loading · error · offline · waiting · attention · noperm · blocked (Owner 2FA off).
 */
export type DemoState =
  "empty" | "loading" | "error" | "offline" | "waiting" | "attention" | "noperm" | "blocked";

// ─── Audit and export ───────────────────────────────────────────────────────

export interface AuditRow {
  id: Id;
  at: Instant;
  actorName: string;
  table: string;
  rowId: Id;
  action: "insert" | "update" | "delete";
  /** Changed fields; the UI words the change from before/after with `src/lib/format.ts`. */
  fields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface ExportListing {
  view: "manager";
  access: Access;
  files: { name: string; rows: number; description: string }[];
  attachments: { count: number; bytes: number };
}

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string;
}

// ─── Inputs (writes). Task 7 adds zod schemas for these. ────────────────────

export interface CrewDayEntry {
  crewMemberId: Id;
  basis: GridBasis;
  /** Daily only: 100 (1 day) or 50 (½ day). */
  days: Hundredths | null;
  /** Hourly: 0.25 steps; daily: defaults to days × standard hours; time-only: hours worked. */
  hours: Hundredths;
  /** Hourly only: 100 = ×1.0, 150 = ×1.5, 200 = ×2.0 (100–300). */
  multiplier: Hundredths | null;
}

export interface CrewDayInput {
  date: LocalDate;
  projectId: Id;
  stageId: Id;
  entries: CrewDayEntry[];
}

export interface ProgressInput {
  stageId: Id;
  date: LocalDate;
  quantity: Hundredths;
  /** In split order (ties in the largest remainder go to the first person). */
  crewMemberIds: Id[];
  shares: Shares;
  photoFileId: Id | null;
  note: string | null;
}

export interface NoWorkInput {
  crewMemberIds: Id[];
  date: LocalDate;
  reason: NoWorkReason;
  note: string | null;
}

export interface StagePauseInput {
  stageId: Id;
  /** First day not worked. */
  date: LocalDate;
  reason: PauseReason;
  note: string | null;
}

export interface StageResumeInput {
  stageId: Id;
  /** First day worked again. */
  date: LocalDate;
}

export interface ExpenseInput {
  date: LocalDate;
  supplier: string;
  /** What was paid, GST included. */
  totalCents: Cents;
  /** Null = the default, total ÷ 11 (domain `splitReceipt`); 0 = "No GST". */
  gstCents: Cents | null;
  projectId: Id;
  stageId: Id | null;
  categoryId: Id;
  paidBy: PaidBy;
  crewMemberId: Id | null;
  receiptFileId: Id | null;
}

export interface ClientInput {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface ProjectInput {
  clientId: Id;
  nickname: string;
  siteAddress: string;
  jobType: JobType;
  contractCents: Cents;
  status: ProjectStatus;
  startDate: LocalDate | null;
  targetFinish: LocalDate | null;
  /** On create: the accepted or edited stage proposal. */
  stages?: StageDraft[];
}

export interface StageInput {
  name: string;
  position: number;
  unit: Unit | null;
  plannedQuantity: Hundredths | null;
  labourBudgetCents: Cents;
  materialsBudgetCents: Cents;
  lumpSumCents: Cents | null;
}

export interface StageDoneInput {
  stageId: Id;
  completedOn: LocalDate;
  note: string | null;
  photoFileId: Id | null;
  /** Lump-sum stages: confirmed split; custom shares must total 10 000 bp. */
  crewMemberIds: Id[];
  shares: Shares;
}

export interface CrewInput {
  name: string;
  phone: string | null;
  type: WorkerType;
  levelId: Id | null;
  abn: string | null;
  gstRegistered: boolean;
  activeFrom: LocalDate;
  activeTo: LocalDate | null;
  defaultBasis: RateBasis;
  defaultUnit: Unit | null;
}

export interface RateInput {
  crewMemberId: Id;
  basis: RateBasis;
  unit: Unit | null;
  amountCents: Cents;
  effectiveFrom: LocalDate;
  /** Null = default rate; set = project override. */
  projectId: Id | null;
}

export interface PayoutInput {
  crewMemberId: Id;
  date: LocalDate;
  amountCents: Cents;
  kind: "advance" | "payment";
  method: PayoutMethod;
  note: string | null;
}

export type WorkspaceSettingsInput = Omit<WorkspaceSettings, "id">;

export interface LevelInput {
  id: Id | null;
  name: string;
  floorRateCents: Cents;
}

export interface CategoryInput {
  id: Id | null;
  name: string;
  position: number;
}

export interface TemplateInput {
  jobType: JobType;
  items: StageTemplateItem[];
}

export interface MemberInput {
  email: string;
  name: string;
  role: Role;
}

// ─── Services ───────────────────────────────────────────────────────────────

export interface WorkspaceService {
  /** Union by role; foreman gets basics only. */
  settings(actor: Actor): Promise<WorkspaceView>;
  updateSettings(actor: Actor, input: WorkspaceSettingsInput): Promise<WorkspaceSettings>;
  levels(actor: Actor): Promise<CrewLevel[]>;
  saveLevel(actor: Actor, input: LevelInput): Promise<CrewLevel>;
  /** Foreman-reachable (expense form); money-free. */
  categories(actor: Actor): Promise<ExpenseCategory[]>;
  saveCategory(actor: Actor, input: CategoryInput): Promise<ExpenseCategory>;
  templates(actor: Actor): Promise<StageTemplate[]>;
  saveTemplate(actor: Actor, input: TemplateInput): Promise<StageTemplate>;
  members(actor: Actor): Promise<Member[]>;
  inviteMember(actor: Actor, input: MemberInput): Promise<Member>;
  setMemberRole(actor: Actor, memberId: Id, role: Role): Promise<Member>;
  /** Foreman project assignments. */
  assignments(actor: Actor): Promise<{ memberId: Id; name: string; projectIds: Id[] }[]>;
  setAssignments(actor: Actor, memberId: Id, projectIds: Id[]): Promise<void>;
}

export interface ProjectService {
  /** Foreman: assigned projects only. Default filter: active. */
  list(actor: Actor, filter?: { status?: ProjectStatus | "all" }): Promise<ProjectList>;
  get(actor: Actor, projectId: Id): Promise<ProjectDetail>;
  proposeStages(actor: Actor, jobType: JobType): Promise<StageProposal>;
  create(actor: Actor, input: ProjectInput): Promise<{ id: Id }>;
  update(actor: Actor, projectId: Id, input: Partial<ProjectInput>): Promise<{ id: Id }>;
  updateStage(actor: Actor, stageId: Id, input: Partial<StageInput>): Promise<{ id: Id }>;
  clients(actor: Actor): Promise<Client[]>;
  createClient(actor: Actor, input: ClientInput): Promise<Client>;
}

export interface StageService {
  get(actor: Actor, stageId: Id): Promise<StageDetail>;
  start(actor: Actor, stageId: Id, date: LocalDate): Promise<EntryResult>;
  /** Field entry (also through sync push). */
  pause(actor: Actor, input: StagePauseInput): Promise<EntryResult>;
  resume(actor: Actor, input: StageResumeInput): Promise<EntryResult>;
  /** Manager/Owner only. */
  doneProposal(actor: Actor, stageId: Id, completedOn?: LocalDate): Promise<DoneProposal>;
  confirmDone(actor: Actor, input: StageDoneInput): Promise<EntryResult>;
  reopen(actor: Actor, stageId: Id): Promise<EntryResult>;
  setManualPct(actor: Actor, stageId: Id, pctBp: ManualPctBp): Promise<EntryResult>;
}

export interface CrewService {
  list(actor: Actor, filter?: { includeInactive?: boolean }): Promise<CrewList>;
  /** Manager view only (rates, balance); foreman → forbidden. */
  get(actor: Actor, crewMemberId: Id): Promise<CrewDetail>;
  create(actor: Actor, input: CrewInput): Promise<{ id: Id }>;
  update(actor: Actor, crewMemberId: Id, input: Partial<CrewInput>): Promise<{ id: Id }>;
  rates(actor: Actor, crewMemberId: Id): Promise<RateDto[]>;
  setRate(actor: Actor, input: RateInput): Promise<RateDto>;
}

export interface LogService {
  crewDayDefaults(
    actor: Actor,
    query?: { date?: LocalDate; projectId?: Id; stageId?: Id },
  ): Promise<CrewDayDefaults>;
  sameAsYesterday(actor: Actor, date: LocalDate): Promise<SameAsYesterday | null>;
  byDay(actor: Actor, date: LocalDate, filter?: { projectId?: Id }): Promise<LogList>;
  byPerson(actor: Actor, crewMemberId: Id, range: DateRange): Promise<LogList>;
  byStage(actor: Actor, stageId: Id): Promise<LogList>;
  saveCrewDay(actor: Actor, input: CrewDayInput, mutationId?: Id): Promise<EntryResult>;
  /** Locked logs → adjustment (pay rules §8); Owner/Manager only. */
  editLog(
    actor: Actor,
    logId: Id,
    input: { hours?: Hundredths; days?: Hundredths; quantity?: Hundredths },
  ): Promise<EntryResult>;
  deleteLog(actor: Actor, logId: Id): Promise<EntryResult>;
}

export interface ProgressService {
  defaults(actor: Actor, query?: { date?: LocalDate; stageId?: Id }): Promise<ProgressDefaults>;
  byStage(
    actor: Actor,
    stageId: Id,
  ): Promise<
    { view: "manager"; rows: ProgressRowManager[] } | { view: "foreman"; rows: ProgressRowForeman[] }
  >;
  record(actor: Actor, input: ProgressInput, mutationId?: Id): Promise<EntryResult>;
}

export interface NoWorkService {
  list(actor: Actor, range: DateRange): Promise<NoWorkRow[]>;
  record(actor: Actor, input: NoWorkInput, mutationId?: Id): Promise<EntryResult>;
  remove(actor: Actor, noWorkId: Id): Promise<void>;
}

export interface ExpenseService {
  list(actor: Actor, filter?: { projectId?: Id; range?: DateRange }): Promise<ExpenseList>;
  get(actor: Actor, expenseId: Id): Promise<ExpenseDetail>;
  /** Field entry: foreman allowed on assigned projects (the result carries no amounts). */
  create(actor: Actor, input: ExpenseInput, mutationId?: Id): Promise<EntryResult>;
  /** Owner/Manager only; audited. */
  update(actor: Actor, expenseId: Id, input: Partial<ExpenseInput>): Promise<EntryResult>;
}

export interface PayRunService {
  list(actor: Actor): Promise<PayRunListItem[]>;
  get(actor: Actor, payRunId: Id): Promise<PayRunReview>;
  /** The draft to review now (oldest unapproved period); null if none. */
  draft(actor: Actor): Promise<PayRunReview | null>;
  approve(actor: Actor, payRunId: Id, options?: { waiveMissingRate?: boolean }): Promise<PayRunReview>;
  reopen(actor: Actor, payRunId: Id): Promise<PayRunReview>;
  exportCsv(actor: Actor, payRunId: Id): Promise<ExportFile>;
  statement(actor: Actor, payRunId: Id, crewMemberId: Id): Promise<Statement>;
  shareStatement(actor: Actor, payRunId: Id, crewMemberId: Id): Promise<StatementShare>;
}

/**
 * The public statement page (`/s/[token]`). The only read without an actor: the unguessable,
 * revocable, 90-day token is the permission.
 */
export interface StatementLinkService {
  open(token: string): Promise<Statement>;
}

export interface LedgerService {
  balances(actor: Actor): Promise<BalanceRow[]>;
  entries(actor: Actor, crewMemberId: Id): Promise<LedgerRow[]>;
  recordPayout(actor: Actor, input: PayoutInput): Promise<{ id: Id; balanceCents: Cents }>;
}

export interface ReportService {
  jobProfitability(actor: Actor, range: DateRange): Promise<Report<JobProfitRow>>;
  crew(actor: Actor, range: DateRange): Promise<Report<CrewReportRow>>;
  productivity(actor: Actor, range: DateRange): Promise<Report<ProductivityRow>>;
  pauses(actor: Actor, range: DateRange): Promise<Report<PauseReportRow>>;
  payHistory(actor: Actor, range: DateRange): Promise<Report<PayHistoryRow>>;
  csv(actor: Actor, kind: ReportKind, range: DateRange): Promise<ExportFile>;
}

export type ReportKind = "job-profitability" | "crew" | "productivity" | "pauses" | "pay-history";

export interface HomeService {
  /** Manager/Owner/Accountant → HomeManager; foreman → HomeForeman. */
  get(actor: Actor): Promise<HomeView>;
}

export interface SyncService {
  push(actor: Actor, request: PushRequest): Promise<PushResponse>;
  snapshot(actor: Actor): Promise<Snapshot>;
}

export interface AuditService {
  history(actor: Actor, filter?: { table?: string; rowId?: Id; limit?: number }): Promise<AuditRow[]>;
}

export interface ExportService {
  listing(actor: Actor): Promise<ExportListing>;
  file(actor: Actor, name: string): Promise<ExportFile>;
}

export interface DataServices {
  workspace: WorkspaceService;
  projects: ProjectService;
  stages: StageService;
  crew: CrewService;
  logs: LogService;
  progress: ProgressService;
  noWork: NoWorkService;
  expenses: ExpenseService;
  payRuns: PayRunService;
  statements: StatementLinkService;
  ledger: LedgerService;
  reports: ReportService;
  home: HomeService;
  sync: SyncService;
  audit: AuditService;
  exports: ExportService;
}

// ─── Server Function results (admin writes) ─────────────────────────────────

/**
 * What an admin Server Function returns: `ok` with its data, or the refusal in plain words (with
 * per-field issues for a form). Never throws for an expected outcome.
 */
export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: DataErrorCode; message: string; issues: FieldIssue[] };
