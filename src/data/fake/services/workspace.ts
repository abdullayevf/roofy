import { v7 as uuidv7 } from "uuid";
import { dayOfWeek } from "@/domain/dates";
import type {
  Actor,
  CategoryInput,
  CrewLevel,
  ExpenseCategory,
  Id,
  JobType,
  LevelInput,
  Member,
  MemberInput,
  Role,
  StageTemplate,
  TemplateInput,
  WorkspaceService,
  WorkspaceSettings,
  WorkspaceSettingsInput,
  WorkspaceView,
} from "../../contracts";
import { FIELD_ACCESS, type FakeContext, notFound } from "./context";
import { conflict, invalid, requireEditor, requireOwner, snapshot, write } from "./writes";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const JOB_TYPE_NAMES: Record<JobType, string> = {
  metal_reroof: "Metal re-roof",
  tile_reroof: "Tile re-roof",
  restoration: "Restoration",
  repair: "Repair",
  new_build: "New build",
};

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

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

  const settingsOf = (): WorkspaceSettings => {
    const w = c.t.workspace;
    return {
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
    };
  };

  const levelOf = (id: Id): CrewLevel => {
    const lv = c.ix.levels.get(id)!;
    return {
      id: lv.id,
      name: lv.name,
      floorRateCents: lv.floorRateCents,
      position: lv.position,
      crewCount: c.t.crewMembers.filter((m) => m.levelId === lv.id && m.activeTo === null).length,
    };
  };

  const templates = (): StageTemplate[] =>
    c.t.stageTemplates.map((tpl) => ({
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

  const memberOf = (id: Id): Member => members().find((m) => m.id === id)!;

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
        settings: settingsOf(),
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
      return templates();
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

    /**
     * Business, pay period and working days, standard day, on-cost (Owner/Manager). The pay-period
     * anchor must fall on the period's start day. Changes apply from now on (drafts are recomputed;
     * approved runs are frozen). Audited.
     */
    async updateSettings(actor: Actor, input: WorkspaceSettingsInput): Promise<WorkspaceSettings> {
      requireEditor(c, actor);
      if (!validTimeZone(input.timezone)) throw invalid("Pick a timezone from the list.");
      if (dayOfWeek(input.payAnchor) !== input.payWeekStart)
        throw invalid(`The pay period start date must be a ${WEEKDAY_NAMES[input.payWeekStart]}.`);
      write(c, actor, "settings_update", (w) => {
        const ws = w.t.workspace;
        const before = snapshot(ws);
        Object.assign(ws, {
          name: input.name,
          abn: input.abn,
          gstRegistered: input.gstRegistered,
          timezone: input.timezone,
          payPeriod: input.payFrequency,
          payWeekStart: input.payWeekStart,
          payAnchor: input.payAnchor,
          workingDays: [...new Set(input.workingDays)].sort(),
          standardDayHours: input.standardDayHours,
          onCostBp: input.onCostBp,
          updatedAt: w.at,
        });
        w.audit("workspace", ws.id, "update", before, snapshot(ws));
      });
      return settingsOf();
    },

    /** Add (id null) or change a level and its floor rate (Owner/Manager). Audited. */
    async saveLevel(actor: Actor, input: LevelInput): Promise<CrewLevel> {
      requireEditor(c, actor);
      const existing = input.id === null ? null : c.ix.levels.get(input.id);
      if (existing === undefined) throw notFound("level");
      if (c.t.crewLevels.some((lv) => lv.id !== input.id && sameName(lv.name, input.name)))
        throw invalid(`There's already a level called ${input.name}.`);
      const id = write(c, actor, "level_save", (w) => {
        if (existing) {
          const before = snapshot(existing);
          Object.assign(existing, {
            name: input.name,
            floorRateCents: input.floorRateCents,
            updatedAt: w.at,
          });
          w.audit("crew_level", existing.id, "update", before, snapshot(existing));
          return existing.id;
        }
        const position = Math.max(0, ...w.t.crewLevels.map((lv) => lv.position)) + 1;
        const row = { ...w.base(), name: input.name, floorRateCents: input.floorRateCents, position };
        w.t.crewLevels.push(row);
        w.audit("crew_level", row.id, "insert", null, snapshot(row));
        return row.id;
      });
      return levelOf(id);
    },

    /** Add (id null) or rename/reorder an expense category (Owner/Manager). */
    async saveCategory(actor: Actor, input: CategoryInput): Promise<ExpenseCategory> {
      requireEditor(c, actor);
      const existing = input.id === null ? null : c.ix.categories.get(input.id);
      if (existing === undefined) throw notFound("category");
      if (c.t.expenseCategories.some((x) => x.id !== input.id && sameName(x.name, input.name)))
        throw invalid(`There's already a category called ${input.name}.`);
      const row = write(c, actor, "category_save", (w) => {
        if (existing) {
          Object.assign(existing, { name: input.name, position: input.position, updatedAt: w.at });
          return existing;
        }
        const row = { ...w.base(), name: input.name, position: input.position };
        w.t.expenseCategories.push(row);
        return row;
      });
      return { id: row.id, name: row.name, position: row.position };
    },

    /**
     * Replace a job type's template stages (Owner/Manager). Labour shares total 100%; materials shares
     * total 100% (or all 0% for a job type with no materials). New jobs use it when there's no earlier
     * job of the type to copy.
     */
    async saveTemplate(actor: Actor, input: TemplateInput): Promise<StageTemplate> {
      requireEditor(c, actor);
      const total = (k: "labourShareBp" | "materialsShareBp") => input.items.reduce((a, i) => a + i[k], 0);
      if (total("labourShareBp") !== 10_000) throw invalid("Labour shares must add up to 100%.");
      if (![0, 10_000].includes(total("materialsShareBp")))
        throw invalid("Materials shares must add up to 100%, or all be 0%.");
      const id = write(c, actor, "template_save", (w) => {
        let tpl = w.t.stageTemplates.find((x) => x.jobType === input.jobType);
        if (!tpl) {
          tpl = { ...w.base(), jobType: input.jobType, name: JOB_TYPE_NAMES[input.jobType] };
          w.t.stageTemplates.push(tpl);
        }
        const templateId = tpl.id;
        const before = w.t.stageTemplateItems
          .filter((i) => i.templateId === templateId)
          .map((i) => snapshot(i));
        w.t.stageTemplateItems = w.t.stageTemplateItems.filter((i) => i.templateId !== templateId);
        input.items.forEach((item, i) =>
          w.t.stageTemplateItems.push({ ...w.base(), templateId, ...item, position: i + 1 }),
        );
        tpl.updatedAt = w.at;
        w.audit("stage_template", templateId, "update", { items: before }, { items: input.items });
        return templateId;
      });
      return templates().find((x) => x.id === id)!;
    },

    /** Invite someone (Owner only). There is one Owner. */
    async inviteMember(actor: Actor, input: MemberInput): Promise<Member> {
      requireOwner(c, actor);
      if (input.role === "owner") throw invalid("There can only be one Owner.");
      if (c.t.members.some((m) => sameName(m.email, input.email)))
        throw conflict("Someone with that email is already a member.");
      const id = write(c, actor, "member_invite", (w) => {
        const row = {
          ...w.base(),
          userId: uuidv7(),
          name: input.name,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          twoFactorEnabled: false,
        };
        w.t.members.push(row);
        w.audit("member", row.id, "insert", null, { name: row.name, email: row.email, role: row.role });
        return row.id;
      });
      return memberOf(id);
    },

    /** Change a member's role (Owner only). The Owner's own role doesn't change here. */
    async setMemberRole(actor: Actor, memberId: Id, role: Role): Promise<Member> {
      requireOwner(c, actor);
      const m = c.t.members.find((x) => x.id === memberId);
      if (!m) throw notFound("member");
      if (m.role === "owner") throw conflict("The Owner's role can't be changed.");
      if (role === "owner") throw invalid("There can only be one Owner.");
      write(c, actor, "member_role", (w) => {
        w.audit("member", m.id, "update", { role: m.role }, { role });
        if (m.role === "foreman" && role !== "foreman")
          w.t.projectAssignments = w.t.projectAssignments.filter((a) => a.memberId !== m.id);
        m.role = role;
        m.updatedAt = w.at;
      });
      return memberOf(m.id);
    },

    /** The jobs a foreman is assigned to (Owner/Manager); replaces the list. */
    async setAssignments(actor: Actor, memberId: Id, projectIds: Id[]): Promise<void> {
      requireEditor(c, actor);
      const m = c.t.members.find((x) => x.id === memberId);
      if (!m) throw notFound("member");
      if (m.role !== "foreman") throw invalid("Only a foreman is assigned to jobs.");
      if (projectIds.some((id) => !c.ix.projects.has(id))) throw invalid("Pick jobs from the list.");
      write(c, actor, "assignments_set", (w) => {
        const before = [...c.ix.assignedProjects(m.id)];
        w.t.projectAssignments = w.t.projectAssignments.filter((a) => a.memberId !== m.id);
        for (const projectId of new Set(projectIds))
          w.t.projectAssignments.push({ ...w.base(), memberId: m.id, projectId });
        w.audit(
          "project_assignment",
          m.id,
          "update",
          { projectIds: before },
          { projectIds: [...new Set(projectIds)] },
        );
      });
    },
  };
}
