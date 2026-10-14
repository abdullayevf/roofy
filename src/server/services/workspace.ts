/**
 * The real workspace service (Task 11). Run 1: settings, crew levels, expense categories and stage
 * templates. Members, invites, roles, assignments and two-factor arrive in run 2; until then
 * `createDbServices` keeps them as "This part isn't ready yet." placeholders.
 *
 * Every query runs through `withActor` (row-level security on `app.workspace_id`) AND filters
 * `workspace_id = actor.workspaceId` itself: the first of the two layers of tenant isolation.
 */
import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  DataError,
  type Access,
  type Actor,
  type CategoryInput,
  type CrewLevel,
  type ExpenseCategory,
  type FieldAccess,
  type JobType,
  type LevelInput,
  type Member,
  type MemberInput,
  type Role,
  type StageTemplate,
  type TemplateInput,
  type WorkspaceService,
  type WorkspaceSettings,
  type WorkspaceSettingsInput,
  type WorkspaceView,
} from "@/data/contracts";
import { dayOfWeek } from "@/domain/dates";
import { ROOFING_DEFAULTS } from "@/lib/roofing-defaults";
import { assertCan, type Action, type ActorWith2fa } from "@/server/authz/matrix";
import { assertInvite, assertKeepsAnOwner, assertRoleChange, NEEDS_AN_OWNER } from "@/server/authz/members";
import { shapeAccess } from "@/server/authz/shape";
import { isRole } from "@/server/auth/role";
import { getMailer, inviteEmail } from "@/server/email";
import { requireEnv } from "@/server/db/env";
import { fromHundredths, toHundredths } from "@/server/db/convert";
import {
  crewLevel,
  expenseCategory,
  invitation,
  member,
  project,
  projectAssignment,
  stageTemplate,
  stageTemplateItem,
  workspace,
} from "@/server/db/schema";
import { withActor, type Tx } from "@/server/db/with-actor";

/** Every `WorkspaceService` method is built (run 2); the name stays for `createDbServices`. */
export type BuiltWorkspaceService = WorkspaceService;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (message: string, field?: string) =>
  new DataError("invalid", message, field ? [{ field, message }] : []);
const notFound = (what: string) =>
  new DataError("not_found", `We couldn't find this ${what}. It may have been removed.`);

/**
 * No run-1 action is gated on two-factor (only pay-run approval, deleting the workspace and changing
 * the Owner are), so the matrix is asked with 2FA off; run 2 reads the real flag for those.
 */
const as2fa = (actor: Actor): ActorWith2fa => ({ ...actor, twoFactorEnabled: false });
const allow = (actor: Actor, action: Action) => assertCan(as2fa(actor), action);

/** Owner, Manager and Accountant (the office view); a foreman is refused. Levels carry floor rates. */
const OFFICE_READ: Action = "money.read";

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function whole(n: number, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isInteger(n) || n < min || n > max) throw invalid("Enter a whole number in range.", field);
}

const sameName = (column: SQL | typeof crewLevel.name | typeof expenseCategory.name, name: string) =>
  sql`lower(trim(${column})) = lower(trim(${name}))`;

type WorkspaceRow = typeof workspace.$inferSelect;

const settingsOf = (w: WorkspaceRow): WorkspaceSettings => ({
  id: w.id,
  name: w.name,
  abn: w.abn ?? "",
  gstRegistered: w.gstRegistered,
  timezone: w.timezone,
  payFrequency: w.payPeriod,
  payWeekStart: w.payWeekStart,
  payAnchor: w.payAnchor ?? "",
  workingDays: [...w.workingDays],
  standardDayHours: toHundredths(w.standardDayHours),
  onCostBp: w.onCostBp,
});

async function workspaceRow(tx: Tx, actor: Actor): Promise<WorkspaceRow> {
  const [w] = await tx.select().from(workspace).where(eq(workspace.id, actor.workspaceId));
  if (!w) throw notFound("business");
  return w;
}

/**
 * Whether the workspace's Owner has two-factor on, inside the actor's `withActor` transaction:
 * owner members of the actor's workspace joined to `workspace_member_profiles()` (fix 1, B1/F8).
 */
