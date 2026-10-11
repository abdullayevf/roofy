import { sum } from "@/domain/money";
import {
  DataError,
  isDataError,
  MAX_PUSH_BATCH,
  type Actor,
  type AuditRow,
  type EntryResult,
  type MutationEnvelope,
  type PushRequest,
  type PushResponse,
  type PushResult,
  AuditService,
  type AuditFilter,
  type ExportFile,
  type ExportListing,
  type ExportService,
  type Id,
  type Snapshot,
  type SyncService,
} from "../../contracts";
import { parseMutation } from "../../mutations";
import type { AuditEventRow } from "../rows";
import type { Seed } from "../seed";
import { forbidden, notFound, type FakeContext } from "./context";
import { dateText } from "./writes";
import { crewRowForeman } from "./crew";
import { createExpenseService } from "./expenses";
import { createLogService, createNoWorkService, createProgressService } from "./logs";
import { createStageService } from "./stages";
import { toCsv } from "./reports";

export const OTHER_ACCOUNT =
  "This entry was already sent from another account. Discard it and enter it again.";

/**
 * The fake `POST /api/sync/push` (architecture §7), one mutation at a time in the order sent:
 * idempotency (a repeat id returns the stored result, nothing applied twice) → zod validation →
 * role and job-assignment checks → business checks → apply → store the result. Business warnings
 * are flags on an applied result; only what can't be saved is rejected. Rejections aren't stored, so
 * an edited resend with the same id is applied fresh. Anything unexpected → `retry`.
 */
function createPush(c: FakeContext) {
  const logs = createLogService(c);
  const progress = createProgressService(c);
  const noWork = createNoWorkService(c);
  const stages = createStageService(c);
  const expenses = createExpenseService(c);

  function apply(actor: Actor, m: MutationEnvelope): Promise<EntryResult> {
    switch (m.type) {
      case "crew_day":
        return logs.saveCrewDay(actor, m.payload, m.id);
      case "progress":
        return progress.record(actor, m.payload, m.id);
      case "no_work":
        return noWork.record(actor, m.payload, m.id);
      case "stage_pause":
        return stages.pause(actor, m.payload);
      case "stage_resume":
        return stages.resume(actor, m.payload);
      case "expense":
        return expenses.create(actor, m.payload, m.id);
    }
  }

  async function one(actor: Actor, raw: { id: Id }): Promise<PushResult> {
    const id = raw.id;
    const stored = c.t.clientMutations.find((m) => m.id === id);
    if (stored) {
      if (stored.userId !== actor.userId)
        return { id, status: "rejected", code: "conflict", message: OTHER_ACCOUNT };
      return { id, status: "applied", result: stored.result as EntryResult };
    }
    const parsed = parseMutation(raw);
    if (!parsed.ok) return { id, status: "rejected", code: "invalid", message: parsed.message };
    let result: EntryResult;
    try {
      result = await apply(actor, parsed.envelope);
    } catch (e) {
      if (isDataError(e) && e.code !== "unavailable")
        return { id, status: "rejected", code: e.code, message: e.message };
      return { id, status: "retry" };
    }
    const receivedAt = c.store.nextInstant(c.now());
    c.store.write((t) =>
      t.clientMutations.push({
        id,
        workspaceId: t.workspace.id,
        userId: actor.userId,
        type: parsed.envelope.type,
        receivedAt,
        result,
      }),
    );
    return { id, status: "applied", result };
  }

  return async (actor: Actor, request: PushRequest): Promise<PushResponse> => {
    c.check(actor);
    if (request.mutations.length > MAX_PUSH_BATCH)
      throw new DataError("invalid", `Send at most ${MAX_PUSH_BATCH} entries at a time.`);
    const results: PushResult[] = [];
    for (const m of request.mutations) results.push(await one(actor, m));
    return { results };
  };
}

/** The job's latest logged day or expense date ("" when none): the order of the snapshot's job pickers. */
function latestActivity(c: FakeContext, projectId: string): string {
  let latest = "";
  for (const r of [...c.ix.logsOfProject(projectId), ...c.ix.expensesOf(projectId)]) if (r.date > latest) latest = r.date;
  return latest;
}

