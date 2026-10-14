"use server";
/**
 * Settings: business, pay period and working days, on-cost, levels and floor rates, templates,
 * expense categories (Owner/Manager); members and roles (Owner); foreman assignments (Owner/Manager).
 */
import {
  categorySchema,
  codeSchema,
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
  TwoFactorSetup,
  WorkspaceSettings,
  WorkspaceSettingsInput,
} from "@/data/contracts";
import { z } from "zod";
import { getAuth } from "@/data";
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

/** Owner or Manager: take someone out of the team. */
export async function removeMember(memberId: Id): Promise<ActionResult> {
  return act(
    [idSchema],
    [memberId],
    async ({ data, actor }, id) => {
      await data.workspace.removeMember(actor, id);
      return {};
    },
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

/** Owner only: two-factor on, so pay runs can be approved (flows.md: Owner 2FA off blocks Approve). */
export async function turnOnTwoFactor(code: string): Promise<ActionResult<{ twoFactorEnabled: true }>> {
  return act(
    [codeSchema],
    [code],
    async ({ data, actor }, c) => {
      // The authenticator app's first code is checked by the sign-in service (db: Better Auth), then the page reads the result.
      await getAuth().confirmTwoFactor(c);
      return data.workspace.turnOnTwoFactor(actor, c);
    },
    [PATHS.settings, PATHS.pay, PATHS.home],
  );
}

/** Owner only: a new key and QR code for the authenticator app. The password is asked for unless the account has none. */
export async function startTwoFactor(password: string): Promise<ActionResult<{ setup: TwoFactorSetup }>> {
  return act(
    [z.string().max(1000)],
    [password],
    async (_ctx, p) => ({ setup: await getAuth().startTwoFactor(p) }),
    [],
  );
}
