"use server";
/**
 * Settings: business, pay period and working days, on-cost, levels and floor rates, templates,
 * expense categories (Owner/Manager); members and roles (Owner); foreman assignments (Owner/Manager).
 */
import {
  categorySchema,
  idListSchema,
  idSchema,
  levelSchema,
  memberSchema,
  roleSchema,
  settingsSchema,
  templateSchema,
} from "@/data/admin-inputs";
import type {
  ActionResult,
  CategoryInput,
  CrewLevel,
  ExpenseCategory,
  Id,
  LevelInput,
  Member,
  MemberInput,
  Role,
  StageTemplate,
  TemplateInput,
  WorkspaceSettings,
  WorkspaceSettingsInput,
} from "@/data/contracts";
import { act, PATHS } from "./run";

/** Pay period, working days and on-cost change figures everywhere. */
export async function updateSettings(
  input: WorkspaceSettingsInput,
): Promise<ActionResult<{ settings: WorkspaceSettings }>> {
  return act(
    [settingsSchema],
    [input],
    async ({ data, actor }, i) => ({ settings: await data.workspace.updateSettings(actor, i) }),
    [PATHS.everything],
  );
}

/** Floor rates feed the award-floor check on pay runs from now on. */
export async function saveLevel(input: LevelInput): Promise<ActionResult<{ level: CrewLevel }>> {
  return act(
    [levelSchema],
    [input],
    async ({ data, actor }, i) => ({ level: await data.workspace.saveLevel(actor, i) }),
    [PATHS.settings, PATHS.crew, PATHS.pay, PATHS.home],
  );
}

export async function saveCategory(
  input: CategoryInput,
): Promise<ActionResult<{ category: ExpenseCategory }>> {
  return act(
    [categorySchema],
    [input],
    async ({ data, actor }, i) => ({ category: await data.workspace.saveCategory(actor, i) }),
    [PATHS.settings, PATHS.expenses],
  );
}

export async function saveTemplate(input: TemplateInput): Promise<ActionResult<{ template: StageTemplate }>> {
  return act(
    [templateSchema],
    [input],
    async ({ data, actor }, i) => ({ template: await data.workspace.saveTemplate(actor, i) }),
    [PATHS.settings, PATHS.jobs],
  );
}

export async function inviteMember(input: MemberInput): Promise<ActionResult<{ member: Member }>> {
  return act(
    [memberSchema],
    [input],
    async ({ data, actor }, i) => ({ member: await data.workspace.inviteMember(actor, i) }),
    [PATHS.settings],
  );
}

export async function setMemberRole(memberId: Id, role: Role): Promise<ActionResult<{ member: Member }>> {
  return act(
    [idSchema, roleSchema],
    [memberId, role],
    async ({ data, actor }, id, r) => ({ member: await data.workspace.setMemberRole(actor, id, r) }),
    [PATHS.settings],
  );
}

/** The jobs a foreman may log to (replaces the list). */
export async function setAssignments(memberId: Id, projectIds: Id[]): Promise<ActionResult> {
  return act(
    [idSchema, idListSchema],
    [memberId, projectIds],
    async ({ data, actor }, id, ids) => {
      await data.workspace.setAssignments(actor, id, ids);
      return {};
    },
    [PATHS.settings, PATHS.jobs, PATHS.log, PATHS.home],
  );
}
