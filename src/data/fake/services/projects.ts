import { addDays } from "@/domain/dates";
import { sum } from "@/domain/money";
import type {
  Actor,
  Client,
  CrewWeekForeman,
  CrewWeekManager,
  Id,
  JobType,
  ClientInput,
  ProjectDetail,
  ProjectInput,
  ProjectList,
  ProjectRowForeman,
  ProjectRowManager,
  ProjectService,
  ProjectStatus,
  StageDraft,
  StageInput,
  StageProposal,
  StageRowForeman,
  StageRowManager,
} from "../../contracts";
import type { StageFigures } from "../figures";
import type { ProjectRow, StageRow, WorkLogRow } from "../rows";
import { FakeContext, FIELD_ACCESS, forbidden } from "./context";
import { invalid, requireEditor, snapshot, write, type WriteScope } from "./writes";

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

  /**
   * The last 7 days up to today (a rolling "this week", so Monday morning isn't empty). The field view
   * leaves out adjustments (pay-run artefacts, pay rules §8), so they add no days or hours there.
   */
  function crewWeek(projectId: Id, field: boolean): { crewMemberId: Id; name: string; logs: WorkLogRow[] }[] {
    const from = addDays(c.today, -6);
    const all = c.ix.logsOfProject(projectId).filter((l) => l.date >= from && l.date <= c.today);
    const logs = field ? FakeContext.fieldLogs(all) : all;
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

  /** Product spec §5.2: stages from the last project of the same job type, else the template. */
  function proposal(jobType: JobType): StageProposal {
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
  }

  function requireClient(clientId: Id) {
    if (!c.ix.clients.has(clientId)) throw invalid("Pick a client from the list, or add a new one.");
  }

  function pushStage(w: WriteScope, projectId: Id, d: StageDraft): StageRow {
    const row: StageRow = {
      ...w.base(),
      projectId,
      name: d.name,
      position: d.position,
      status: "not_started",
      unit: d.unit,
      budgetQty: d.unit === null ? null : d.plannedQuantity,
      labourBudgetCents: d.labourBudgetCents,
      materialsBudgetCents: d.materialsBudgetCents,
      lumpSumCents: d.lumpSumCents,
      manualPctBp: null,
      completedOn: null,
      completionNote: null,
    };
    w.t.stages.push(row);
    return row;
  }

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
      const all = [...c.ix.logsOfProject(p.id)].sort(byRecent);
      const logs = all.slice(0, RECENT_LOGS);
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
          crewThisWeek: crewWeek(p.id, true).map(weekForeman),
          recentLogs: FakeContext.fieldLogs(all)
            .slice(0, RECENT_LOGS)
            .map((l) => c.logForeman(l)),
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
        crewThisWeek: crewWeek(p.id, false).map((w): CrewWeekManager => ({
          ...weekForeman(w),
          labourCostCents: c.fig.labourOf(w.logs),
        })),
        recentLogs: logs.map((l) => c.logManager(l)),
        expenses: expenses.map((e) => c.expenseManager(e)),
        files,
      };
    },

    async proposeStages(actor: Actor, jobType: JobType): Promise<StageProposal> {
      c.access(actor);
      return proposal(jobType);
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

    /** New job (Owner/Manager): the accepted stages, else the proposal (last same-type job or template). */
    async create(actor: Actor, input: ProjectInput): Promise<{ id: Id }> {
      requireEditor(c, actor);
      requireClient(input.clientId);
      const stages = input.stages ?? proposal(input.jobType).stages;
      const id = write(c, actor, "project_create", (w) => {
        const row: ProjectRow = {
          ...w.base(),
          clientId: input.clientId,
          siteAddress: input.siteAddress,
          nickname: input.nickname,
          jobType: input.jobType,
          contractValueCents: input.contractCents,
          status: input.status,
          startDate: input.startDate,
          targetFinish: input.targetFinish,
        };
        w.t.projects.push(row);
        w.audit("project", row.id, "insert", null, snapshot(row));
        [...stages]
          .sort((a, b) => a.position - b.position)
          .forEach((d, i) => pushStage(w, row.id, { ...d, position: i + 1 }));
        return row.id;
      });
      return { id };
    },

    /** Job fields (Owner/Manager); stages change through `updateStage`. Audited. */
    async update(actor: Actor, projectId: Id, input: Partial<ProjectInput>): Promise<{ id: Id }> {
      requireEditor(c, actor);
      const p = c.requireProject(actor, projectId);
      if (input.clientId !== undefined) requireClient(input.clientId);
      write(c, actor, "project_update", (w) => {
        const before = snapshot(p);
        if (input.clientId !== undefined) p.clientId = input.clientId;
        if (input.nickname !== undefined) p.nickname = input.nickname;
        if (input.siteAddress !== undefined) p.siteAddress = input.siteAddress;
        if (input.jobType !== undefined) p.jobType = input.jobType;
        if (input.contractCents !== undefined) p.contractValueCents = input.contractCents;
        if (input.status !== undefined) p.status = input.status;
        if (input.startDate !== undefined) p.startDate = input.startDate;
        if (input.targetFinish !== undefined) p.targetFinish = input.targetFinish;
        p.updatedAt = w.at;
        w.audit("project", p.id, "update", before, snapshot(p));
      });
      return { id: p.id };
    },

    /** A stage's plan (Owner/Manager). The unit can't change once progress is measured in it. */
    async updateStage(actor: Actor, stageId: Id, input: Partial<StageInput>): Promise<{ id: Id }> {
      requireEditor(c, actor);
      const st = c.requireStage(actor, stageId);
      if (input.unit !== undefined && input.unit !== st.unit && c.ix.progressOf(st.id).length > 0)
        throw invalid("This stage already has progress in its unit, so the unit can't change.");
      write(c, actor, "stage_update", (w) => {
        const before = snapshot(st);
        if (input.name !== undefined) st.name = input.name;
        if (input.position !== undefined) st.position = input.position;
        if (input.unit !== undefined) st.unit = input.unit;
        if (input.plannedQuantity !== undefined) st.budgetQty = input.plannedQuantity;
        if (st.unit === null) st.budgetQty = null;
        if (input.labourBudgetCents !== undefined) st.labourBudgetCents = input.labourBudgetCents;
        if (input.materialsBudgetCents !== undefined) st.materialsBudgetCents = input.materialsBudgetCents;
        if (input.lumpSumCents !== undefined) st.lumpSumCents = input.lumpSumCents;
        st.updatedAt = w.at;
        w.audit("stage", st.id, "update", before, snapshot(st));
      });
      return { id: st.id };
    },

    async createClient(actor: Actor, input: ClientInput): Promise<Client> {
      requireEditor(c, actor);
      const row = write(c, actor, "client_create", (w) => {
        const row = { ...w.base(), ...input };
        w.t.clients.push(row);
        return row;
      });
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        projectCount: 0,
      };
    },
  };
}
