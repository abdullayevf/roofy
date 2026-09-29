import { adjustmentDelta, reversal } from "@/domain/adjustments";
import { defaultHours } from "@/domain/lines";
import { pieceRateLines } from "@/domain/piece";
import { resolveRate } from "@/domain/rates";
import { splitWeighted } from "@/domain/split";
import type { Hundredths, LocalDate } from "@/domain/types";
import type {
  Actor,
  CrewDayDefaults,
  CrewDayInput,
  DateRange,
  EntryResult,
  GridCrewForeman,
  GridCrewManager,
  Id,
  LogList,
  LogService,
  NoWorkInput,
  NoWorkRow,
  NoWorkService,
  ProgressDefaults,
  ProgressInput,
  ProgressService,
  ProjectPick,
  SameAsYesterday,
} from "../../contracts";
import { gridBasisFor } from "../grid-basis";
import type { StageRow, WorkLogRow } from "../rows";
import { FakeContext, FIELD_ACCESS, forbidden, notFound, shortName } from "./context";
import { crewRowForeman } from "./crew";
import { progressRowForeman, progressRowManager } from "./stages";
import {
  amountOf,
  conflict,
  dateText,
  entryFlags,
  entryResult,
  invalid,
  rateFor,
  requireCrewOn,
  requireEditor,
  requireFieldWriter,
  snapshot,
  startStage,
  write,
  type WriteScope,
} from "./writes";

/** How many recent-stage chips the entry screens offer. */
export const LATEST_STAGES = 5;

const byRecent = (a: WorkLogRow, b: WorkLogRow) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

function logList(c: FakeContext, actor: Actor, logs: WorkLogRow[]): LogList {
  if (c.isForeman(actor)) {
    return { view: "foreman", access: FIELD_ACCESS, rows: FakeContext.fieldLogs(logs).map((l) => c.logForeman(l)) };
  }
  return { view: "manager", access: c.access(actor), rows: logs.map((l) => c.logManager(l)) };
}

/** Jobs an entry screen offers: active ones the actor may see (plus `include`, if visible). */
function pickableProjects(c: FakeContext, actor: Actor, include?: Id, unitStagesOnly = false): ProjectPick[] {
  const visible = c.visibleProjects(actor);
  return c.t.projects
    .filter((p) => (p.status === "active" || p.id === include) && (visible === null || visible.has(p.id)))
    .sort((a, b) => a.nickname.localeCompare(b.nickname))
    .map((p) => ({
      id: p.id,
      name: p.nickname,
      stages: c.ix
        .stagesOf(p.id)
        .filter((s) => !unitStagesOnly || s.unit !== null)
        .map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          unit: s.unit,
          lumpSumStage: s.lumpSumCents !== null,
        })),
    }));
}

const stageLabel = (c: FakeContext, st: StageRow) =>
  `${shortName(c.ix.projects.get(st.projectId)!.nickname)} — ${st.name}`;

/**
 * "Same as yesterday" (flows): the previous logged day before `date` among the jobs the actor can
 * see, and on it the first crew-day grid entry made that day (the day's main crew) — its job, stage
 * and crew. Null when nothing was logged before ("No day to copy yet").
 */
function sameAsYesterday(c: FakeContext, actor: Actor, date: LocalDate): SameAsYesterday | null {
  const visible = c.visibleProjects(actor);
  const grid = c.ix.liveLogs.filter(
    (l) => l.source === "grid" && l.date < date && (visible === null || visible.has(l.projectId)),
  );
  const fromDate = grid.reduce<LocalDate | null>((d, l) => (d === null || l.date > d ? l.date : d), null);
  if (fromDate === null) return null;
  const onDay = grid.filter((l) => l.date === fromDate);
  const first = onDay.reduce((a, b) => (b.createdAt < a.createdAt ? b : a));
  const entry = onDay.filter((l) => l.entryId === first.entryId);
  return {
    fromDate,
    projectId: first.projectId,
    stageId: first.stageId,
    crewMemberIds: [...new Set(entry.map((l) => l.crewMemberId))],
  };
}

