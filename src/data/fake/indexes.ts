/**
 * Lookups over one version of the store's tables, built in one pass each (tens of thousands of rows,
 * a few milliseconds). Pure bookkeeping: no money maths here.
 */
import { dayKey, type NoWorkReason } from "@/domain/attendance";
import type { StageSegment } from "@/domain/segments";
import type { Id } from "../contracts";
import type {
  ClientRow,
  CrewLevelRow,
  CrewMemberRow,
  ExpenseCategoryRow,
  ExpenseRow,
  FileRow,
  LedgerEntryRow,
  MemberRow,
  NoWorkRowData,
  PayRunLineRow,
  PayRunRow,
  ProgressEntryRow,
  ProgressShareRow,
  ProjectRow,
  RateRow,
  StageRow,
  StageSegmentRow,
  WorkLogRow,
} from "./rows";
import type { Seed } from "./seed";

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k === null) continue;
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

const byId = <T extends { id: Id }>(rows: readonly T[]) => new Map(rows.map((r) => [r.id, r]));
const EMPTY: readonly never[] = Object.freeze([]);

export class StoreIndex {
  readonly projects: Map<Id, ProjectRow>;
  readonly clients: Map<Id, ClientRow>;
  readonly stages: Map<Id, StageRow>;
  readonly crew: Map<Id, CrewMemberRow>;
  readonly levels: Map<Id, CrewLevelRow>;
  readonly categories: Map<Id, ExpenseCategoryRow>;
  readonly expenses: Map<Id, ExpenseRow>;
  readonly payRuns: Map<Id, PayRunRow>;
  readonly files: Map<Id, FileRow>;
  readonly logs: Map<Id, WorkLogRow>;
  readonly membersByUser: Map<Id, MemberRow>;
  /** Live (not deleted) logs, in store order. */
  readonly liveLogs: WorkLogRow[];
  /** Live logs not yet in an approved pay run. */
  readonly openLogs: WorkLogRow[];
  private readonly stagesByProject: Map<Id, StageRow[]>;
  private readonly segmentsByStage: Map<Id, StageSegmentRow[]>;
  private readonly progressByStage: Map<Id, ProgressEntryRow[]>;
  private readonly sharesByEntry: Map<Id, ProgressShareRow[]>;
  private readonly logsByStage: Map<Id, WorkLogRow[]>;
  private readonly logsByProject: Map<Id, WorkLogRow[]>;
  private readonly logsByCrew: Map<Id, WorkLogRow[]>;
  private readonly logsByDate: Map<string, WorkLogRow[]>;
  private readonly logsByProgressEntry: Map<Id, WorkLogRow[]>;
  private readonly expensesByProject: Map<Id, ExpenseRow[]>;
  private readonly ledgerByCrew: Map<Id, LedgerEntryRow[]>;
  private readonly ratesByCrew: Map<Id, RateRow[]>;
  private readonly linesByRun: Map<Id, PayRunLineRow[]>;
  private readonly filesByEntity: Map<string, FileRow[]>;
  private readonly assignmentsByMember: Map<Id, Id[]>;
  private readonly completionSharesByStage: Map<Id, Seed["stageCompletionShares"]>;
  /** dayKey(crew, date) of every live log. */
  readonly loggedDays: Set<string>;
  /** dayKey(crew, date) → reason. */
  readonly noWorkDays: Map<string, NoWorkReason>;
  readonly noWorkRows: NoWorkRowData[];