export function createSyncService(c: FakeContext): SyncService {
  const push = createPush(c);
  return {
    /** Reference cache for the pickers: no rates for anyone. */
    async snapshot(actor: Actor): Promise<Snapshot> {
      const visible = c.visibleProjects(actor);
      const w = c.t.workspace;
      return {
        takenAt: c.now().toISOString(),
        today: c.today,
        workspace: {
          id: w.id,
          name: w.name,
          timezone: w.timezone,
          workingDays: [...w.workingDays],
          standardDayHours: w.standardDayHours,
        },
        projects: c.t.projects
          .filter((p) => p.status === "active" && (visible === null || visible.has(p.id)))
          // Most recent activity (a logged day or an expense) first, so the job being worked is at the top of a picker.
          .map((p) => ({ p, latest: latestActivity(c, p.id) }))
          .sort((a, b) => b.latest.localeCompare(a.latest) || a.p.nickname.localeCompare(b.p.nickname))
          .map(({ p }) => ({
            id: p.id,
            name: p.nickname,
            status: p.status,
            stages: c.ix.stagesOf(p.id).map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
              unit: s.unit,
              lumpSumStage: s.lumpSumCents !== null,
            })),
          })),
        crew: c.t.crewMembers
          .filter((m) => m.activeTo === null || m.activeTo >= c.today)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => crewRowForeman(m, c.today)),
        categories: [...c.t.expenseCategories]
          .sort((a, b) => a.position - b.position)
          .map((x) => ({ id: x.id, name: x.name, position: x.position })),
      };
    },
    push,
  };
}

/** The job, person and plain name an audit row is about, read from the live row (or the change itself for a removed one). */
function aboutRow(c: FakeContext, e: AuditEventRow): { projectId: Id | null; crewMemberId: Id | null; subject: string } {
  const t = c.t;
  const data = (e.after ?? e.before ?? {}) as Record<string, unknown>;
  const str = (k: string): Id | null => (typeof data[k] === "string" ? (data[k] as string) : null);
  const crewName = (id: Id | null) => (id === null ? "Someone" : (t.crewMembers.find((m) => m.id === id)?.name ?? "Someone"));
  const first = (id: Id | null) => crewName(id).split(" ")[0]!;
  const none = { projectId: null, crewMemberId: null };
  switch (e.tableName) {
    case "project": {
      const p = t.projects.find((x) => x.id === e.rowId);
      return { ...none, projectId: e.rowId, subject: p?.nickname ?? "A job" };
    }
    case "stage": {
      const st = t.stages.find((x) => x.id === e.rowId);
      return { ...none, projectId: st?.projectId ?? str("projectId"), subject: st?.name ?? "A stage" };
    }
    case "expense": {
      const x = t.expenses.find((r) => r.id === e.rowId);
      return { projectId: x?.projectId ?? str("projectId"), crewMemberId: x?.crewMemberId ?? str("crewMemberId"), subject: `${x?.supplier ?? str("supplier") ?? "An"} receipt` };
    }
    case "work_log": {
      const l = t.workLogs.find((r) => r.id === e.rowId);
      const crewId = l?.crewMemberId ?? str("crewMemberId");
      const date = l?.date ?? str("date");
      return { projectId: l?.projectId ?? str("projectId"), crewMemberId: crewId, subject: `${first(crewId)}'s log${date ? ` for ${dateText(c, date)}` : ""}` };
    }
    case "rate": {
      const r = t.rates.find((x) => x.id === e.rowId);
      const crewId = r?.crewMemberId ?? str("crewMemberId");
      return { projectId: r?.projectId ?? str("projectId"), crewMemberId: crewId, subject: `${first(crewId)}'s rate` };
    }
    case "crew_member":
      return { ...none, crewMemberId: e.rowId, subject: crewName(e.rowId) };
    case "ledger_entry": {
      const l = t.ledgerEntries.find((x) => x.id === e.rowId);
      const crewId = l?.crewMemberId ?? null;
      return { ...none, crewMemberId: crewId, subject: `${first(crewId)}'s ${l?.kind ?? str("kind") ?? "payment"}` };
    }
    case "no_work": {
      const n = t.noWork.find((x) => x.id === e.rowId);
      const crewId = n?.crewMemberId ?? str("crewMemberId");
      return { ...none, crewMemberId: crewId, subject: `${first(crewId)}'s no-work day` };
    }
    case "pay_run": {
      const run = t.payRuns.find((x) => x.id === e.rowId);
      return { ...none, subject: run ? `Pay run for ${dateText(c, run.periodStart)} to ${dateText(c, run.periodEnd)}` : "A pay run" };
    }
    case "member":
      return { ...none, subject: str("name") ?? "A team member" };
    case "crew_level":
      return { ...none, subject: str("name") ?? "A crew level" };
    case "stage_template":
      return { ...none, subject: "A stage template" };
    default:
      return { ...none, subject: "Workspace settings" };
  }
}

