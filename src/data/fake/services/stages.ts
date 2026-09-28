import { countWorkingDays } from "@/domain/dates";
import { lumpSumLines } from "@/domain/piece";
import { lostWorkingDays, pausePeriods, realWorkingDays } from "@/domain/segments";
import { splitWeighted } from "@/domain/split";
import type { LocalDate } from "@/domain/types";
import type {
  Actor,
  DoneProposal,
  Id,
  ProgressRowForeman,
  ProgressRowManager,
  StageActions,
  StageDetail,
  StageService,
} from "../../contracts";
import type { ProgressEntryRow, StageRow, WorkLogRow } from "../rows";
import { FIELD_ACCESS, forbidden, notYet, type FakeContext } from "./context";

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
          logs: logs.map((l) => c.logForeman(l)),
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

    start: () => notYet("stages.start"),
    pause: () => notYet("stages.pause"),
    resume: () => notYet("stages.resume"),
    confirmDone: () => notYet("stages.confirmDone"),
    reopen: () => notYet("stages.reopen"),
    setManualPct: () => notYet("stages.setManualPct"),
  };
}
