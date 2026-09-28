import { resolveRate } from "@/domain/rates";
import type { LocalDate } from "@/domain/types";
import type {
  Actor,
  CrewDayDefaults,
  DateRange,
  GridCrewForeman,
  GridCrewManager,
  Id,
  LogList,
  LogService,
  NoWorkRow,
  NoWorkService,
  ProgressDefaults,
  ProgressService,
  ProjectPick,
  SameAsYesterday,
} from "../../contracts";
import { gridBasisFor } from "../grid-basis";
import type { StageRow, WorkLogRow } from "../rows";
import { FIELD_ACCESS, forbidden, notFound, notYet, shortName, type FakeContext } from "./context";
import { crewRowForeman } from "./crew";
import { progressRowForeman, progressRowManager } from "./stages";

/** How many recent-stage chips the entry screens offer. */
export const LATEST_STAGES = 5;

const byRecent = (a: WorkLogRow, b: WorkLogRow) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

function logList(c: FakeContext, actor: Actor, logs: WorkLogRow[]): LogList {
  if (c.isForeman(actor))
    return { view: "foreman", access: FIELD_ACCESS, rows: logs.map((l) => c.logForeman(l)) };
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

    saveCrewDay: () => notYet("logs.saveCrewDay"),
    editLog: () => notYet("logs.editLog"),
    deleteLog: () => notYet("logs.deleteLog"),
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

    record: () => notYet("progress.record"),
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
    record: () => notYet("noWork.record"),
    remove: () => notYet("noWork.remove"),
  };
}
