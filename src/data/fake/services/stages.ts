import { reversal } from "@/domain/adjustments";
import { addDays, countWorkingDays } from "@/domain/dates";
import { lumpSumLines } from "@/domain/piece";
import { lostWorkingDays, pausePeriods, realWorkingDays } from "@/domain/segments";
import { splitWeighted } from "@/domain/split";
import type { LocalDate } from "@/domain/types";
import type {
  Actor,
  DoneProposal,
  EntryResult,
  Id,
  ManualPctBp,
  ProgressRowForeman,
  ProgressRowManager,
  StageActions,
  StageDetail,
  StageDoneInput,
  StagePauseInput,
  StageResumeInput,
  StageService,
} from "../../contracts";
import type { ProgressEntryRow, StageRow, WorkLogRow } from "../rows";
import { FakeContext, FIELD_ACCESS, forbidden } from "./context";
import {
  conflict,
  dateText,
  entryFlags,
  entryResult,
  invalid,
  lastSegment,
  openSegment,
  requireCrewOn,
  requireEditor,
  requireFieldWriter,
  snapshot,
  startStage,
  write,
} from "./writes";

const byRecent = (a: WorkLogRow, b: WorkLogRow) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function progressRowForeman(c: FakeContext, p: ProgressEntryRow): ProgressRowForeman {
  const stage = c.ix.stages.get(p.stageId)!;
  const logs = c.ix.logsOfProgress(p.id);
  return {
    id: p.id,
    stageId: p.stageId,
    date: p.date,
    quantity: p.quantity,
    unit: stage.unit!,
    enteredByName: c.memberName(p.enteredBy),
    hasPhoto: p.photoFileId !== null,
    split: c.ix.sharesOf(p.id).map((s) => ({
      crewMemberId: s.crewMemberId,
      name: c.fig.crewOf(s.crewMemberId).name,
      shareBp: s.shareBp,
      quantity: logs.find((l) => l.crewMemberId === s.crewMemberId)?.quantity ?? 0,
    })),
  };
}

export function progressRowManager(c: FakeContext, p: ProgressEntryRow): ProgressRowManager {
  const logs = c.ix.logsOfProgress(p.id);
  const row = progressRowForeman(c, p);
  return {
    ...row,
    split: row.split.map((s) => {
      const log = logs.find((l) => l.crewMemberId === s.crewMemberId);
      return {
        ...s,
        rateCents: log?.rateCents ?? null,
        amountCents: log?.amountCents ?? 0,
        missingRate: log?.missingRate ?? false,
        logId: log?.id ?? "",
      };
    }),
  };
}

/** Everyone who logged on the stage (not lump-sum lines), in first-log order (pay rules §5). */
export function stageLoggers(c: FakeContext, stageId: Id): Id[] {
  const logs = c.ix
    .logsOfStage(stageId)
    .filter((l) => l.basis !== "lump_sum")
    .map((l, i) => ({ l, i }))
    .sort(
      (a, b) => a.l.date.localeCompare(b.l.date) || a.l.createdAt.localeCompare(b.l.createdAt) || a.i - b.i,
    );
  return [...new Set(logs.map(({ l }) => l.crewMemberId))];
}

function actionsFor(actor: Actor, st: StageRow): StageActions {
  const none: StageActions = {
    canStart: false,
    canPause: false,
    canResume: false,
    canMarkDone: false,
    canReopen: false,
    canSetManualPct: false,
  };
  if (actor.role === "accountant") return none;
  if (actor.role === "foreman") {
    return { ...none, canPause: st.status === "active", canResume: st.status === "paused" };
  }
  return {
    canStart: st.status === "not_started",
    canPause: st.status === "active",
    canResume: st.status === "paused",
    canMarkDone: st.status === "active" || st.status === "paused",
    canReopen: st.status === "done",
    canSetManualPct: st.status !== "done" && (st.unit === null || st.budgetQty === null),
  };
}

