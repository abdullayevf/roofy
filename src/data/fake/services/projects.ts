import { addDays } from "@/domain/dates";
import { sum } from "@/domain/money";
import type {
  Actor,
  Client,
  CrewWeekForeman,
  CrewWeekManager,
  Id,
  JobType,
  ProjectDetail,
  ProjectList,
  ProjectRowForeman,
  ProjectRowManager,
  ProjectService,
  ProjectStatus,
  StageProposal,
  StageRowForeman,
  StageRowManager,
} from "../../contracts";
import type { StageFigures } from "../figures";
import type { ProjectRow, WorkLogRow } from "../rows";
import { FIELD_ACCESS, forbidden, notYet, type FakeContext } from "./context";

/** How many recent logs a job page shows. */
export const RECENT_LOGS = 20;

const STATUS_ORDER: readonly ProjectStatus[] = ["active", "on_hold", "quoted", "complete", "closed"];

const byRecent = (a: WorkLogRow, b: WorkLogRow) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function stageRowForeman(c: FakeContext, sf: StageFigures): StageRowForeman {
  const st = sf.stage;
  return {
    id: st.id,
    name: st.name,
    position: st.position,
    status: st.status,
    unit: st.unit,
    quantityDone: sf.measured,
    plannedQuantity: st.budgetQty,
    pctBp: sf.pctBp,
    tape: { pctBp: sf.pctBp },
    pause: c.fig.pauseOf(st.id),
    completedOn: st.completedOn,
    lumpSumStage: st.lumpSumCents !== null,
  };
}

export function stageRowManager(c: FakeContext, sf: StageFigures): StageRowManager {
  const st = sf.stage;
  return {
    ...stageRowForeman(c, sf),
    tape: sf.tape,
    labourBudgetCents: st.labourBudgetCents,
    labourActualCents: sf.actualCents,
    forecastLabourCents: sf.forecastCents,
    materialsBudgetCents: st.materialsBudgetCents,
    lumpSumCents: st.lumpSumCents,
    manualPctBp: st.manualPctBp,
    alert: sf.alert,
  };
}