async function ownerTwoFactor(tx: Tx, actor: Actor): Promise<boolean> {
  const owners = await tx
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.workspaceId, actor.workspaceId), eq(member.role, "owner")));
  const people = await profiles(tx);
  return owners.some((o) => people.some((p) => p.user_id === o.userId && p.two_factor_enabled === true));
}

/** True for the `member_keeps_an_owner` trigger's refusal (migration 0007). */
function isLastOwnerError(e: unknown): boolean {
  for (let x: unknown = e; x; x = (x as { cause?: unknown }).cause) {
    const m = (x as { message?: unknown }).message;
    if (typeof m === "string" && m.includes("roofy_last_owner")) return true;
  }
  return false;
}

const crewCount = sql<number>`(select count(*)::int from crew_member m
  where m.workspace_id = ${crewLevel.workspaceId} and m.level_id = ${crewLevel.id} and m.active_to is null)`;

async function levelRows(tx: Tx, actor: Actor, id?: string): Promise<CrewLevel[]> {
  const where = eq(crewLevel.workspaceId, actor.workspaceId);
  return tx
    .select({
      id: crewLevel.id,
      name: crewLevel.name,
      floorRateCents: crewLevel.floorRateCents,
      position: crewLevel.position,
      crewCount,
    })
    .from(crewLevel)
    .where(id ? and(where, eq(crewLevel.id, id)) : where)
    .orderBy(asc(crewLevel.position), asc(crewLevel.id));
}

async function templateRows(tx: Tx, actor: Actor): Promise<StageTemplate[]> {
  const tpls = await tx
    .select({ id: stageTemplate.id, jobType: stageTemplate.jobType, name: stageTemplate.name })
    .from(stageTemplate)
    .where(eq(stageTemplate.workspaceId, actor.workspaceId))
    .orderBy(asc(stageTemplate.createdAt), asc(stageTemplate.id));
  const items = await tx
    .select()
    .from(stageTemplateItem)
    .where(eq(stageTemplateItem.workspaceId, actor.workspaceId))
    .orderBy(asc(stageTemplateItem.position));
  return tpls.map((t) => ({
    ...t,
    items: items
      .filter((i) => i.templateId === t.id)
      .map((i) => ({
        name: i.name,
        position: i.position,
        defaultUnit: i.defaultUnit,
        labourShareBp: i.labourShareBp,
        materialsShareBp: i.materialsShareBp,
      })),
  }));
}


// ─── Members (run 2) ────────────────────────────────────────────────────────

type Profile = { user_id: string; name: string; email: string; two_factor_enabled: boolean };

/**
 * Names, emails and 2FA of the members of the actor's workspace, through the migration-added
 * security-definer function (carry note T4(7)); roofy_app has no grant on "user".
 */
async function profiles(tx: Tx): Promise<Profile[]> {
  const res: unknown = await tx.execute(
    sql`select user_id, name, email, two_factor_enabled from workspace_member_profiles()`,
  );
  return (Array.isArray(res) ? res : (res as { rows: Profile[] }).rows) as Profile[];
}

/** The actor with their real two-factor state, for the 2FA-gated Owner changes. */
const withTwoFactor = (actor: Actor, people: Profile[]): ActorWith2fa => ({
  ...actor,
  twoFactorEnabled: people.find((p) => p.user_id === actor.userId)?.two_factor_enabled === true,
});

