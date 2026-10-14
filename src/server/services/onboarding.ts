/**
 * The real set-up wizard (Task 12 run 1). Matches the fake (`src/data/fake/services/onboarding.ts`): the
 * Owner's alone, one saved step at a time (a stale tab is refused as moved on, F6), the same field issues.
 *
 * Two ways in. `createDbOnboarding({ userId })` is a signed-in person with no workspace yet: they can read
 * the blank wizard and `saveBusiness`, which creates the workspace (Better Auth organization) with them as
 * Owner and makes it their session's active workspace. That set-up actor never reaches `withActor`. After
 * that, `createDbOnboarding(actor)` serves the rest through `withActor`, filtering `workspace_id` itself and
 * re-reading the caller's member row, so a forged actor for someone else's workspace is refused.
 */
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  DataError,
  ONBOARDING_STEPS,
  type Actor,
  type FieldIssue,
  type JobType,
  type OnboardingBusinessInput,
  type OnboardingService,
  type OnboardingState,
  type OnboardingStep,
} from "@/data/contracts";
import { todayIn, weekdayOnOrBefore } from "@/domain/dates";
import { businessProblems, crewRowProblems, RATE_UNREADABLE } from "@/lib/onboarding-input";
import { ROOFING_DEFAULTS } from "@/lib/roofing-defaults";
import { getAuthDb } from "@/server/db/client";
import {
  crewLevel,
  crewMember,
  expenseCategory,
  member,
  rate,
  session,
  stageTemplate,
  stageTemplateItem,
  user,
  workspace,
} from "@/server/db/schema";
import { withActor, type Tx } from "@/server/db/with-actor";

/** The fake's words (`NO_ACCESS`, F6 conflict), so both layers refuse alike. */
export const NO_ACCESS = "You don't have access to this. Ask your manager.";
export const MOVED_ON = "Set-up has moved on since this page opened. Reload to carry on.";
const DEFAULT_TIMEZONE = "Australia/Sydney";
/** New workspaces start with weeks from Monday (the column default); the pay anchor is that week's Monday. */
const DEFAULT_PAY_WEEK_START = 1;

const forbidden = () => new DataError("forbidden", NO_ACCESS);
const movedOn = () => new DataError("conflict", MOVED_ON);

function refuseIf(issues: FieldIssue[]): void {
  if (issues.length > 0) throw new DataError("invalid", issues[0]!.message, issues);
}

function businessIssues(input: OnboardingBusinessInput): FieldIssue[] {
  const p = businessProblems(input);
  const issues: FieldIssue[] = [];
  if (p.name) issues.push({ field: "name", message: p.name });
  if (p.abn) issues.push({ field: "abn", message: p.abn });
  return issues;
}

const cleanAbn = (abn: string) => abn.replace(/\s/g, "");

/** What "Use these" adds, read from the shared roofing defaults (not from the workspace). */
const DEFAULTS: OnboardingState["defaults"] = {
  templates: Object.entries(ROOFING_DEFAULTS.templates).map(([jobType, t]) => ({
    jobType: jobType as JobType,
    name: t.name,
    stages: t.items.length,
  })),
  categories: [...ROOFING_DEFAULTS.categories],
};

/** The wizard before the business is saved: nothing stored yet. */
const BLANK: OnboardingState = {
  step: "business",
  business: { name: "", abn: "", gstRegistered: false },
  trade: null,
  defaults: DEFAULTS,
  levels: [],
  crew: [],
};

type Ws = { step: OnboardingStep; timezone: string };

/** The caller must be this workspace's Owner by their own member row; `lock` holds the workspace row. */
async function ownerOf(tx: Tx, actor: Actor, lock = false): Promise<Ws> {
  const [me] = await tx
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.workspaceId, actor.workspaceId), eq(member.userId, actor.userId)));
  if (!me || me.role !== "owner" || actor.role !== "owner") throw forbidden();
  const q = tx
    .select({ step: workspace.onboardingStep, timezone: workspace.timezone })
    .from(workspace)
    .where(eq(workspace.id, actor.workspaceId));
  const [w] = lock ? await q.for("update") : await q;
  if (!w) throw forbidden();
  return w;
}