export function createLogService(c: FakeContext): LogService {
  return {
    async crewDayDefaults(
      actor: Actor,
      query?: { date?: LocalDate; projectId?: Id; stageId?: Id },
    ): Promise<CrewDayDefaults> {
      const date = query?.date ?? c.today;
      const stageQuery = query?.stageId ? c.requireStage(actor, query.stageId) : null;
      const projectId = query?.projectId ?? stageQuery?.projectId ?? null;
      if (projectId !== null) c.requireProject(actor, projectId);
      const projects = pickableProjects(c, actor, projectId ?? undefined);
      const chosenProject = projectId ?? (projects.length === 1 ? projects[0]!.id : null);
      let stage: StageRow | null = stageQuery;
      if (stage === null && chosenProject !== null) {
        const stages = c.ix.stagesOf(chosenProject);
        const active = stages.filter((s) => s.status === "active");
        stage =
          active.length === 1
            ? active[0]!
            : active.length === 0
              ? (stages.find((s) => s.status === "not_started") ?? null)
              : null;
      }
      const visible = c.visibleProjects(actor);
      const latest: CrewDayDefaults["latestStages"] = [];
      for (const l of [...c.ix.liveLogs].filter((x) => x.source === "grid").sort(byRecent)) {
        if (latest.length >= LATEST_STAGES) break;
        if (latest.some((x) => x.stageId === l.stageId)) continue;
        const st = c.ix.stages.get(l.stageId)!;
        const project = c.ix.projects.get(st.projectId)!;
        if (
          st.status === "done" ||
          project.status !== "active" ||
          (visible !== null && !visible.has(project.id))
        )
          continue;
        latest.push({ projectId: project.id, stageId: st.id, label: stageLabel(c, st) });
      }
      const noWork = c.ix.noWorkDays;
      const crew: GridCrewForeman[] = c.t.crewMembers
        .filter((m) => m.activeFrom <= date && (m.activeTo === null || m.activeTo >= date))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => {
          const basis = gridBasisFor(m, stage === null ? undefined : stage.unit);
          return {
            crewMemberId: m.id,
            name: m.name,
            type: m.type,
            basis,
            unit: m.defaultUnit,
            standardHours: c.t.workspace.standardDayHours,
            timeOnly: basis === "time_only" && m.defaultBasis === "per_unit",
            loggedOnDate: c.ix.loggedDays.has(`${m.id}|${date}`),
            noWorkOnDate: noWork.get(`${m.id}|${date}`) ?? null,
          };
        });
      const base = {
        date,
        projects,
        projectId: chosenProject,
        stageId: stage?.id ?? null,
        latestStages: latest,
        sameAsYesterday: sameAsYesterday(c, actor, date),
      };
      if (c.isForeman(actor)) return { ...base, view: "foreman", access: FIELD_ACCESS, crew };
      return {
        ...base,
        view: "manager",
        access: c.access(actor),
        crew: crew.map((g): GridCrewManager => {
          if (g.basis === "time_only") return { ...g, rateCents: null, missingRate: false };
          const rate = resolveRate(c.ix.ratesOf(g.crewMemberId), {
            crewMemberId: g.crewMemberId,
            basis: g.basis,
            unit: null,
            projectId: chosenProject ?? "",
            date,
          });
          return { ...g, rateCents: rate?.amountCents ?? null, missingRate: rate === null };
        }),
      };
    },

    async sameAsYesterday(actor: Actor, date: LocalDate): Promise<SameAsYesterday | null> {
      return sameAsYesterday(c, actor, date);
    },

    async byDay(actor: Actor, date: LocalDate, filter?: { projectId?: Id }): Promise<LogList> {
      if (filter?.projectId) c.requireProject(actor, filter.projectId);
      const logs = c.ix
        .logsOn(date)
        .filter(
          (l) =>
            (!filter?.projectId || l.projectId === filter.projectId) && c.canSeeProject(actor, l.projectId),
        )
        .sort(
          (a, b) =>
            c.ix.projects
              .get(a.projectId)!
              .nickname.localeCompare(c.ix.projects.get(b.projectId)!.nickname) ||
            c.ix.stages.get(a.stageId)!.position - c.ix.stages.get(b.stageId)!.position ||
            c.fig.crewOf(a.crewMemberId).name.localeCompare(c.fig.crewOf(b.crewMemberId).name),
        );
      return logList(c, actor, logs);
    },

    async byPerson(actor: Actor, crewMemberId: Id, range: DateRange): Promise<LogList> {
      if (!c.ix.crew.has(crewMemberId)) throw notFound("crew member");
      const logs = c.ix
        .logsOfCrew(crewMemberId)
        .filter((l) => l.date >= range.from && l.date <= range.to && c.canSeeProject(actor, l.projectId))
        .sort(byRecent);
      return logList(c, actor, logs);
    },

    async byStage(actor: Actor, stageId: Id): Promise<LogList> {
      const st = c.requireStage(actor, stageId);
      return logList(c, actor, [...c.ix.logsOfStage(st.id)].sort(byRecent));
    },

    async saveCrewDay(actor: Actor, input: CrewDayInput, mutationId?: Id): Promise<EntryResult> {
      return saveCrewDay(c, actor, input, mutationId ?? null);
    },
    async editLog(actor, logId, input) {
      return editLog(c, actor, logId, input);
    },
    async deleteLog(actor, logId) {
      return deleteLog(c, actor, logId);
    },
  };
}

