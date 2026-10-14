/**
 * The db-mode data provider: `src/instrumentation.ts` registers it with `registerDbData()` when
 * `ROOFY_DATA=db`, and `getData()` / `getAuth()` / `getOnboarding*()` in `src/data` reach it through
 * `dbData()` (so `src/data` never imports `@/server/*`).
 *
 * A workspace whose set-up wizard is not done sends its members to `/onboarding` (carry T10); a finished
 * one's members get the app, and `/onboarding` sends them to `/`.
 *
 * Who is asking comes only from `actorFromHeaders` (Better Auth's own session helper, never the
 * cookie by name). The work date is `todayIn(workspace timezone, now)`, never the server's date.
 */
import type { DataContextCore, DbDataProvider } from "@/data/db-registry";
import { todayIn } from "@/domain/dates";
import { actorFromHeaders, type ActorResult } from "@/server/auth/actor";
import { createDbAuth, createDbOnboarding, createDbServices } from "@/server/services";

/**
 * Someone setting up their first workspace has none yet: their wizard actor carries this id. Set-up only:
 * `createDbOnboarding({ userId })` reads only its userId and never hands it to withActor/shapeAccess.
 */
export const NO_WORKSPACE_ACTOR_ID = "";

export interface DbDataDeps {
  actorFromHeaders(h: Headers): Promise<ActorResult>;
  now(): Date;
}

export function createDbDataProvider(deps: DbDataDeps): DbDataProvider {
  return {
    async context(h): Promise<DataContextCore | { redirect: "/sign-in" | "/onboarding" }> {
      const found = await deps.actorFromHeaders(h);
      if (found.kind === "signed-out") return { redirect: "/sign-in" };
      if (found.kind === "no-workspace") return { redirect: "/onboarding" };
      if (found.onboardingStep !== "done") return { redirect: "/onboarding" };
      return {
        actor: found.actor,
        data: createDbServices(found.actor),
        today: todayIn(found.timezone, deps.now()),
        workspaceName: found.workspaceName,
      };
    },
    auth: () => createDbAuth(),
    async onboarding(h) {
      const found = await deps.actorFromHeaders(h);
      if (found.kind === "signed-out") return { redirect: "/sign-in" };
      if (found.kind === "actor") {
        if (found.onboardingStep === "done") return { redirect: "/" };
        return { actor: found.actor, service: createDbOnboarding(found.actor, deps.now) };
      }
      // The person setting up becomes the new workspace's owner. This actor has no workspace
      // (NO_WORKSPACE_ACTOR_ID): the service bound to `{ userId }` never hands it to withActor or
      // shapeAccess; `saveBusiness` creates the workspace and serves the rest as its Owner.
      const actor = {
        userId: found.userId,
        workspaceId: NO_WORKSPACE_ACTOR_ID,
        role: "owner" as const,
        name: "",
      };
      return { actor, service: createDbOnboarding({ userId: found.userId }, deps.now) };
    },
  };
}

export const dbDataProvider: DbDataProvider = createDbDataProvider({
  actorFromHeaders,
  now: () => new Date(),
});
