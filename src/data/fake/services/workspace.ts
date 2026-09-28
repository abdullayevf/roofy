import type {
  Actor,
  CrewLevel,
  ExpenseCategory,
  Id,
  Member,
  StageTemplate,
  WorkspaceService,
  WorkspaceView,
} from "../../contracts";
import { FIELD_ACCESS, type FakeContext, notYet } from "./context";

export function createWorkspaceService(c: FakeContext): WorkspaceService {
  const members = (): Member[] =>
    c.t.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      twoFactorEnabled: m.role === "owner" ? c.ownerTwoFactor : m.twoFactorEnabled,
      projectIds: m.role === "foreman" ? [...c.ix.assignedProjects(m.id)] : [],
    }));

  return {
    async settings(actor: Actor): Promise<WorkspaceView> {
      const w = c.t.workspace;
      if (c.isForeman(actor)) {
        return {
          view: "foreman",
          access: FIELD_ACCESS,
          workspace: {
            id: w.id,
            name: w.name,
            timezone: w.timezone,
            workingDays: [...w.workingDays],
            standardDayHours: w.standardDayHours,
          },
        };
      }
      return {
        view: "manager",
        access: c.access(actor),
        settings: {
          id: w.id,
          name: w.name,
          abn: w.abn,
          gstRegistered: w.gstRegistered,
          timezone: w.timezone,
          payFrequency: w.payPeriod,
          payWeekStart: w.payWeekStart,
          payAnchor: w.payAnchor,
          workingDays: [...w.workingDays],
          standardDayHours: w.standardDayHours,
          onCostBp: w.onCostBp,
        },
        ownerTwoFactor: c.ownerTwoFactor,
      };
    },

    async levels(actor: Actor): Promise<CrewLevel[]> {
      c.access(actor);
      return [...c.t.crewLevels]
        .sort((a, b) => a.position - b.position)
        .map((lv) => ({
          id: lv.id,
          name: lv.name,
          floorRateCents: lv.floorRateCents,
          position: lv.position,
          crewCount: c.t.crewMembers.filter((m) => m.levelId === lv.id && m.activeTo === null).length,
        }));
    },

    async categories(actor: Actor): Promise<ExpenseCategory[]> {
      c.check(actor);
      return [...c.t.expenseCategories]
        .sort((a, b) => a.position - b.position)
        .map((x) => ({ id: x.id, name: x.name, position: x.position }));
    },

    async templates(actor: Actor): Promise<StageTemplate[]> {
      c.access(actor);
      return c.t.stageTemplates.map((tpl) => ({
        id: tpl.id,
        jobType: tpl.jobType,
        name: tpl.name,
        items: c.t.stageTemplateItems
          .filter((i) => i.templateId === tpl.id)
          .sort((a, b) => a.position - b.position)
          .map((i) => ({
            name: i.name,
            position: i.position,
            defaultUnit: i.defaultUnit,
            labourShareBp: i.labourShareBp,
            materialsShareBp: i.materialsShareBp,
          })),
      }));
    },

    async members(actor: Actor): Promise<Member[]> {
      c.access(actor);
      return members();
    },

    async assignments(actor: Actor): Promise<{ memberId: Id; name: string; projectIds: Id[] }[]> {
      c.access(actor);
      return members()
        .filter((m) => m.role === "foreman")
        .map((m) => ({ memberId: m.id, name: m.name, projectIds: m.projectIds }));
    },

    updateSettings: () => notYet("workspace.updateSettings"),
    saveLevel: () => notYet("workspace.saveLevel"),
    saveCategory: () => notYet("workspace.saveCategory"),
    saveTemplate: () => notYet("workspace.saveTemplate"),
    inviteMember: () => notYet("workspace.inviteMember"),
    setMemberRole: () => notYet("workspace.setMemberRole"),
    setAssignments: () => notYet("workspace.setAssignments"),
  };
}
