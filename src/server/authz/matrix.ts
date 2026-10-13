/**
 * Roofy permission matrix (product spec §3, plan Phase 3 Task 9).
 *
 * Pure: no DB, no Better Auth. `can` needs only the actor, whether they have 2FA on, and (for a
 * foreman) the project they are acting on plus their assigned projects, so services and Better
 * Auth hooks can both call it. Better Auth's own access control in `src/server/auth` is separate.
 *
 * Mapping notes for callers (Task 11; `memberActionFor` encodes the first):
 * - Any member change that touches the Owner role (target is an owner, or the new role is owner)
 *   is `member.changeOwner`, not `member.setRole`/`member.remove`.
 * - A foreman's project-scoped actions need `ctx.projectId` and `ctx.assignedProjectIds`; without
 *   both they are denied. Lists for a foreman are filtered to assigned projects by the service.
 * - `twoFactor.manage` is the actor's own two-factor settings.
 */
import { DataError, type Actor, type Role } from "@/data/contracts";

export const ACTIONS = [
  "workspace.read",
  "workspace.edit",
  "workspace.delete",
  "workspace.billing",
  "member.read",
  "member.invite",
  "member.setRole",
  "member.remove",
  "member.changeOwner",
  "assignment.edit",
  "project.read",
  "project.edit",
  "stage.edit",
  "stage.markDone",
  "stage.pauseResume",
  "crew.read",
  "crew.edit",
  "rate.read",
  "rate.edit",
  "log.write",
  "progress.write",
  "expense.write",
  "expense.readAll",
  "payRun.read",
  "payRun.edit",
  "payRun.approve",
  "payRun.export",
  "payout.read",
  "payout.edit",
  "report.read",
  "export.run",
  "money.read",
  "twoFactor.manage",
] as const;

export type Action = (typeof ACTIONS)[number];

export type ActorWith2fa = Actor & { twoFactorEnabled: boolean };

export interface AuthzContext {
  projectId?: string;
  assignedProjectIds?: readonly string[];
}

/** `yes` always; `assigned` only on an assigned project; `twoFactor` only with 2FA on; `no` never. */
type Rule = "yes" | "no" | "assigned" | "twoFactor";

const all = (rule: Rule, except: Partial<Record<Action, Rule>> = {}): Record<Action, Rule> =>
  Object.fromEntries(ACTIONS.map((a) => [a, except[a] ?? rule])) as Record<Action, Rule>;

const RULES: Record<Role, Record<Action, Rule>> = {
  /** Everything; 2FA required for approving pay runs and the two irreversible actions. */
  owner: all("yes", {
    "payRun.approve": "twoFactor",
    "workspace.delete": "twoFactor",
    "member.changeOwner": "twoFactor",
  }),
  /** Everything except billing, deleting the workspace and changing the Owner. */
  manager: all("yes", {
    "workspace.billing": "no",
    "workspace.delete": "no",
    "member.changeOwner": "no",
  }),
  /** Field entries on assigned projects only; no money, no Done. */
  foreman: all("no", {
    "workspace.read": "yes",
    "crew.read": "yes",
    "twoFactor.manage": "yes",
    "project.read": "assigned",
    "stage.pauseResume": "assigned",
    "log.write": "assigned",
    "progress.write": "assigned",
    "expense.write": "assigned",
  }),
  /** Read-only: view and export pay runs, payouts, expenses and reports. */
  accountant: all("no", {
    "workspace.read": "yes",
    "project.read": "yes",
    "crew.read": "yes",
    "expense.readAll": "yes",
    "payRun.read": "yes",
    "payRun.export": "yes",
    "payout.read": "yes",
    "report.read": "yes",
    "export.run": "yes",
    "money.read": "yes",
    "twoFactor.manage": "yes",
  }),
};

const isAssigned = (ctx: AuthzContext | undefined): boolean =>
  !!ctx?.projectId && !!ctx.assignedProjectIds && ctx.assignedProjectIds.includes(ctx.projectId);

/** True when `actor` may do `action` (in `ctx`). Unknown roles and actions are denied. */
export function can(actor: ActorWith2fa, action: Action, ctx?: AuthzContext): boolean {
  const rules: Record<string, Rule> | undefined = Object.hasOwn(RULES, actor.role)
    ? RULES[actor.role]
    : undefined;
  const rule = rules && Object.hasOwn(rules, action) ? rules[action] : "no";
  switch (rule) {
    case "yes":
      return true;
    case "assigned":
      return isAssigned(ctx);
    case "twoFactor":
      return actor.twoFactorEnabled === true;
    default:
      return false;
  }
}

/** Throws `DataError("forbidden")` unless `can(actor, action, ctx)`. */
export function assertCan(actor: ActorWith2fa, action: Action, ctx?: AuthzContext): void {
  if (!can(actor, action, ctx)) throw new DataError("forbidden", "You don't have access to this.");
}

/**
 * The action a member change needs. Anything that touches the Owner role (the member is an owner,
 * or becomes one) is `member.changeOwner`; otherwise a role change is `member.setRole`. Pass
 * `nextRole: null` for removing the member (`member.remove`, or `member.changeOwner` for an owner).
 */
export function memberActionFor(
  currentRole: Role,
  nextRole: Role | null,
): "member.changeOwner" | "member.setRole" | "member.remove" {
  if (currentRole === "owner" || nextRole === "owner") return "member.changeOwner";
  return nextRole === null ? "member.remove" : "member.setRole";
}