export function createProgressService(c: FakeContext): ProgressService {
  return {
    async defaults(actor: Actor, query?: { date?: LocalDate; stageId?: Id }): Promise<ProgressDefaults> {
      if (query?.stageId) {
        const st = c.requireStage(actor, query.stageId);
        if (st.unit === null) throw forbidden("This stage has no unit, so progress isn't measured on it.");
      }
      const visible = c.visibleProjects(actor);
      const latest: ProgressDefaults["latestStages"] = [];
      const entries = [...c.t.progressEntries].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
      for (const p of entries) {
        if (latest.length >= LATEST_STAGES) break;
        if (latest.some((x) => x.stageId === p.stageId)) continue;
        const st = c.ix.stages.get(p.stageId)!;
        const project = c.ix.projects.get(st.projectId)!;
        if (st.status === "done" || st.unit === null || project.status !== "active") continue;
        if (visible !== null && !visible.has(project.id)) continue;
        latest.push({
          projectId: project.id,
          stageId: st.id,
          label: stageLabel(c, st),
          unit: st.unit,
          quantityDone: c.fig.stage(st.id).measured,
          plannedQuantity: st.budgetQty,
        });
      }
      const date = query?.date ?? c.today;
      return {
        view: c.isForeman(actor) ? "foreman" : "manager",
        date,
        latestStages: latest,
        projects: pickableProjects(c, actor, undefined, true).filter((p) => p.stages.length > 0),
        crew: c.t.crewMembers
          .filter((m) => m.activeFrom <= date && (m.activeTo === null || m.activeTo >= date))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => crewRowForeman(m, c.today)),
      };
    },

    async byStage(actor: Actor, stageId: Id) {
      const st = c.requireStage(actor, stageId);
      const entries = [...c.ix.progressOf(st.id)].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
      if (c.isForeman(actor))
        return { view: "foreman" as const, rows: entries.map((p) => progressRowForeman(c, p)) };
      c.access(actor);
      return { view: "manager" as const, rows: entries.map((p) => progressRowManager(c, p)) };
    },

    async record(actor: Actor, input: ProgressInput, mutationId?: Id): Promise<EntryResult> {
      return recordProgress(c, actor, input, mutationId ?? null);
    },
  };
}

