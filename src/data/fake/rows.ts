/**
 * Store rows for the fake layer, mirroring `docs/specs/03-architecture.md` §5 table by table
 * (camelCase; money in cents, quantities/hours in hundredths, shares/percentages in basis points,
 * dates as workspace-local `LocalDate`, instants as ISO strings).
 */
import type {
  Id,
  Instant,
  JobType,
  PaidBy,
  PayoutMethod,
  PayRunStatus,
  ProjectStatus,
  Role,
} from "../contracts";
import type { NoWorkReason } from "@/domain/attendance";
import type { LedgerKind } from "@/domain/ledger";
import type { LineLabel } from "@/domain/payrun";
import type { PayFrequency } from "@/domain/periods";
import type { StageStatus } from "@/domain/progress";
import type { PauseReason } from "@/domain/segments";
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

export interface RowBase {
  id: Id;
  workspaceId: Id;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface WorkspaceRow extends Omit<RowBase, "workspaceId"> {
  name: string;
  abn: string;
  gstRegistered: boolean;
  timezone: string;
  payPeriod: PayFrequency;
  /** 0 = Sunday … 6 = Saturday. */
  payWeekStart: number;
  /** A period start date; anchors `payPeriodContaining`. */
  payAnchor: LocalDate;
  workingDays: number[];
  standardDayHours: Hundredths;
  onCostBp: BasisPoints;
}

export interface MemberRow extends RowBase {
  userId: Id;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
}

export interface ProjectAssignmentRow extends RowBase {
  memberId: Id;
  projectId: Id;
}

export interface ClientRow extends RowBase {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface ProjectRow extends RowBase {
  clientId: Id;
  siteAddress: string;
  /** Display name, e.g. "Smith job — Ryde re-roof". */
  nickname: string;
  jobType: JobType;
  contractValueCents: Cents;
  status: ProjectStatus;
  startDate: LocalDate | null;
  targetFinish: LocalDate | null;
}

export interface StageTemplateRow extends RowBase {
  jobType: JobType;
  name: string;
}

export interface StageTemplateItemRow extends RowBase {
  templateId: Id;
  name: string;
  position: number;
  defaultUnit: Unit | null;
  labourShareBp: BasisPoints;
  materialsShareBp: BasisPoints;
}

export interface StageRow extends RowBase {
  projectId: Id;
  name: string;
  position: number;
  status: StageStatus;
  unit: Unit | null;
  budgetQty: Hundredths | null;
  labourBudgetCents: Cents;
  materialsBudgetCents: Cents;
  lumpSumCents: Cents | null;
  manualPctBp: BasisPoints | null;
  completedOn: LocalDate | null;
  completionNote: string | null;
}

/** Half-open [startDate, endDate); endDate null = open. `pauseReason` = why this segment ended. */
export interface StageSegmentRow extends RowBase {
  stageId: Id;
  startDate: LocalDate;
  endDate: LocalDate | null;
  pauseReason: PauseReason | null;
  pauseNote: string | null;
}

export interface StageCompletionShareRow extends RowBase {
  stageId: Id;
  crewMemberId: Id;
  shareBp: BasisPoints;
}

export interface CrewLevelRow extends RowBase {
  name: string;
  floorRateCents: Cents;
  position: number;
}

export interface CrewMemberRow extends RowBase {
  name: string;
  phone: string | null;
  type: WorkerType;
  levelId: Id | null;
  abn: string | null;
  gstRegistered: boolean;
  activeFrom: LocalDate;
  /** Inclusive; null = still active. */
  activeTo: LocalDate | null;
  defaultBasis: RateBasis;
  /** Per-unit default only. */
  defaultUnit: Unit | null;
}

/** Same shape as the domain's `RateRecord`, plus the row base. */
export interface RateRow extends RowBase {
  crewMemberId: Id;
  basis: RateBasis;
  unit: Unit | null;
  amountCents: Cents;
  effectiveFrom: LocalDate;
  /** Null = default rate; set = project override. */
  projectId: Id | null;
}

export interface ProgressEntryRow extends RowBase {
  stageId: Id;
  projectId: Id;
  date: LocalDate;
  quantity: Hundredths;
  /** "equal" divides by head-count directly; shares then record the resulting split. */
  splitMode: "equal" | "custom";
  enteredBy: Id;
  photoFileId: Id | null;
  note: string | null;
  mutationId: Id | null;
}

export interface ProgressShareRow extends RowBase {
  progressEntryId: Id;
  crewMemberId: Id;
  /** Position in the split (ties go to the first person). */
  position: number;
  shareBp: BasisPoints;
}

/**
 * `quantity`: days (daily), hours (hourly), units (per-unit), 0 (time-only, lump sum).
 * `rateCents`: the snapshot from `resolveRate` (null = missing rate → amount 0, `missingRate`).
 * `entryId`: the grid submission or progress entry that created it (possible-duplicate check).
 * `payRunId` set = locked (belongs to an approved pay run).
 */
export interface WorkLogRow extends RowBase {
  date: LocalDate;
  crewMemberId: Id;
  projectId: Id;
  stageId: Id;
  basis: Basis;
  unit: Unit | null;
  quantity: Hundredths;
  hours: Hundredths;
  multiplier: Hundredths | null;
  rateCents: Cents | null;
  amountCents: Cents;
  missingRate: boolean;
  source: LogSource;
  adjustsLogId: Id | null;
  progressEntryId: Id | null;
  entryId: Id;
  payRunId: Id | null;
  enteredBy: Id;
  mutationId: Id | null;
  deletedAt: Instant | null;
}

export interface NoWorkRowData extends RowBase {
  crewMemberId: Id;
  date: LocalDate;
  reason: NoWorkReason;
  note: string | null;
  enteredBy: Id;
}

export interface ExpenseCategoryRow extends RowBase {
  name: string;
  position: number;
}

export interface ExpenseRow extends RowBase {
  projectId: Id;
  stageId: Id | null;
  categoryId: Id;
  supplier: string;
  date: LocalDate;
  amountExGstCents: Cents;
  gstCents: Cents;
  paidBy: PaidBy;
  crewMemberId: Id | null;
  receiptFileId: Id | null;
  reimbursedInPayRunId: Id | null;
  enteredBy: Id;
  mutationId: Id | null;
}

export interface PayRunRow extends RowBase {
  periodStart: LocalDate;
  periodEnd: LocalDate;
  status: PayRunStatus;
  approvedBy: Id | null;
  approvedAt: Instant | null;
  exportedAt: Instant | null;
}

export type PayRunLineSnapshot =
  | {
      kind: "log";
      date: LocalDate;
      projectId: Id;
      stageId: Id;
      basis: Basis;
      unit: Unit | null;
      quantity: Hundredths;
      hours: Hundredths;
      multiplier: Hundredths | null;
      rateCents: Cents | null;
      label: LineLabel;
    }
  | { kind: "reimbursement"; date: LocalDate; projectId: Id; supplier: string }
  | { kind: "gst"; subtotalCents: Cents };

/** Frozen at approval. `refId` = work log id (log) or expense id (reimbursement); null for gst. */
export interface PayRunLineRow extends RowBase {
  payRunId: Id;
  crewMemberId: Id;
  kind: "log" | "reimbursement" | "gst";
  refId: Id | null;
  snapshot: PayRunLineSnapshot;
  amountCents: Cents;
}

export interface LedgerEntryRow extends RowBase {
  crewMemberId: Id;
  date: LocalDate;
  kind: LedgerKind;
  /** Positive; `kind` decides the sign (pay rules §15). */
  amountCents: Cents;
  method: PayoutMethod | null;
  note: string | null;
  payRunId: Id | null;
}

export interface StatementLinkRow extends RowBase {
  payRunId: Id;
  crewMemberId: Id;
  /** sha256 hex of the token; the token itself is only known to the link holder (and seed meta). */
  tokenHash: string;
  expiresAt: Instant;
  revokedAt: Instant | null;
}

export interface FileRow extends RowBase {
  storageKey: string;
  name: string;
  mime: string;
  bytes: number;
  sha256: string;
  entityType: "project" | "expense" | "progress_entry" | "stage";
  entityId: Id;
}

export interface ClientMutationRow {
  id: Id;
  workspaceId: Id;
  userId: Id;
  type: string;
  receivedAt: Instant;
  result: unknown;
}

export interface AuditEventRow {
  id: Id;
  workspaceId: Id;
  tableName: string;
  rowId: Id;
  action: "insert" | "update" | "delete";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actorUserId: Id;
  at: Instant;
}

export interface SeedTables {
  workspace: WorkspaceRow;
  members: MemberRow[];
  projectAssignments: ProjectAssignmentRow[];
  clients: ClientRow[];
  projects: ProjectRow[];
  stageTemplates: StageTemplateRow[];
  stageTemplateItems: StageTemplateItemRow[];
  stages: StageRow[];
  stageSegments: StageSegmentRow[];
  stageCompletionShares: StageCompletionShareRow[];
  crewLevels: CrewLevelRow[];
  crewMembers: CrewMemberRow[];
  rates: RateRow[];
  progressEntries: ProgressEntryRow[];
  progressShares: ProgressShareRow[];
  workLogs: WorkLogRow[];
  noWork: NoWorkRowData[];
  expenseCategories: ExpenseCategoryRow[];
  expenses: ExpenseRow[];
  payRuns: PayRunRow[];
  payRunLines: PayRunLineRow[];
  ledgerEntries: LedgerEntryRow[];
  statementLinks: StatementLinkRow[];
  files: FileRow[];
  clientMutations: ClientMutationRow[];
  auditEvents: AuditEventRow[];
}
