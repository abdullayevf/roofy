/**
 * What every fake write shares (plan Task 7): role gates, row stamps, the audit trail, the stage
 * auto-start, rate snapshots and the business flags an entry is applied with (architecture §7 —
 * never a rejection). Money only through `src/domain`.
 */
import { v7 as uuidv7 } from "uuid";
import { duplicateFlags, pausedStageFlags, type FlagLog } from "@/domain/flags";
import { dailyAmount, hourlyAmount, perUnitAmount } from "@/domain/lines";
import { resolveRate } from "@/domain/rates";
import type { Cents, LocalDate, RateBasis, Unit } from "@/domain/types";
import { formatDate } from "@/lib/format";
import {
  DataError,
  ENTRY_FLAGS,
  FOREMAN_HIDDEN_FLAGS,
  type Access,
  type Actor,
  type EntryFlag,
  type EntryResult,
  type FieldIssue,
  type Id,
  type Instant,
} from "../../contracts";
import type { CrewMemberRow, RateRow, RowBase, StageRow, StageSegmentRow, WorkLogRow } from "../rows";
import type { Seed } from "../seed";
import { forbidden, NO_ACCESS, type FakeContext } from "./context";

export const invalid = (message: string, issues: readonly FieldIssue[] = []) =>
  new DataError("invalid", message, issues);
export const conflict = (message: string) => new DataError("conflict", message);

// ─── Role gates (product spec §3) ───────────────────────────────────────────

/** Field entries: Owner, Manager, Foreman (assigned jobs are checked per project). Not Accountant. */
export function requireFieldWriter(c: FakeContext, actor: Actor): void {
  c.check(actor);
  if (actor.role === "accountant") throw forbidden(NO_ACCESS);
}

/** Projects, stages, crew, rates, logs, expenses, settings: Owner and Manager. */
export function requireEditor(c: FakeContext, actor: Actor): Access {
  const access = c.access(actor);
  if (!access.canEdit) throw forbidden(NO_ACCESS);
  return access;
}

/** Approve/reopen pay runs, record payouts, share statements: Owner and Manager. */
export function requireApprover(c: FakeContext, actor: Actor): Access {
  const access = c.access(actor);
  if (!access.canApprove) throw forbidden(NO_ACCESS);
  return access;
}

/** Members and roles: the Owner. */
export function requireOwner(c: FakeContext, actor: Actor): Access {
  const access = c.access(actor);
  if (!access.canAdminister) throw forbidden("Only the Owner can change members and roles.");
  return access;
}

// ─── Writing ────────────────────────────────────────────────────────────────

export interface WriteScope {
  t: Seed;
  /** This write's instant. */
  at: Instant;
  base(): RowBase;
  audit(
    table: string,
    rowId: Id,
    action: "insert" | "update" | "delete",
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): void;
}

/**
 * Runs `change` against the store as one write: stamps rows, records the audit trail and logs the
 * write in the store's mutation log. Read-only stores (shared seed, `?demo=empty`) refuse.
 */
export function write<T>(c: FakeContext, actor: Actor, type: string, change: (w: WriteScope) => T): T {
  const at = c.store.nextInstant(c.now());
  const result = c.store.write((t) => {
    const scope: WriteScope = {
      t,
      at,
      base: () => ({ id: uuidv7(), workspaceId: t.workspace.id, createdAt: at, updatedAt: at }),
      audit: (table, rowId, action, before, after) =>
        t.auditEvents.push({
          id: uuidv7(),
          workspaceId: t.workspace.id,
          tableName: table,
          rowId,
          action,
          before,
          after,
          actorUserId: actor.userId,
          at,
        }),
    };
    return change(scope);
  });
  c.store.mutations.push({ id: uuidv7(), type, actorUserId: actor.userId, at, result });
  return result;
}

// ─── Lookups ────────────────────────────────────────────────────────────────

export function dateText(c: FakeContext, date: LocalDate): string {
  return formatDate(date, c.today);
}

/** A crew member working for the business on `date`, else an `invalid` the person can act on. */
export function requireCrewOn(c: FakeContext, crewId: Id, date: LocalDate): CrewMemberRow {
  const crew = c.ix.crew.get(crewId);
  if (!crew) throw invalid("Someone picked isn't in your crew list any more. Pick the crew again.");
  if (crew.activeFrom > date || (crew.activeTo !== null && crew.activeTo < date)) {
    throw invalid(`${crew.name} wasn't working for you on ${dateText(c, date)}. Take them off this entry.`);
  }
  return crew;
}

/** Pay rules §1: the rate a new log snapshots, or null (missing rate → $0.00 + flag). */
export function rateFor(
  rates: readonly RateRow[],
  crewId: Id,
  basis: RateBasis,
  unit: Unit | null,
  projectId: Id,
  date: LocalDate,
): Cents | null {
  return resolveRate(rates, { crewMemberId: crewId, basis, unit, projectId, date })?.amountCents ?? null;
}