export function createNoWorkService(c: FakeContext): NoWorkService {
  return {
    async list(actor: Actor, range: DateRange): Promise<NoWorkRow[]> {
      c.check(actor);
      return c.ix.noWorkRows
        .filter((n) => n.date >= range.from && n.date <= range.to)
        .map((n) => ({
          id: n.id,
          crewMemberId: n.crewMemberId,
          name: c.fig.crewOf(n.crewMemberId).name,
          date: n.date,
          reason: n.reason,
          note: n.note,
        }))
        .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
    },
    async record(actor: Actor, input: NoWorkInput): Promise<EntryResult> {
      return recordNoWork(c, actor, input);
    },
    async remove(actor: Actor, noWorkId: Id): Promise<void> {
      requireFieldWriter(c, actor);
      const row = c.t.noWork.find((n) => n.id === noWorkId);
      if (!row) throw notFound("no-work marker");
      write(c, actor, "no_work_remove", (w) => {
        w.t.noWork.splice(w.t.noWork.indexOf(row), 1);
        w.audit("no_work", row.id, "delete", snapshot(row), null);
      });
    },
  };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

type NewLog = Omit<WorkLogRow, "id" | "workspaceId" | "createdAt" | "updatedAt">;

function pushLog(w: WriteScope, log: NewLog): WorkLogRow {
  const row: WorkLogRow = { ...w.base(), ...log };
  w.t.workLogs.push(row);
  return row;
}

/** A field entry's stage on a job the actor may log to. */
function entryStage(c: FakeContext, actor: Actor, stageId: Id): StageRow {
  requireFieldWriter(c, actor);
  return c.requireStage(actor, stageId);
}

/**
 * Crew-day grid (product spec §5.5, pay rules §1–§3): one log per row, each snapshotting its rate
 * (`resolveRate`) and amount (`hourlyAmount` / `dailyAmount`, hours defaulting to days × standard day);
 * time-only rows record hours at $0.00. The basis is the row's (the grid defaults it with
 * `gridBasisFor`; the person can switch someone to time-only). A missing rate saves at $0.00, flagged.
 */
function saveCrewDay(c: FakeContext, actor: Actor, input: CrewDayInput, mutationId: Id | null): EntryResult {
  const stage = entryStage(c, actor, input.stageId);
  c.requireProject(actor, input.projectId);
  if (stage.projectId !== input.projectId) throw invalid("That stage isn't on this job. Pick the stage again.");
  const std = c.t.workspace.standardDayHours;
  const lines = input.entries.map((e) => {
    const crew = requireCrewOn(c, e.crewMemberId, input.date);
    if (e.basis === "time_only") {
      return { crew, basis: e.basis, quantity: 0, hours: e.hours, multiplier: null, rateCents: null, missingRate: false };
    }
    const rateCents = rateFor(c.ix.ratesOf(crew.id), crew.id, e.basis, null, stage.projectId, input.date);
    const days = e.basis === "daily" ? (e.days ?? 100) : null;
    const hours = days !== null && e.hours === 0 ? defaultHours(days, std) : e.hours;
    const multiplier = e.basis === "hourly" ? (e.multiplier ?? 100) : null;
    return {
      crew,
      basis: e.basis,
      quantity: days ?? hours,
      hours,
      multiplier,
      rateCents,
      missingRate: rateCents === null,
    };
  });
  const { logs, autoStarted } = write(c, actor, "crew_day", (w) => {
    const autoStarted = startStage(w, stage, input.date) !== null;
    const entryId = mutationId ?? w.base().id;
    const logs = lines.map((l) =>
      pushLog(w, {
        date: input.date,
        crewMemberId: l.crew.id,
        projectId: stage.projectId,
        stageId: stage.id,
        basis: l.basis,
        unit: null,
        quantity: l.quantity,
        hours: l.hours,
        multiplier: l.multiplier,
        rateCents: l.rateCents,
        amountCents: amountOf(l.basis, l.rateCents, l),
        missingRate: l.missingRate,
        source: "grid",
        adjustsLogId: null,
        progressEntryId: null,
        entryId,
        payRunId: null,
        enteredBy: actor.userId,
        mutationId,
        deletedAt: null,
      }),
    );
    return { logs, autoStarted };
  });
  return entryResult(
    actor,
    logs.map((l) => l.id),
    entryFlags(c, logs, autoStarted),
  );
}

/**
 * Progress entry (pay rules §4): the entry, its shares, and one per-unit log per person from
 * `pieceRateLines` (their own rate for the stage's unit; none → $0.00, flagged).
 */
function recordProgress(c: FakeContext, actor: Actor, input: ProgressInput, mutationId: Id | null): EntryResult {
  const stage = entryStage(c, actor, input.stageId);
  const unit = stage.unit;
  if (unit === null) {
    throw invalid("This stage has no unit, so progress isn't measured on it. Log the crew-day instead.");
  }
  if (unit === "each" && input.quantity % 100 !== 0) throw invalid("Count whole items for this stage, like 12.");
  const crew = input.crewMemberIds.map((id) => requireCrewOn(c, id, input.date));
  let lines;
  try {
    lines = pieceRateLines(
      input.quantity,
      unit,
      crew.map((m) => ({
        crewMemberId: m.id,
        rateCents: rateFor(c.ix.ratesOf(m.id), m.id, "per_unit", unit, stage.projectId, input.date),
      })),
      input.shares,
    );
  } catch {
    throw invalid("Shares must add up to 100%, one share per person.");
  }
  const bp =
    input.shares.mode === "equal"
      ? splitWeighted(
          10_000,
          crew.map(() => 1),
        )
      : [...input.shares.bp];
  const { entryId, logs, autoStarted } = write(c, actor, "progress", (w) => {
    const autoStarted = startStage(w, stage, input.date) !== null;
    const entry = {
      ...w.base(),
      stageId: stage.id,
      projectId: stage.projectId,
      date: input.date,
      quantity: input.quantity,
      splitMode: input.shares.mode,
      enteredBy: actor.userId,
      photoFileId: input.photoFileId,
      note: input.note,
      mutationId,
    };
    w.t.progressEntries.push(entry);
    crew.forEach((m, position) =>
      w.t.progressShares.push({
        ...w.base(),
        progressEntryId: entry.id,
        crewMemberId: m.id,
        position,
        shareBp: bp[position]!,
      }),
    );
    const logs = lines.map((line) =>
      pushLog(w, {
        date: input.date,
        crewMemberId: line.crewMemberId,
        projectId: stage.projectId,
        stageId: stage.id,
        basis: "per_unit",
        unit,
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
        enteredBy: actor.userId,
        mutationId,
        deletedAt: null,
      }),
    );
    return { entryId: entry.id, logs, autoStarted };
  });
  return entryResult(
    actor,
    [entryId, ...logs.map((l) => l.id)],
    entryFlags(c, logs, autoStarted),
  );
}

/**
 * No-work markers (product spec §5.5): unique per (person, date) — a second marker for the same day
 * replaces the reason and note. Someone already logged that day is refused (flows "No-work marker").
 */
function recordNoWork(c: FakeContext, actor: Actor, input: NoWorkInput): EntryResult {
  requireFieldWriter(c, actor);
  const crew = input.crewMemberIds.map((id) => requireCrewOn(c, id, input.date));
  for (const m of crew) {
    if (c.ix.loggedDays.has(`${m.id}|${input.date}`)) {
      const when = input.date === c.today ? "today" : `on ${dateText(c, input.date)}`;
      throw conflict(`${m.name} already has a log ${when} — remove it first to mark no work.`);
    }
  }
  const ids = write(c, actor, "no_work", (w) =>
    crew.map((m) => {
      const existing = w.t.noWork.find((n) => n.crewMemberId === m.id && n.date === input.date);
      if (existing) {
        const before = snapshot(existing);
        existing.reason = input.reason;
        existing.note = input.note;
        existing.enteredBy = actor.userId;
        existing.updatedAt = w.at;
        w.audit("no_work", existing.id, "update", before, snapshot(existing));
        return existing.id;
      }
      const row = {
        ...w.base(),
        crewMemberId: m.id,
        date: input.date,
        reason: input.reason,
        note: input.note,
        enteredBy: actor.userId,
      };
      w.t.noWork.push(row);
      return row.id;
    }),
  );
  return entryResult(actor, ids, []);
}

/** A live log an Owner/Manager may change, with the reasons some lines can't be changed alone. */
function editableLog(c: FakeContext, actor: Actor, logId: Id, verb: "edited" | "deleted"): WorkLogRow {
  requireEditor(c, actor);
  const log = c.ix.logs.get(logId);
  if (!log || log.deletedAt !== null) throw notFound("log");
  c.requireProject(actor, log.projectId);
  if (log.source === "progress")
    throw invalid(`This line comes from a progress entry, so it can't be ${verb} on its own.`);
  if (log.source === "lump_sum")
    throw invalid("Lump-sum lines come from marking the stage done. Reopen the stage to change them.");
  return log;
}

/** Pay rules §8: an adjustment log carrying only the difference, linked to the locked original. */
function pushAdjustment(
  w: WriteScope,
  actor: Actor,
  original: WorkLogRow,
  delta: { quantity: Hundredths; hours: Hundredths; amountCents: number },
): WorkLogRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, workspaceId, createdAt, updatedAt, ...fields } = original;
  const row = pushLog(w, {
    ...fields,
    quantity: delta.quantity,
    hours: delta.hours,
    amountCents: delta.amountCents,
    source: "adjustment",
    adjustsLogId: original.id,
    progressEntryId: null,
    entryId: w.base().id,
    payRunId: null,
    enteredBy: actor.userId,
    mutationId: null,
  });
  w.audit("work_log", row.id, "insert", null, snapshot(row));
  return row;
}