export function createStageService(c: FakeContext): StageService {
  return {
    async get(actor: Actor, stageId: Id): Promise<StageDetail> {
      const st = c.requireStage(actor, stageId);
      const sf = c.fig.stage(st.id);
      const wd = c.t.workspace.workingDays;
      const today = c.today;
      const project = c.ix.projects.get(st.projectId)!;
      const progress = [...c.ix.progressOf(st.id)].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
      const logs = [...c.ix.logsOfStage(st.id)].sort(byRecent);
      const base = {
        id: st.id,
        projectId: st.projectId,
        projectName: project.nickname,
        name: st.name,
        position: st.position,
        status: st.status,
        unit: st.unit,
        quantityDone: sf.measured,
        plannedQuantity: st.budgetQty,
        pctBp: sf.pctBp,
        completedOn: st.completedOn,
        completionNote: st.completionNote,
        segments: c.ix.segmentRowsOf(st.id).map((g) => ({
          start: g.startDate,
          end: g.endDate,
          pauseReason: g.pauseReason,
          pauseNote: g.pauseNote,
        })),
        pauses: pausePeriods(sf.segments, today).map((p) => ({
          ...p,
          workingDays: countWorkingDays(p.start, p.end, wd),
        })),
        lostDays: lostWorkingDays(sf.segments, wd, today),
        realWorkingDays: realWorkingDays(sf.segments, wd, today),
        pausedTooLong: c.fig.pausedTooLong(st.id),
        actions: actionsFor(actor, st),
      };
      if (c.isForeman(actor)) {
        return {
          ...base,
          view: "foreman",
          access: FIELD_ACCESS,
          tape: { pctBp: sf.pctBp },
          progress: progress.map((p) => progressRowForeman(c, p)),
          logs: FakeContext.fieldLogs(logs).map((l) => c.logForeman(l)),
        };
      }
      const lumpLogs = logs.filter((l) => l.basis === "lump_sum");
      return {
        ...base,
        view: "manager",
        access: c.access(actor),
        tape: sf.tape,
        labourBudgetCents: st.labourBudgetCents,
        materialsBudgetCents: st.materialsBudgetCents,
        lumpSumCents: st.lumpSumCents,
        manualPctBp: st.manualPctBp,
        labourActualCents: sf.actualCents,
        forecastLabourCents: sf.forecastCents,
        alert: sf.alert,
        forecastWorking:
          st.status === "not_started"
            ? null
            : { actualCents: sf.actualCents, pctBp: sf.pctBp, forecastCents: sf.forecastCents },
        progress: progress.map((p) => progressRowManager(c, p)),
        logs: logs.map((l) => c.logManager(l)),
        lumpSumShares: c.ix.completionSharesOf(st.id).map((s) => ({
          crewMemberId: s.crewMemberId,
          name: c.fig.crewOf(s.crewMemberId).name,
          shareBp: s.shareBp,
          amountCents: lumpLogs.find((l) => l.crewMemberId === s.crewMemberId)?.amountCents ?? 0,
        })),
      };
    },

    /** Stage Done (manager/owner): an equal split of the lump sum among everyone who logged. */
    async doneProposal(actor: Actor, stageId: Id, completedOn?: LocalDate): Promise<DoneProposal> {
      if (!c.access(actor).canEdit) throw forbidden();
      const st = c.requireStage(actor, stageId);
      const crewIds = stageLoggers(c, st.id);
      const shares =
        crewIds.length === 0
          ? []
          : splitWeighted(
              10_000,
              crewIds.map(() => 1),
            );
      const amounts =
        st.lumpSumCents === null || crewIds.length === 0
          ? crewIds.map(() => 0)
          : lumpSumLines(st.lumpSumCents, crewIds, { mode: "equal" }).map((l) => l.amountCents);
      return {
        stageId: st.id,
        stageName: st.name,
        projectId: st.projectId,
        projectName: c.ix.projects.get(st.projectId)!.nickname,
        completedOn: completedOn ?? c.today,
        lumpSumCents: st.lumpSumCents,
        crew: crewIds.map((id, i) => ({
          crewMemberId: id,
          name: c.fig.crewOf(id).name,
          shareBp: shares[i]!,
          amountCents: amounts[i]!,
        })),
      };
    },

    /** Start a Not started stage from `date` (Owner/Manager; logging starts it automatically too). */
    async start(actor: Actor, stageId: Id, date: LocalDate): Promise<EntryResult> {
      requireEditor(c, actor);
      const st = c.requireStage(actor, stageId);
      if (st.status !== "not_started") throw conflict("This stage has already started.");
      const seg = write(c, actor, "stage_start", (w) => {
        const seg = startStage(w, st, date)!;
        w.audit("stage", st.id, "update", { status: "not_started" }, { status: "active", start: date });
        return seg;
      });
      return entryResult(actor, [seg.id], []);
    },

    async pause(actor: Actor, input: StagePauseInput): Promise<EntryResult> {
      return pauseStage(c, actor, input);
    },

    async resume(actor: Actor, input: StageResumeInput): Promise<EntryResult> {
      return resumeStage(c, actor, input);
    },

    async confirmDone(actor: Actor, input: StageDoneInput): Promise<EntryResult> {
      return confirmDone(c, actor, input);
    },

    async reopen(actor: Actor, stageId: Id): Promise<EntryResult> {
      return reopenStage(c, actor, stageId);
    },

    /** Manual % for a stage without a measured unit (pay rules §12). Owner/Manager. */
    async setManualPct(actor: Actor, stageId: Id, pctBp: ManualPctBp): Promise<EntryResult> {
      requireEditor(c, actor);
      const st = c.requireStage(actor, stageId);
      if (st.status === "done") throw conflict("This stage is done. Reopen it to change its progress.");
      if (st.unit !== null && st.budgetQty !== null)
        throw invalid("This stage's progress comes from its measured quantity, not a manual %.");
      write(c, actor, "stage_manual_pct", (w) => {
        w.audit("stage", st.id, "update", { manualPctBp: st.manualPctBp }, { manualPctBp: pctBp });
        st.manualPctBp = pctBp;
        st.updatedAt = w.at;
      });
      return entryResult(actor, [st.id], []);
    },
  };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Pause (product spec §5.3; Owner, Manager, Foreman on assigned jobs): closes the open segment at
 * `date` (the first day not worked) with the reason and note. Already paused → nothing changes.
 */
function pauseStage(c: FakeContext, actor: Actor, input: StagePauseInput): EntryResult {
  requireFieldWriter(c, actor);
  const st = c.requireStage(actor, input.stageId);
  if (st.status === "done") throw conflict("This stage was marked Done, so it can't be paused.");
  if (st.status === "not_started")
    throw conflict("This stage hasn't started yet, so there's nothing to pause.");
  if (st.status === "paused") return entryResult(actor, [], []);
  const open = openSegment(c.t, st.id)!;
  if (input.date <= open.startDate) {
    throw invalid(
      `This stage started on ${dateText(c, open.startDate)}. Pick the first day not worked, after that.`,
    );
  }
  write(c, actor, "stage_pause", (w) => {
    open.endDate = input.date;
    open.pauseReason = input.reason;
    open.pauseNote = input.note;
    open.updatedAt = w.at;
    st.status = "paused";
    st.updatedAt = w.at;
    w.audit("stage", st.id, "update", { status: "active" }, { status: "paused", pauseReason: input.reason });
  });
  return entryResult(actor, [open.id], []);
}

/** Resume: opens a new segment from `date` (the first day worked again). Already active → no change. */
function resumeStage(c: FakeContext, actor: Actor, input: StageResumeInput): EntryResult {
  requireFieldWriter(c, actor);
  const st = c.requireStage(actor, input.stageId);
  if (st.status === "done") throw conflict("This stage was marked Done. Ask your manager to reopen it.");
  if (st.status === "not_started")
    throw conflict("This stage hasn't started yet. Log work on it to start it.");
  if (st.status === "active") return entryResult(actor, [], []);
  const last = lastSegment(c.t, st.id)!;
  if (input.date < last.endDate!) {
    throw invalid(`This stage was paused from ${dateText(c, last.endDate!)}. Pick that day or later.`);
  }
  const seg = write(c, actor, "stage_resume", (w) => {
    const seg = {
      ...w.base(),
      stageId: st.id,
      startDate: input.date,
      endDate: null,
      pauseReason: null,
      pauseNote: null,
    };
    w.t.stageSegments.push(seg);
    st.status = "active";
    st.updatedAt = w.at;
    w.audit("stage", st.id, "update", { status: "paused" }, { status: "active", resumedOn: input.date });
    return seg;
  });
  return entryResult(actor, [seg.id], []);
}

/**
 * Done (Owner/Manager only): closes the open segment at completion + 1 day, and on a lump-sum stage
 * splits the lump sum over the confirmed people with `lumpSumLines` (pay rules §5) — one log each,
 * dated the completion date.
 */
function confirmDone(c: FakeContext, actor: Actor, input: StageDoneInput): EntryResult {
  requireEditor(c, actor);
  const st = c.requireStage(actor, input.stageId);
  if (st.status === "done") throw conflict("This stage is already done.");
  if (st.status === "not_started") throw conflict("This stage hasn't started yet. Log work on it first.");
  const last = lastSegment(c.t, st.id)!;
  if (input.completedOn < last.startDate) {
    throw invalid(`Pick a completion date on or after ${dateText(c, last.startDate)}.`);
  }
  const lump = st.lumpSumCents;
  let lines: ReturnType<typeof lumpSumLines> = [];
  if (lump !== null) {
    if (input.crewMemberIds.length === 0) throw invalid("Pick who shares the lump sum.");
    for (const id of input.crewMemberIds) requireCrewOn(c, id, input.completedOn);
    try {
      lines = lumpSumLines(lump, input.crewMemberIds, input.shares);
    } catch {
      throw invalid("Shares must add up to 100%, one share per person.");
    }
  }
  const bp =
    input.shares.mode === "equal"
      ? splitWeighted(
          10_000,
          input.crewMemberIds.map(() => 1),
        )
      : [...input.shares.bp];
  const logs = write(c, actor, "stage_done", (w) => {
    const open = openSegment(w.t, st.id);
    if (open) {
      open.endDate = addDays(input.completedOn, 1);
      open.updatedAt = w.at;
    }
    const before = { status: st.status };
    st.status = "done";
    st.completedOn = input.completedOn;
    st.completionNote = input.note;
    st.updatedAt = w.at;
    w.audit("stage", st.id, "update", before, { status: "done", completedOn: input.completedOn });
    if (lump === null) return [];
    input.crewMemberIds.forEach((crewMemberId, i) =>
      w.t.stageCompletionShares.push({ ...w.base(), stageId: st.id, crewMemberId, shareBp: bp[i]! }),
    );
    const entryId = w.base().id;
    return lines.map((line) => {
      const row = {
        ...w.base(),
        date: input.completedOn,
        crewMemberId: line.crewMemberId,
        projectId: st.projectId,
        stageId: st.id,
        basis: "lump_sum" as const,
        unit: null,
        quantity: 0,
        hours: line.hours,
        multiplier: null,
        rateCents: null,
        amountCents: line.amountCents,
        missingRate: false,
        source: "lump_sum" as const,
        adjustsLogId: null,
        progressEntryId: null,
        entryId,
        payRunId: null,
        enteredBy: actor.userId,
        mutationId: null,
        deletedAt: null,
      };
      w.t.workLogs.push(row);
      return row;
    });
  });
  return entryResult(actor, [st.id, ...logs.map((l) => l.id)], entryFlags(c, logs));
}

/**
 * Reopen a Done stage (Owner/Manager; pay rules §5 step 4): lump-sum logs not yet in an approved pay
 * run are deleted; locked ones get a reversing adjustment in the next draft (§8). The segment Done
 * closed opens again (Active); a stage that was paused when marked Done goes back to Paused.
 */
function reopenStage(c: FakeContext, actor: Actor, stageId: Id): EntryResult {
  requireEditor(c, actor);
  const st = c.requireStage(actor, stageId);
  if (st.status !== "done") throw conflict("This stage isn't done, so there's nothing to reopen.");
  const lumpLogs = c.ix.logsOfStage(st.id).filter((l) => l.source === "lump_sum");
  const reversed = new Set(c.ix.liveLogs.filter((l) => l.adjustsLogId !== null).map((l) => l.adjustsLogId));
  const ids = write(c, actor, "stage_reopen", (w) => {
    const last = lastSegment(w.t, st.id)!;
    const closedByDone = last.pauseReason === null && last.endDate === addDays(st.completedOn!, 1);
    if (closedByDone) {
      last.endDate = null;
      last.updatedAt = w.at;
    }
    w.audit(
      "stage",
      st.id,
      "update",
      { status: "done", completedOn: st.completedOn },
      {
        status: closedByDone ? "active" : "paused",
      },
    );
    st.status = closedByDone ? "active" : "paused";
    st.completedOn = null;
    st.completionNote = null;
    st.updatedAt = w.at;
    w.t.stageCompletionShares = w.t.stageCompletionShares.filter((s) => s.stageId !== st.id);
    const out: Id[] = [];
    for (const log of lumpLogs) {
      if (log.payRunId === null) {
        log.deletedAt = w.at;
        log.updatedAt = w.at;
        w.audit("work_log", log.id, "delete", snapshot({ ...log, deletedAt: null }), null);
        continue;
      }
      if (reversed.has(log.id)) continue;
      const delta = reversal(log);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, workspaceId, createdAt, updatedAt, ...fields } = log;
      const row = {
        ...fields,
        ...w.base(),
        quantity: delta.quantity,
        hours: delta.hours,
        amountCents: delta.amountCents,
        source: "adjustment" as const,
        adjustsLogId: log.id,
        entryId: w.base().id,
        payRunId: null,
        enteredBy: actor.userId,
        mutationId: null,
      };
      w.t.workLogs.push(row);
      w.audit("work_log", row.id, "insert", null, snapshot(row));
      out.push(row.id);
    }
    return out;
  });
  return entryResult(actor, ids, []);
}