async function readState(tx: Tx, actor: Actor): Promise<OnboardingState> {
  const ws = actor.workspaceId;
  const [w] = await tx
    .select({
      name: workspace.name,
      abn: workspace.abn,
      gst: workspace.gstRegistered,
      step: workspace.onboardingStep,
      trade: workspace.trade,
    })
    .from(workspace)
    .where(eq(workspace.id, ws));
  const levels = await tx
    .select({ id: crewLevel.id, name: crewLevel.name })
    .from(crewLevel)
    .where(eq(crewLevel.workspaceId, ws))
    .orderBy(asc(crewLevel.position), asc(crewLevel.name));
  const people = await tx
    .select({
      id: crewMember.id,
      name: crewMember.name,
      type: crewMember.type,
      levelId: crewMember.levelId,
      basis: crewMember.defaultBasis,
    })
    .from(crewMember)
    .where(eq(crewMember.workspaceId, ws))
    .orderBy(asc(crewMember.createdAt), asc(crewMember.id));
  const rates = await tx
    .select({ crewMemberId: rate.crewMemberId, amountCents: rate.amountCents })
    .from(rate)
    .where(and(eq(rate.workspaceId, ws), isNull(rate.projectId)))
    .orderBy(desc(rate.effectiveFrom), desc(rate.id));
  const levelName = new Map(levels.map((l) => [l.id, l.name]));
  return {
    step: w!.step,
    business: { name: w!.name, abn: w!.abn ?? "", gstRegistered: w!.gst },
    trade: w!.trade === "roofing" ? "roofing" : null,
    defaults: DEFAULTS,
    levels,
    crew: people.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      levelName: m.levelId === null ? null : (levelName.get(m.levelId) ?? null),
      basis: m.basis === "hourly" ? ("hourly" as const) : ("daily" as const),
      rateCents: rates.find((r) => r.crewMemberId === m.id)?.amountCents ?? 0,
    })),
  };
}

async function moveTo(
  tx: Tx,
  actor: Actor,
  step: OnboardingStep,
  extra: { trade?: "roofing" } = {},
): Promise<void> {
  await tx
    .update(workspace)
    .set({ onboardingStep: step, ...extra, updatedAt: new Date() })
    .where(eq(workspace.id, actor.workspaceId));
}

/** Copies the roofing templates, categories and levels; each kind only when the workspace has none (once). */
async function copyDefaults(tx: Tx, ws: string): Promise<void> {
  const has = async (t: typeof stageTemplate | typeof expenseCategory | typeof crewLevel) =>
    (await tx.select({ id: t.id }).from(t).where(eq(t.workspaceId, ws)).limit(1)).length > 0;
  if (!(await has(stageTemplate))) {
    for (const [jobType, t] of Object.entries(ROOFING_DEFAULTS.templates)) {
      const templateId = uuidv7();
      await tx
        .insert(stageTemplate)
        .values({ id: templateId, workspaceId: ws, jobType: jobType as JobType, name: t.name });
      await tx.insert(stageTemplateItem).values(
        t.items.map((i, n) => ({
          id: uuidv7(),
          workspaceId: ws,
          templateId,
          name: i.name,
          position: n + 1,
          defaultUnit: i.unit,
          labourShareBp: i.labourShareBp,
          materialsShareBp: i.materialsShareBp,
        })),
      );
    }
  }
  if (!(await has(expenseCategory)))
    await tx
      .insert(expenseCategory)
      .values(
        ROOFING_DEFAULTS.categories.map((name, n) => ({
          id: uuidv7(),
          workspaceId: ws,
          name,
          position: n + 1,
        })),
      );
  if (!(await has(crewLevel)))
    await tx
      .insert(crewLevel)
      .values(
        ROOFING_DEFAULTS.levels.map((l, n) => ({
          id: uuidv7(),
          workspaceId: ws,
          name: l.name,
          floorRateCents: l.floorRateCents,
          position: n + 1,
        })),
      );
}

/**
 * Creates the workspace for a person with none, on the roofy_auth pool (the one Better Auth's organization
 * plugin uses for workspace and member). `app.user_id` is set in the transaction so the audit row names
 * them (carry T8). A second save (double submit, or an unfinished workspace whose session lost it) makes
 * no second workspace: it points the session back at the unfinished one and answers moved on.
 */
async function createWorkspace(userId: string, input: OnboardingBusinessInput, now: Date): Promise<Actor> {
  return getAuthDb().transaction(async (tx) => {
    const [me] = await tx
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!me) throw forbidden();
    const [unfinished] = await tx
      .select({ id: workspace.id })
      .from(member)
      .innerJoin(workspace, eq(workspace.id, member.workspaceId))
      .where(and(eq(member.userId, userId), eq(member.role, "owner"), ne(workspace.onboardingStep, "done")))
      .limit(1);
    const activate = (id: string) =>
      tx
        .update(session)
        .set({ activeWorkspaceId: id, updatedAt: new Date() })
        .where(and(eq(session.userId, userId), isNull(session.activeWorkspaceId)));
    if (unfinished) {
      await activate(unfinished.id);
      throw movedOn();
    }
    const id = uuidv7();
    await tx.execute(
      sql`select set_config('app.workspace_id', ${id}, true), set_config('app.user_id', ${userId}, true)`,
    );
    const today = todayIn(DEFAULT_TIMEZONE, now);
    await tx.insert(workspace).values({
      id,
      name: input.name.trim(),
      abn: cleanAbn(input.abn),
      gstRegistered: input.gstRegistered,
      timezone: DEFAULT_TIMEZONE,
      payWeekStart: DEFAULT_PAY_WEEK_START,
      payAnchor: weekdayOnOrBefore(today, DEFAULT_PAY_WEEK_START),
      onboardingStep: "trade",
    });
    await tx.insert(member).values({ id: uuidv7(), workspaceId: id, userId, role: "owner" });
    await activate(id);
    return { userId, workspaceId: id, role: "owner", name: me.name };
  });
}