/** The approved (or exported) pay run whose period contains `date`, if any (pay rules §8). */
export function approvedRunOn(t: Seed, date: LocalDate) {
  return t.payRuns.find((r) => r.status !== "draft" && r.periodStart <= date && date <= r.periodEnd);
}

/** The stage's open segment (end null), if it is active. */
export function openSegment(t: Seed, stageId: Id): StageSegmentRow | undefined {
  return t.stageSegments.find((g) => g.stageId === stageId && g.endDate === null);
}

/** The stage's latest segment by start date. */
export function lastSegment(t: Seed, stageId: Id): StageSegmentRow | undefined {
  return t.stageSegments
    .filter((g) => g.stageId === stageId)
    .reduce<StageSegmentRow | undefined>(
      (a, g) => (a === undefined || g.startDate > a.startDate ? g : a),
      undefined,
    );
}

/**
 * Product spec §5.3: a log or progress on a Not started stage starts it from that date (the segment
 * opens on the entry's date). Returns the new segment, or null when the stage had already started.
 */
export function startStage(w: WriteScope, stage: StageRow, date: LocalDate): StageSegmentRow | null {
  if (stage.status !== "not_started") return null;
  stage.status = "active";
  stage.updatedAt = w.at;
  const seg: StageSegmentRow = {
    ...w.base(),
    stageId: stage.id,
    startDate: date,
    endDate: null,
    pauseReason: null,
    pauseNote: null,
  };
  w.t.stageSegments.push(seg);
  const project = w.t.projects.find((p) => p.id === stage.projectId);
  if (project && (project.startDate === null || date < project.startDate)) project.startDate = date;
  return seg;
}

/** Recomputes a log's amount from its snapshot rate (pay rules §2–§4). */
export function amountOf(
  basis: WorkLogRow["basis"],
  rateCents: Cents | null,
  v: { quantity: number; hours: number; multiplier: number | null },
): Cents {
  if (rateCents === null) return 0;
  switch (basis) {
    case "hourly":
      return hourlyAmount(v.hours, rateCents, v.multiplier ?? 100);
    case "daily":
      return dailyAmount(v.quantity, rateCents);
    case "per_unit":
      return v.quantity === 0 ? 0 : perUnitAmount(v.quantity, rateCents);
    default:
      return 0;
  }
}

// ─── Flags and results ──────────────────────────────────────────────────────

const flagLog = (l: WorkLogRow): FlagLog => ({
  id: l.id,
  crewMemberId: l.crewMemberId,
  date: l.date,
  stageId: l.stageId,
  basis: l.basis,
  source: l.source,
  entryId: l.entryId,
});

/**
 * The business flags for logs just written (call after the write, so indexes include them):
 * paused/done stage (pay rules §9), late entry into an approved period (§8), possible duplicate
 * (§9), missing rate (§1), and whether the entry auto-started its stage.
 */
export function entryFlags(c: FakeContext, logs: readonly WorkLogRow[], autoStarted = false): EntryFlag[] {
  const flags = new Set<EntryFlag>();
  if (autoStarted) flags.add("auto_started");
  if (logs.some((l) => l.missingRate)) flags.add("missing_rate");
  if (logs.some((l) => approvedRunOn(c.t, l.date))) flags.add("late_entry");
  const segments = new Map([...new Set(logs.map((l) => l.stageId))].map((id) => [id, c.ix.segmentsOf(id)]));
  if (pausedStageFlags(logs.map(flagLog), segments).length > 0) flags.add("paused_stage");
  const ids = new Set(logs.map((l) => l.id));
  const keys = new Set(logs.map((l) => `${l.crewMemberId}|${l.date}|${l.stageId}`));
  const around = c.ix.liveLogs.filter((l) => keys.has(`${l.crewMemberId}|${l.date}|${l.stageId}`));
  if (duplicateFlags(around.map(flagLog)).some((g) => g.logIds.some((id) => ids.has(id))))
    flags.add("possible_duplicate");
  return ENTRY_FLAGS.filter((f) => flags.has(f));
}

/** The result an actor sees: a foreman never gets pay-only flags (missing rate, late entry). */
export function entryResult(actor: Actor, ids: Id[], flags: EntryFlag[]): EntryResult {
  return {
    ids,
    flags: actor.role === "foreman" ? flags.filter((f) => !FOREMAN_HIDDEN_FLAGS.includes(f)) : flags,
  };
}

/** Plain fields of a row for the audit trail (no row base). */
export function snapshot<T extends object>(row: T): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, workspaceId, createdAt, updatedAt, ...rest } = row as T & Partial<RowBase>;
  return structuredClone(rest) as Record<string, unknown>;
}
