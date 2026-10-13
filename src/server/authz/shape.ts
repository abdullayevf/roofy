/**
 * Role-shaped DTOs (plan Phase 3 Task 9). Foreman variants are built from an allowlist of the
 * foreman type's keys, never by deleting money keys, so a new money field cannot slip through.
 */
import type {
  Access,
  ClientRef,
  FieldAccess,
  Member,
  ProjectRowForeman,
  ProjectRowManager,
  StageChip,
} from "@/data/contracts";
import { can, type Action, type ActorWith2fa, type AuthzContext } from "./matrix";

/** Exactly the keys of `T`: the compiler fails when the type gains or loses a key. */
type KeysOf<T> = { readonly [K in keyof Required<T>]: true };

/** A new object with only `keys`. Values are copied as-is, so only use it for flat shapes. */
const pick = <T extends object>(source: T, keys: KeysOf<T>): T => {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(keys)) out[key] = (source as Record<string, unknown>)[key];
  return out as T;
};

/** A member as seen without `member.read`: who they are and their role, no contact or 2FA details. */
export type MemberSummary = Pick<Member, "id" | "name" | "role">;

export const MEMBER_SUMMARY_KEYS = ["id", "name", "role"] as const satisfies readonly (keyof MemberSummary)[];
const MEMBER_SUMMARY: KeysOf<MemberSummary> = { id: true, name: true, role: true };

export function shapeMember(actor: ActorWith2fa, m: Member): Member | MemberSummary {
  return can(actor, "member.read") ? m : pick<MemberSummary>(m, MEMBER_SUMMARY);
}

export const PROJECT_ROW_FOREMAN_KEYS: KeysOf<ProjectRowForeman> = {
  id: true,
  name: true,
  client: true,
  siteAddress: true,
  jobType: true,
  status: true,
  pctBp: true,
  currentStages: true,
  daysSinceLastLog: true,
};

const CLIENT_REF_KEYS: KeysOf<ClientRef> = { id: true, name: true };
const STAGE_CHIP_KEYS: KeysOf<StageChip> = { stageId: true, name: true, status: true, pauseReason: true };

/**
 * Money-reading roles (owner, manager, accountant) get the manager row; a foreman gets the field
 * row, rebuilt key by key at every level (client and each stage chip are new objects too).
 */
export function shapeProjectRow(
  actor: ActorWith2fa,
  row: ProjectRowManager,
): ProjectRowManager | ProjectRowForeman {
  if (can(actor, "money.read")) return row;
  return {
    ...pick<ProjectRowForeman>(row, PROJECT_ROW_FOREMAN_KEYS),
    client: pick<ClientRef>(row.client, CLIENT_REF_KEYS),
    currentStages: row.currentStages.map((chip) => pick<StageChip>(chip, STAGE_CHIP_KEYS)),
  };
}

/** Each `Access` flag is true only when the actor can do every action listed for it. */
export const ACCESS_FLAGS: Record<Exclude<keyof Access, "role">, readonly Action[]> = {
  /** Projects, stages, crew, rates, logs, expenses, settings. */
  canEdit: [
    "workspace.edit",
    "project.edit",
    "stage.edit",
    "stage.markDone",
    "crew.edit",
    "rate.edit",
    "assignment.edit",
    "log.write",
    "progress.write",
    "expense.write",
    "payRun.edit",
  ],
  /** Approve/reopen pay runs, record payouts, waive a missing rate (role power; 2FA checked on approve). */
  canApprove: ["payRun.approve", "payout.edit"],
  canExport: ["export.run", "payRun.export"],
  /**
   * Members, roles, billing (Owner). `member.changeOwner` and `workspace.delete` are left out on
   * purpose: they need 2FA, and an Owner without 2FA must still reach the members screen.
   */
  canAdminister: ["workspace.billing", "member.invite", "member.setRole", "member.remove"],
};

export function shapeAccess(actor: ActorWith2fa, ctx?: AuthzContext): Access | FieldAccess {
  if (actor.role === "foreman") {
    return {
      role: "foreman",
      canLog: can(actor, "log.write", ctx),
      canPause: can(actor, "stage.pauseResume", ctx),
      canMarkDone: false,
    };
  }
  // Flags say what the role may do; 2FA is enforced on the action itself. An Owner without 2FA
  // keeps canApprove so the UI can say "Turn on two-factor before you approve a pay run." and
  // still show "Record payout" (flows.md:224); approving stays denied by `payRun.approve`.
  const asRole: ActorWith2fa = { ...actor, twoFactorEnabled: true };
  const all = (actions: readonly Action[]) => actions.every((a) => can(asRole, a, ctx));
  return {
    role: actor.role,
    canEdit: all(ACCESS_FLAGS.canEdit),
    canApprove: all(ACCESS_FLAGS.canApprove),
    canExport: all(ACCESS_FLAGS.canExport),
    canAdminister: all(ACCESS_FLAGS.canAdminister),
  };
}