export function createProjectService(c: FakeContext): ProjectService {
  function rowForeman(p: ProjectRow): ProjectRowForeman {
    const client = c.ix.clients.get(p.clientId)!;
    const f = c.fig.project(p.id);
    return {
      id: p.id,
      name: p.nickname,
      client: { id: client.id, name: client.name },
      siteAddress: p.siteAddress,
      jobType: p.jobType,
      status: p.status,
      pctBp: f.pctBp,
      currentStages: c.fig.currentStages(p.id),
      daysSinceLastLog: f.daysSinceLastLog,
    };
  }

  function rowManager(p: ProjectRow): ProjectRowManager {
    const f = c.fig.project(p.id);
    return {
      ...rowForeman(p),
      contractCents: p.contractValueCents,
      labourActualCents: f.labourActualCents,
      labourBudgetCents: f.labourBudgetCents,
      forecastMarginCents: f.margins.forecastMarginCents,
      alert: f.alert,
    };
  }

  /** The last 7 days up to today (a rolling "this week", so Monday morning isn't empty). */
  function crewWeek(projectId: Id): { crewMemberId: Id; name: string; logs: WorkLogRow[] }[] {
    const from = addDays(c.today, -6);
    const logs = c.ix.logsOfProject(projectId).filter((l) => l.date >= from && l.date <= c.today);
    const byCrew = new Map<Id, WorkLogRow[]>();
    for (const l of logs) byCrew.set(l.crewMemberId, [...(byCrew.get(l.crewMemberId) ?? []), l]);
    return [...byCrew]
      .map(([crewMemberId, list]) => ({ crewMemberId, name: c.fig.crewOf(crewMemberId).name, logs: list }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const weekForeman = (w: ReturnType<typeof crewWeek>[number]): CrewWeekForeman => ({
    crewMemberId: w.crewMemberId,
    name: w.name,
    days: new Set(w.logs.map((l) => l.date)).size,
    hours: sum(w.logs.map((l) => l.hours)),
  });

  return {
    async list(actor: Actor, filter?: { status?: ProjectStatus | "all" }): Promise<ProjectList> {
      const status = filter?.status ?? "active";
      const visible = c.visibleProjects(actor);
      const rows = c.t.projects
        .filter((p) => (status === "all" || p.status === status) && (visible === null || visible.has(p.id)))
        .sort(
          (a, b) =>
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
            (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
            a.nickname.localeCompare(b.nickname),
        );
      if (visible !== null) return { view: "foreman", access: FIELD_ACCESS, rows: rows.map(rowForeman) };
      return { view: "manager", access: c.access(actor), rows: rows.map(rowManager) };
    },

    async get(actor: Actor, projectId: Id): Promise<ProjectDetail> {
      const p = c.requireProject(actor, projectId);
      const client = c.ix.clients.get(p.clientId)!;
      const f = c.fig.project(p.id);
      const logs = [...c.ix.logsOfProject(p.id)].sort(byRecent).slice(0, RECENT_LOGS);
      const expenses = [...c.ix.expensesOf(p.id)].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
      const files = c.ix.filesOf("project", p.id).map((x) => c.fileRef(x));
      if (c.isForeman(actor)) {
        return {
          view: "foreman",
          access: FIELD_ACCESS,
          id: p.id,
          name: p.nickname,
          client: { id: client.id, name: client.name },
          siteAddress: p.siteAddress,
          jobType: p.jobType,
          status: p.status,
          pctBp: f.pctBp,
          stages: f.stages.map((s) => stageRowForeman(c, s)),
          crewThisWeek: crewWeek(p.id).map(weekForeman),
          recentLogs: logs.map((l) => c.logForeman(l)),
          expenses: expenses.map((e) => c.expenseForeman(e)),
          files,
        };
      }
      return {
        view: "manager",
        access: c.access(actor),
        id: p.id,
        name: p.nickname,
        client: { id: client.id, name: client.name, phone: client.phone, email: client.email },
        siteAddress: p.siteAddress,
        jobType: p.jobType,
        status: p.status,
        startDate: p.startDate,
        targetFinish: p.targetFinish,
        pctBp: f.pctBp,
        contractCents: p.contractValueCents,
        labour: {
          actualCents: f.labourActualCents,
          budgetCents: f.labourBudgetCents,
          expectedCents: f.labourExpectedCents,
        },
        materials: { actualCents: f.materialsActualCents, budgetCents: f.materialsBudgetCents },
        expensesCents: f.expensesCents,
        margins: f.margins,
        alert: f.alert,
        stages: f.stages.map((s) => stageRowManager(c, s)),
        crewThisWeek: crewWeek(p.id).map((w): CrewWeekManager => ({
          ...weekForeman(w),
          labourCostCents: c.fig.labourOf(w.logs),
        })),
        recentLogs: logs.map((l) => c.logManager(l)),
        expenses: expenses.map((e) => c.expenseManager(e)),
        files,
      };
    },

    /** Product spec §5.2: from the last project of the same job type, else the template. */
    async proposeStages(actor: Actor, jobType: JobType): Promise<StageProposal> {
      c.access(actor);
      const last = c.t.projects
        .filter((p) => p.jobType === jobType && c.ix.stagesOf(p.id).length > 0)
        .sort((a, b) => (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt))[0];
      if (last) {
        return {
          jobType,
          source: { kind: "last_job", projectId: last.id, projectName: last.nickname },
          stages: c.ix.stagesOf(last.id).map((s) => ({
            name: s.name,
            position: s.position,
            unit: s.unit,
            plannedQuantity: s.budgetQty,
            labourBudgetCents: s.labourBudgetCents,
            materialsBudgetCents: s.materialsBudgetCents,
            lumpSumCents: s.lumpSumCents,
          })),
        };
      }
      const template = c.t.stageTemplates.find((x) => x.jobType === jobType);
      if (!template) throw forbidden("There's no stage template for this job type yet.");
      return {
        jobType,
        source: { kind: "template", templateId: template.id },
        stages: c.t.stageTemplateItems
          .filter((i) => i.templateId === template.id)
          .sort((a, b) => a.position - b.position)
          .map((i) => ({
            name: i.name,
            position: i.position,
            unit: i.defaultUnit,
            plannedQuantity: null,
            labourBudgetCents: 0,
            materialsBudgetCents: 0,
            lumpSumCents: null,
          })),
      };
    },

    async clients(actor: Actor): Promise<Client[]> {
      c.access(actor);
      const counts = new Map<Id, number>();
      for (const p of c.t.projects) counts.set(p.clientId, (counts.get(p.clientId) ?? 0) + 1);
      return c.t.clients
        .map((x) => ({
          id: x.id,
          name: x.name,
          phone: x.phone,
          email: x.email,
          address: x.address,
          projectCount: counts.get(x.id) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    create: () => notYet("projects.create"),
    update: () => notYet("projects.update"),
    updateStage: () => notYet("projects.updateStage"),
    createClient: () => notYet("projects.createClient"),
  };
}