async function memberRows(tx: Tx, actor: Actor, id?: string): Promise<Member[]> {
  const ms = await tx
    .select({ id: member.id, userId: member.userId, role: member.role })
    .from(member)
    .where(and(eq(member.workspaceId, actor.workspaceId), id ? eq(member.id, id) : undefined))
    .orderBy(asc(member.id));
  const people = new Map((await profiles(tx)).map((p) => [p.user_id, p]));
  const assigned = await tx
    .select({ memberId: projectAssignment.memberId, projectId: projectAssignment.projectId })
    .from(projectAssignment)
    .where(eq(projectAssignment.workspaceId, actor.workspaceId))
    .orderBy(asc(projectAssignment.id));
  return ms.map((m) => {
    const p = people.get(m.userId);
    return {
      id: m.id,
      userId: m.userId,
      name: p?.name ?? "",
      email: p?.email ?? "",
      role: m.role as Role,
      twoFactorEnabled: p?.two_factor_enabled === true,
      projectIds: m.role === "foreman" ? assigned.filter((x) => x.memberId === m.id).map((x) => x.projectId) : [],
    };
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The same base URL Better Auth builds its invite links from; a missing value fails loudly. */
const appUrl = () => requireEnv("BETTER_AUTH_URL").replace(/\/+$/, "");

/** The workspace service on Postgres. Each method takes the actor it acts for. */
export function createWorkspaceService(): BuiltWorkspaceService {
  return {
    async settings(actor: Actor): Promise<WorkspaceView> {
      allow(actor, "workspace.read");
      const { w, ownerOn } = await withActor(actor, async (tx) => ({
        w: await workspaceRow(tx, actor),
        ownerOn: actor.role === "foreman" ? false : await ownerTwoFactor(tx, actor),
      }));
      if (actor.role === "foreman") {
        // Workspace-level flags: what a foreman may do on an assigned job.
        const access = shapeAccess(as2fa(actor), { projectId: "assigned", assignedProjectIds: ["assigned"] });
        return {
          view: "foreman",
          access: access as FieldAccess,
          workspace: {
            id: w.id,
            name: w.name,
            timezone: w.timezone,
            workingDays: [...w.workingDays],
            standardDayHours: toHundredths(w.standardDayHours),
          },
        };
      }
      return {
        view: "manager",
        access: shapeAccess(as2fa(actor)) as Access,
        settings: settingsOf(w),
        ownerTwoFactor: ownerOn,
      };
    },

    /** Business, pay period, working days, standard day and on-cost (Owner/Manager). Audited. */
    async updateSettings(actor: Actor, input: WorkspaceSettingsInput): Promise<WorkspaceSettings> {
      allow(actor, "workspace.edit");
      if (!validTimeZone(input.timezone)) throw invalid("Pick a timezone from the list.", "timezone");
      whole(input.payWeekStart, "payWeekStart", 0, 6);
      if (dayOfWeek(input.payAnchor) !== input.payWeekStart)
        throw invalid(
          `The pay period start date must be a ${WEEKDAY_NAMES[input.payWeekStart]}.`,
          "payAnchor",
        );
      for (const d of input.workingDays) whole(d, "workingDays", 0, 6);
      whole(input.standardDayHours, "standardDayHours", 0, 2400);
      whole(input.onCostBp, "onCostBp", 0, 100_000);
      return withActor(actor, async (tx) => {
        const [w] = await tx
          .update(workspace)
          .set({
            name: input.name,
            abn: input.abn,
            gstRegistered: input.gstRegistered,
            timezone: input.timezone,
            payPeriod: input.payFrequency,
            payWeekStart: input.payWeekStart,
            payAnchor: input.payAnchor,
            workingDays: [...new Set(input.workingDays)].sort((x, y) => x - y),
            standardDayHours: fromHundredths(input.standardDayHours),
            onCostBp: input.onCostBp,
            updatedAt: new Date(),
          })
          .where(eq(workspace.id, actor.workspaceId))
          .returning();
        if (!w) throw notFound("business");
        return settingsOf(w);
      });
    },

    async levels(actor: Actor): Promise<CrewLevel[]> {
      allow(actor, OFFICE_READ);
      return withActor(actor, (tx) => levelRows(tx, actor));
    },

    /** Add (id null) or change a level and its floor rate (Owner/Manager). Audited by trigger. */
    async saveLevel(actor: Actor, input: LevelInput): Promise<CrewLevel> {
      allow(actor, "rate.edit");
      whole(input.floorRateCents, "floorRateCents");
      const ws = actor.workspaceId;
      return withActor(actor, async (tx) => {
        if (
          input.id !== null &&
          (!UUID.test(input.id) || (await levelRows(tx, actor, input.id)).length === 0)
        )
          throw notFound("level");
        const others = input.id === null ? undefined : ne(crewLevel.id, input.id);
        const [dup] = await tx
          .select({ id: crewLevel.id })
          .from(crewLevel)
          .where(and(eq(crewLevel.workspaceId, ws), sameName(crewLevel.name, input.name), others));
        if (dup) throw invalid(`There's already a level called ${input.name}.`, "name");
        let id = input.id;
        if (id !== null) {
          await tx
            .update(crewLevel)
            .set({ name: input.name, floorRateCents: input.floorRateCents, updatedAt: new Date() })
            .where(and(eq(crewLevel.workspaceId, ws), eq(crewLevel.id, id)));
        } else {
          id = uuidv7();
          const [{ next } = { next: 1 }] = await tx
            .select({ next: sql<number>`coalesce(max(${crewLevel.position}), 0)::int + 1` })
            .from(crewLevel)
            .where(eq(crewLevel.workspaceId, ws));
          await tx
            .insert(crewLevel)
            .values({
              id,
              workspaceId: ws,
              name: input.name,
              floorRateCents: input.floorRateCents,
              position: next,
            });
        }
        return (await levelRows(tx, actor, id))[0]!;
      });
    },

    /** Foreman-reachable (the expense form): names and order only. */
    async categories(actor: Actor): Promise<ExpenseCategory[]> {
      allow(actor, "workspace.read");
      return withActor(actor, (tx) =>
        tx
          .select({ id: expenseCategory.id, name: expenseCategory.name, position: expenseCategory.position })
          .from(expenseCategory)
          .where(eq(expenseCategory.workspaceId, actor.workspaceId))
          .orderBy(asc(expenseCategory.position), asc(expenseCategory.id)),
      );
    },

    /** Add (id null) or rename/reorder an expense category (Owner/Manager). */
    async saveCategory(actor: Actor, input: CategoryInput): Promise<ExpenseCategory> {
      allow(actor, "workspace.edit");
      whole(input.position, "position");
      const ws = actor.workspaceId;
      return withActor(actor, async (tx) => {
        const mine = (id: string) => and(eq(expenseCategory.workspaceId, ws), eq(expenseCategory.id, id));
        if (input.id !== null) {
          const [found] = UUID.test(input.id)
            ? await tx.select({ id: expenseCategory.id }).from(expenseCategory).where(mine(input.id))
            : [];
          if (!found) throw notFound("category");
        }
        const others = input.id === null ? undefined : ne(expenseCategory.id, input.id);
        const [dup] = await tx
          .select({ id: expenseCategory.id })
          .from(expenseCategory)
          .where(
            and(eq(expenseCategory.workspaceId, ws), sameName(expenseCategory.name, input.name), others),
          );
        if (dup) throw invalid(`There's already a category called ${input.name}.`, "name");
        const values = { name: input.name, position: input.position };
        const [row] =
          input.id !== null
            ? await tx
                .update(expenseCategory)
                .set({ ...values, updatedAt: new Date() })
                .where(mine(input.id))
                .returning()
            : await tx
                .insert(expenseCategory)
                .values({ id: uuidv7(), workspaceId: ws, ...values })
                .returning();
        return { id: row!.id, name: row!.name, position: row!.position };
      });
    },

    async templates(actor: Actor): Promise<StageTemplate[]> {
      allow(actor, OFFICE_READ);
      return withActor(actor, (tx) => templateRows(tx, actor));
    },

    /** Replace a job type's template stages (Owner/Manager). Labour 100%; materials 100% or all 0%. */
    async saveTemplate(actor: Actor, input: TemplateInput): Promise<StageTemplate> {
      allow(actor, "workspace.edit");
      if (!Object.hasOwn(ROOFING_DEFAULTS.templates, input.jobType))
        throw invalid("Pick a job type from the list.", "jobType");
      for (const i of input.items) {
        whole(i.labourShareBp, "labourShareBp", 0, 10_000);
        whole(i.materialsShareBp, "materialsShareBp", 0, 10_000);
      }
      const total = (k: "labourShareBp" | "materialsShareBp") => input.items.reduce((s, i) => s + i[k], 0);
      if (total("labourShareBp") !== 10_000) throw invalid("Labour shares must add up to 100%.");
      if (![0, 10_000].includes(total("materialsShareBp")))
        throw invalid("Materials shares must add up to 100%, or all be 0%.");
      const ws = actor.workspaceId;
      const jobType: JobType = input.jobType;
      return withActor(actor, async (tx) => {
        const [found] = await tx
          .select({ id: stageTemplate.id })
          .from(stageTemplate)
          .where(and(eq(stageTemplate.workspaceId, ws), eq(stageTemplate.jobType, jobType)))
          .orderBy(asc(stageTemplate.createdAt))
          .limit(1);
        const templateId = found?.id ?? uuidv7();
        if (found) {
          await tx
            .update(stageTemplate)
            .set({ updatedAt: new Date() })
            .where(and(eq(stageTemplate.workspaceId, ws), eq(stageTemplate.id, templateId)));
          await tx
            .delete(stageTemplateItem)
            .where(and(eq(stageTemplateItem.workspaceId, ws), eq(stageTemplateItem.templateId, templateId)));
        } else {
          await tx
            .insert(stageTemplate)
            .values({
              id: templateId,
              workspaceId: ws,
              jobType,
              name: ROOFING_DEFAULTS.templates[jobType].name,
            });
        }
        if (input.items.length > 0)
          await tx.insert(stageTemplateItem).values(
            input.items.map((i, n) => ({
              id: uuidv7(),
              workspaceId: ws,
              templateId,
              name: i.name,
              position: n + 1,
              defaultUnit: i.defaultUnit,
              labourShareBp: i.labourShareBp,
              materialsShareBp: i.materialsShareBp,
            })),
          );
        return (await templateRows(tx, actor)).find((t) => t.id === templateId)!;
      });
    },
    async members(actor: Actor): Promise<Member[]> {
      allow(actor, "member.read");
      return withActor(actor, (tx) => memberRows(tx, actor));
    },

    /** Owner or Manager; inviting as Owner needs an Owner with 2FA. One pending invite per email. */
    async inviteMember(actor: Actor, input: MemberInput): Promise<Member> {
      allow(actor, "member.invite");
      const email = input.email.trim().toLowerCase();
      if (!EMAIL.test(email)) throw invalid("Enter an email address.", "email");
      if (!isRole(input.role)) throw invalid("Pick a role from the list.", "role");
      const base = appUrl();
      const { id, workspaceName } = await withActor(actor, async (tx) => {
        // F9: one invite at a time per business and email, so the check and the insert are one step.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`roofy_invite:${actor.workspaceId}:${email}`}))`);
        const people = await profiles(tx);
        const pending = await tx
          .select({ id: invitation.id })
          .from(invitation)
          .where(
            and(
              eq(invitation.workspaceId, actor.workspaceId),
              sql`lower(${invitation.email}) = ${email}`,
              eq(invitation.status, "pending"),
              sql`${invitation.expiresAt} > now()`,
            ),
          );
        assertInvite(withTwoFactor(actor, people), input.role, {
          alreadyMember: people.some((p) => p.email.toLowerCase() === email),
          alreadyInvited: pending.length > 0,
        });
        const w = await workspaceRow(tx, actor);
        const id = uuidv7();
        await tx.insert(invitation).values({
          id,
          workspaceId: actor.workspaceId,
          email,
          role: input.role,
          expiresAt: sql`now() + interval '48 hours'`,
          inviterId: actor.userId,
        });
        return { id, workspaceName: w.name };
      });
      try {
        await getMailer().send({
          to: email,
          ...inviteEmail({ workspaceName, inviterName: actor.name, role: input.role, url: `${base}/invite/${id}` }),
        });
      } catch {
        // F3: an invite nobody was told about must not block the email for 48 hours.
        await withActor(actor, (tx) =>
          tx.delete(invitation).where(and(eq(invitation.workspaceId, actor.workspaceId), eq(invitation.id, id))),
        );
        throw new DataError("unavailable", "We couldn't send the invite. Try again.");
      }
      return { id, userId: "", name: input.name.trim(), email, role: input.role, twoFactorEnabled: false, projectIds: [] };
    },

    /** Owner or Manager; anything touching the Owner role is an Owner change. Keeps one Owner. */
    async setMemberRole(actor: Actor, memberId: string, role: Role): Promise<Member> {
      allow(actor, "member.setRole");
      if (!isRole(role)) throw invalid("Pick a role from the list.", "role");
      if (!UUID.test(memberId)) throw notFound("member");
      return withActor(actor, async (tx) => {
        // F2: the same lock the member_keeps_an_owner trigger takes, so the count below is current.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`roofy_member_owner:${actor.workspaceId}`}))`);
        const [m] = await memberRows(tx, actor, memberId);
        if (!m) throw notFound("member");
        assertRoleChange(withTwoFactor(actor, await profiles(tx)), m.role, role);
        const owners = await tx
          .select({ id: member.id })
          .from(member)
          .where(and(eq(member.workspaceId, actor.workspaceId), eq(member.role, "owner")));
        assertKeepsAnOwner(m.role, role, owners.length);
        if (m.role === role) return m;
        await tx
          .update(member)
          .set({ role })
          .where(and(eq(member.workspaceId, actor.workspaceId), eq(member.id, memberId)));
        if (m.role === "foreman")
          await tx
            .delete(projectAssignment)
            .where(and(eq(projectAssignment.workspaceId, actor.workspaceId), eq(projectAssignment.memberId, memberId)));
        return (await memberRows(tx, actor, memberId))[0]!;
      }).catch((e: unknown) => {
        if (isLastOwnerError(e)) throw new DataError("conflict", NEEDS_AN_OWNER);
        throw e;
      });
    },

    async assignments(actor: Actor): Promise<{ memberId: string; name: string; projectIds: string[] }[]> {
      allow(actor, "member.read");
      const ms = await withActor(actor, (tx) => memberRows(tx, actor));
      return ms.filter((m) => m.role === "foreman").map((m) => ({ memberId: m.id, name: m.name, projectIds: m.projectIds }));
    },

    /** Replaces the jobs a foreman is assigned to (Owner/Manager). */
    async setAssignments(actor: Actor, memberId: string, projectIds: string[]): Promise<void> {
      allow(actor, "assignment.edit");
      if (!UUID.test(memberId)) throw notFound("member");
      const ids = [...new Set(projectIds)];
      await withActor(actor, async (tx) => {
        const [m] = await tx
          .select({ role: member.role })
          .from(member)
          .where(and(eq(member.workspaceId, actor.workspaceId), eq(member.id, memberId)));
        if (!m) throw notFound("member");
        if (m.role !== "foreman") throw invalid("Only a foreman is assigned to jobs.");
        if (ids.some((id) => !UUID.test(id))) throw invalid("Pick jobs from the list.", "projectIds");
        if (ids.length) {
          const found = await tx
            .select({ id: project.id })
            .from(project)
            .where(and(eq(project.workspaceId, actor.workspaceId), inArray(project.id, ids)));
          // Another business's job id reads as missing, as for every other id (plan: not_found).
          if (found.length !== ids.length) throw notFound("job");
        }
        await tx
          .delete(projectAssignment)
          .where(and(eq(projectAssignment.workspaceId, actor.workspaceId), eq(projectAssignment.memberId, memberId)));
        for (const projectId of ids)
          await tx.insert(projectAssignment).values({ id: uuidv7(), workspaceId: actor.workspaceId, memberId, projectId });
      });
    },

    /**
     * Every role manages their own two-factor (matrix `twoFactor.manage`). Better Auth owns TOTP
     * enrolment (verifying the code against the secret); this reports its state for the caller.
     */
    async turnOnTwoFactor(actor: Actor, code: string): Promise<{ twoFactorEnabled: true }> {
      allow(actor, "twoFactor.manage");
      if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) throw invalid("Enter the 6-digit code from your app.", "code");
      const on = await withActor(actor, async (tx) => withTwoFactor(actor, await profiles(tx)).twoFactorEnabled);
      if (!on) throw new DataError("conflict", "Scan the code with your authenticator app and confirm it first.");
      return { twoFactorEnabled: true };
    },
  };
}
