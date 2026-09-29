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
  type ExportFile,
  type ExportListing,
  type ExportService,
  type Id,
  type Snapshot,
  type SyncService,
} from "../../contracts";
import { parseMutation } from "../../mutations";
import type { Seed } from "../seed";
import { forbidden, notFound, type FakeContext } from "./context";
import { crewRowForeman } from "./crew";
import { createExpenseService } from "./expenses";
import { createLogService, createNoWorkService, createProgressService } from "./logs";
import { createStageService } from "./stages";
import { toCsv } from "./reports";

export const OTHER_ACCOUNT = "This entry was already sent from another account. Discard it and enter it again.";

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
      if (stored.userId !== actor.userId) return { id, status: "rejected", code: "conflict", message: OTHER_ACCOUNT };
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
          .sort((a, b) => a.nickname.localeCompare(b.nickname))
          .map((p) => ({
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

export function createAuditService(c: FakeContext): AuditService {
  return {
    async history(
      actor: Actor,
      filter?: { table?: string; rowId?: Id; limit?: number },
    ): Promise<AuditRow[]> {
      c.access(actor);
      return c.t.auditEvents
        .filter(
          (e) =>
            (!filter?.table || e.tableName === filter.table) && (!filter?.rowId || e.rowId === filter.rowId),
        )
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, filter?.limit ?? 50)
        .map((e) => {
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