  constructor(t: Seed) {
    this.projects = byId(t.projects);
    this.clients = byId(t.clients);
    this.stages = byId(t.stages);
    this.crew = byId(t.crewMembers);
    this.levels = byId(t.crewLevels);
    this.categories = byId(t.expenseCategories);
    this.expenses = byId(t.expenses);
    this.payRuns = byId(t.payRuns);
    this.files = byId(t.files);
    this.logs = byId(t.workLogs);
    this.membersByUser = new Map(t.members.map((m) => [m.userId, m]));
    this.liveLogs = t.workLogs.filter((l) => l.deletedAt === null);
    this.openLogs = this.liveLogs.filter((l) => l.payRunId === null);
    this.stagesByProject = groupBy(t.stages, (s) => s.projectId);
    for (const list of this.stagesByProject.values()) list.sort((a, b) => a.position - b.position);
    this.segmentsByStage = groupBy(t.stageSegments, (s) => s.stageId);
    for (const list of this.segmentsByStage.values())
      list.sort((a, b) => a.startDate.localeCompare(b.startDate));
    this.progressByStage = groupBy(t.progressEntries, (p) => p.stageId);
    this.sharesByEntry = groupBy(t.progressShares, (s) => s.progressEntryId);
    for (const list of this.sharesByEntry.values()) list.sort((a, b) => a.position - b.position);
    this.logsByStage = groupBy(this.liveLogs, (l) => l.stageId);
    this.logsByProject = groupBy(this.liveLogs, (l) => l.projectId);
    this.logsByCrew = groupBy(this.liveLogs, (l) => l.crewMemberId);
    this.logsByDate = groupBy(this.liveLogs, (l) => l.date);
    this.logsByProgressEntry = groupBy(this.liveLogs, (l) => l.progressEntryId);
    this.expensesByProject = groupBy(t.expenses, (e) => e.projectId);
    this.ledgerByCrew = groupBy(t.ledgerEntries, (e) => e.crewMemberId);
    for (const list of this.ledgerByCrew.values())
      list.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    this.ratesByCrew = groupBy(t.rates, (r) => r.crewMemberId);
    this.linesByRun = groupBy(t.payRunLines, (l) => l.payRunId);
    this.filesByEntity = groupBy(t.files, (f) => `${f.entityType}|${f.entityId}`);
    this.assignmentsByMember = new Map(
      [...groupBy(t.projectAssignments, (a) => a.memberId)].map(([k, v]) => [k, v.map((a) => a.projectId)]),
    );
    this.completionSharesByStage = groupBy(t.stageCompletionShares, (s) => s.stageId);
    this.loggedDays = new Set(this.liveLogs.map((l) => dayKey(l.crewMemberId, l.date)));
    this.noWorkRows = t.noWork;
    this.noWorkDays = new Map(t.noWork.map((n) => [dayKey(n.crewMemberId, n.date), n.reason]));
  }

  stagesOf(projectId: Id): readonly StageRow[] {
    return this.stagesByProject.get(projectId) ?? EMPTY;
  }
  segmentRowsOf(stageId: Id): readonly StageSegmentRow[] {
    return this.segmentsByStage.get(stageId) ?? EMPTY;
  }
  segmentsOf(stageId: Id): StageSegment[] {
    return this.segmentRowsOf(stageId).map((g) => ({
      start: g.startDate,
      end: g.endDate,
      pauseReason: g.pauseReason,
    }));
  }
  progressOf(stageId: Id): readonly ProgressEntryRow[] {
    return this.progressByStage.get(stageId) ?? EMPTY;
  }
  sharesOf(progressEntryId: Id): readonly ProgressShareRow[] {
    return this.sharesByEntry.get(progressEntryId) ?? EMPTY;
  }
  logsOfStage(stageId: Id): readonly WorkLogRow[] {
    return this.logsByStage.get(stageId) ?? EMPTY;
  }
  logsOfProject(projectId: Id): readonly WorkLogRow[] {
    return this.logsByProject.get(projectId) ?? EMPTY;
  }
  logsOfCrew(crewId: Id): readonly WorkLogRow[] {
    return this.logsByCrew.get(crewId) ?? EMPTY;
  }
  logsOn(date: string): readonly WorkLogRow[] {
    return this.logsByDate.get(date) ?? EMPTY;
  }
  logsOfProgress(progressEntryId: Id): readonly WorkLogRow[] {
    return this.logsByProgressEntry.get(progressEntryId) ?? EMPTY;
  }
  expensesOf(projectId: Id): readonly ExpenseRow[] {
    return this.expensesByProject.get(projectId) ?? EMPTY;
  }
  /** Date order (then creation order). */
  ledgerOf(crewId: Id): readonly LedgerEntryRow[] {
    return this.ledgerByCrew.get(crewId) ?? EMPTY;
  }
  ratesOf(crewId: Id): readonly RateRow[] {
    return this.ratesByCrew.get(crewId) ?? EMPTY;
  }
  linesOf(payRunId: Id): readonly PayRunLineRow[] {
    return this.linesByRun.get(payRunId) ?? EMPTY;
  }
  filesOf(entityType: FileRow["entityType"], entityId: Id): readonly FileRow[] {
    return this.filesByEntity.get(`${entityType}|${entityId}`) ?? EMPTY;
  }
  /** Foreman project assignments by member id. */
  assignedProjects(memberId: Id): readonly Id[] {
    return this.assignmentsByMember.get(memberId) ?? EMPTY;
  }
  completionSharesOf(stageId: Id): Seed["stageCompletionShares"] {
    return this.completionSharesByStage.get(stageId) ?? [];
  }
}