/**
 * Edit a grid log (Owner/Manager). Unlocked → changed in place; locked (in an approved pay run) →
 * an adjustment for the difference lands in the next draft (pay rules §8, E8.1).
 */
function editLog(
  c: FakeContext,
  actor: Actor,
  logId: Id,
  input: { hours?: Hundredths; days?: Hundredths; quantity?: Hundredths },
): EntryResult {
  const log = editableLog(c, actor, logId, "edited");
  if (log.source === "adjustment") throw invalid("An adjustment can't be edited. Edit the original line instead.");
  const std = c.t.workspace.standardDayHours;
  let edited: { quantity: Hundredths; hours: Hundredths };
  if (log.basis === "daily") {
    const days = input.days ?? log.quantity;
    if (days !== 100 && days !== 50) throw invalid("A day is 1 or ½.");
    edited = { quantity: days, hours: input.hours ?? (input.days !== undefined ? defaultHours(days, std) : log.hours) };
  } else {
    const hours = input.hours ?? log.hours;
    edited = { quantity: log.basis === "hourly" ? hours : log.quantity, hours };
  }
  if (log.basis !== "daily" && (edited.hours <= 0 || edited.hours % 25 !== 0)) {
    throw invalid("Hours go in quarter-hour steps, like 7.5 or 7.75.");
  }
  const amountCents = amountOf(log.basis, log.rateCents, { ...edited, multiplier: log.multiplier });
  const ids = write(c, actor, "log_edit", (w) => {
    if (log.payRunId !== null) {
      const delta = adjustmentDelta(log, { ...edited, amountCents });
      return delta === null ? [] : [pushAdjustment(w, actor, log, delta).id];
    }
    const before = snapshot(log);
    Object.assign(log, edited, { amountCents, updatedAt: w.at });
    w.audit("work_log", log.id, "update", before, snapshot(log));
    return [log.id];
  });
  return entryResult(actor, ids, []);
}

/** Delete a log (Owner/Manager): unlocked → removed; locked → a reversing adjustment (pay rules §8). */
function deleteLog(c: FakeContext, actor: Actor, logId: Id): EntryResult {
  const log = editableLog(c, actor, logId, "deleted");
  const ids = write(c, actor, "log_delete", (w) => {
    if (log.payRunId !== null) return [pushAdjustment(w, actor, log, reversal(log)).id];
    log.deletedAt = w.at;
    log.updatedAt = w.at;
    w.audit("work_log", log.id, "delete", snapshot({ ...log, deletedAt: null }), null);
    return [log.id];
  });
  return entryResult(actor, ids, []);
}
