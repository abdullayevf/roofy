import { sum } from "@/domain/money";
import type {
  Actor,
  AuditRow,
  AuditService,
  ExportFile,
  ExportListing,
  ExportService,
  Id,
  Snapshot,
  SyncService,
} from "../../contracts";
import type { Seed } from "../seed";
import { forbidden, notFound, notYet, type FakeContext } from "./context";
import { crewRowForeman } from "./crew";
import { toCsv } from "./reports";

export function createSyncService(c: FakeContext): SyncService {
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
    push: () => notYet("sync.push"),
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