export function createAuditService(c: FakeContext): AuditService {
  return {
    async history(actor: Actor, filter?: AuditFilter): Promise<AuditRow[]> {
      // Owner and Manager only: an Accountant reads reports and exports, not who changed what.
      if (c.access(actor).role === "accountant") throw forbidden();
      const payRunCrew = (runId: Id) => c.t.payRunLines.some((l) => l.payRunId === runId && l.crewMemberId === filter?.crewMemberId);
      return c.t.auditEvents
        .filter((e) => (!filter?.table || e.tableName === filter.table) && (!filter?.rowId || e.rowId === filter.rowId))
        .map((e) => ({ e, about: aboutRow(c, e) }))
        .filter(
          ({ e, about }) =>
            (!filter?.projectId || about.projectId === filter.projectId) &&
            (!filter?.crewMemberId || about.crewMemberId === filter.crewMemberId || (e.tableName === "pay_run" && payRunCrew(e.rowId))),
        )
        .sort((a, b) => b.e.at.localeCompare(a.e.at))
        .slice(0, filter?.limit ?? 50)
        .map(({ e, about }) => {
          const keys = new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})]);
          return {
            id: e.id,
            at: e.at,
            actorName: c.memberName(e.actorUserId),
            table: e.tableName,
            rowId: e.rowId,
            action: e.action,
            fields: [...keys].filter((k) => JSON.stringify(e.before?.[k]) !== JSON.stringify(e.after?.[k])),
            before: e.before,
            after: e.after,
            subject: about.subject,
            projectId: about.projectId,
            projectName: about.projectId === null ? null : (c.ix.projects.get(about.projectId)?.nickname ?? null),
            crewMemberId: about.crewMemberId,
          };
        });
    },
  };
}

/** The workspace export's files (product spec §5.11): one CSV per table. */
const TABLES: { name: string; key: keyof Omit<Seed, "workspace" | "meta">; description: string }[] = [
  { name: "clients.csv", key: "clients", description: "Clients" },
  { name: "projects.csv", key: "projects", description: "Jobs" },
  { name: "stages.csv", key: "stages", description: "Stages and budgets" },
  { name: "stage_segments.csv", key: "stageSegments", description: "Stage active periods and pauses" },
  { name: "crew_members.csv", key: "crewMembers", description: "Crew" },
  { name: "crew_levels.csv", key: "crewLevels", description: "Levels and floor rates" },
  { name: "rates.csv", key: "rates", description: "Rates with history" },
  { name: "work_logs.csv", key: "workLogs", description: "Work logs" },
  { name: "progress_entries.csv", key: "progressEntries", description: "Progress entries" },
  { name: "no_work.csv", key: "noWork", description: "No-work markers" },
  { name: "expense_categories.csv", key: "expenseCategories", description: "Expense categories" },
  { name: "expenses.csv", key: "expenses", description: "Expenses" },
  { name: "pay_runs.csv", key: "payRuns", description: "Pay runs" },
  { name: "pay_run_lines.csv", key: "payRunLines", description: "Frozen pay run lines" },
  { name: "ledger_entries.csv", key: "ledgerEntries", description: "Payout ledger" },
  { name: "audit_events.csv", key: "auditEvents", description: "Record history" },
];

export function createExportService(c: FakeContext): ExportService {
  const owner = (actor: Actor) => {
    if (!c.access(actor).canAdminister) throw forbidden("Only the Owner can export the whole workspace.");
  };
  return {
    async listing(actor: Actor): Promise<ExportListing> {
      owner(actor);
      return {
        view: "manager",
        access: c.access(actor),
        files: TABLES.map((x) => ({ name: x.name, rows: c.t[x.key].length, description: x.description })),
        attachments: { count: c.t.files.length, bytes: sum(c.t.files.map((f) => f.bytes)) },
      };
    },
    async file(actor: Actor, name: string): Promise<ExportFile> {
      owner(actor);
      const table = TABLES.find((x) => x.name === name);
      if (!table) throw notFound("export file");
      const rows = c.t[table.key] as unknown as Record<string, unknown>[];
      const header = rows.length === 0 ? ["id"] : Object.keys(rows[0]!);
      const value = (v: unknown) =>
        v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v);
      return {
        filename: table.name,
        contentType: "text/csv; charset=utf-8",
        body: toCsv(
          header,
          rows.map((r) => header.map((h) => value(r[h]))),
        ),
      };
    },
  };
}