export function createDbOnboarding(
  who: Actor | { userId: string },
  now: () => Date = () => new Date(),
): OnboardingService {
  /** The workspace actor: given, or the one `saveBusiness` just created for a set-up user. */
  let bound: Actor | null = "workspaceId" in who && who.workspaceId ? who : null;
  const setUpUser = bound ? null : who.userId;

  /** The caller's actor for a workspace call; a set-up user with no workspace yet gets `null`. */
  function resolve(actor: Actor): Actor | null {
    if (actor.userId !== who.userId) throw forbidden();
    if (bound) {
      if (actor.workspaceId && actor.workspaceId !== bound.workspaceId) throw forbidden();
      return { ...bound, role: actor.role };
    }
    if (actor.role !== "owner") throw forbidden();
    return null;
  }

  /** A write at `step`: the Owner, on the saved step (F6), inside one transaction. */
  async function at(
    actor: Actor,
    step: OnboardingStep,
    fn: (tx: Tx, a: Actor, w: Ws) => Promise<void>,
  ): Promise<OnboardingState> {
    const a = resolve(actor);
    if (!a) throw movedOn();
    return withActor(a, async (tx) => {
      const w = await ownerOf(tx, a, true);
      if (w.step !== step) throw movedOn();
      await fn(tx, a, w);
      return readState(tx, a);
    });
  }

  return {
    async state(actor) {
      const a = resolve(actor);
      if (!a) return BLANK;
      return withActor(a, async (tx) => {
        await ownerOf(tx, a);
        return readState(tx, a);
      });
    },
    async saveBusiness(actor, input) {
      const a = resolve(actor);
      refuseIf(businessIssues(input));
      if (!a) {
        bound = await createWorkspace(setUpUser!, input, now());
        return withActor(bound, (tx) => readState(tx, bound!));
      }
      return at(actor, "business", async (tx, b) => {
        await tx
          .update(workspace)
          .set({
            name: input.name.trim(),
            abn: cleanAbn(input.abn),
            gstRegistered: input.gstRegistered,
            onboardingStep: "trade",
            updatedAt: new Date(),
          })
          .where(eq(workspace.id, b.workspaceId));
      });
    },
    chooseTrade: (actor, trade) => at(actor, "trade", (tx, a) => moveTo(tx, a, "defaults", { trade })),
    acceptDefaults: (actor) =>
      at(actor, "defaults", async (tx, a) => {
        await copyDefaults(tx, a.workspaceId);
        await moveTo(tx, a, "crew");
      }),
    addCrew: (actor, input) =>
      at(actor, "crew", async (tx, a, w) => {
        const p = crewRowProblems(input);
        const issues: FieldIssue[] = [];
        if (p.name) issues.push({ field: "name", message: p.name });
        if (p.rate) issues.push({ field: "rate", message: p.rate });
        else if (!Number.isSafeInteger(input.rateCents))
          issues.push({ field: "rate", message: RATE_UNREADABLE });
        refuseIf(issues);
        const levelId = input.type === "employee" ? input.levelId : null;
        if (levelId !== null) {
          const [l] = await tx
            .select({ id: crewLevel.id })
            .from(crewLevel)
            .where(and(eq(crewLevel.workspaceId, a.workspaceId), sql`${crewLevel.id}::text = ${levelId}`));
          if (!l)
            throw new DataError("invalid", "Pick a level from the list.", [
              { field: "levelId", message: "Pick a level from the list." },
            ]);
        }
        const today = todayIn(w.timezone, now());
        const id = uuidv7();
        await tx.insert(crewMember).values({
          id,
          workspaceId: a.workspaceId,
          name: input.name.trim(),
          type: input.type,
          levelId,
          activeFrom: today,
          defaultBasis: input.basis,
        });
        await tx.insert(rate).values({
          id: uuidv7(),
          workspaceId: a.workspaceId,
          crewMemberId: id,
          basis: input.basis,
          unit: null,
          amountCents: input.rateCents,
          effectiveFrom: today,
          projectId: null,
        });
      }),
    finishCrew: (actor) => at(actor, "crew", (tx, a) => moveTo(tx, a, "install")),
    async back(actor) {
      const a = resolve(actor);
      if (!a) return BLANK;
      return withActor(a, async (tx) => {
        const w = await ownerOf(tx, a, true);
        const i = ONBOARDING_STEPS.indexOf(w.step);
        if (i > 0) await moveTo(tx, a, ONBOARDING_STEPS[i - 1]!);
        return readState(tx, a);
      });
    },
    finish: (actor) => at(actor, "install", (tx, a) => moveTo(tx, a, "done")),
  };
}
