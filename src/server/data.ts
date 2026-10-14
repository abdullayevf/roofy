/**
 * The db-mode data provider: `src/instrumentation.ts` registers it with `registerDbData()` when
 * `ROOFY_DATA=db`, and `getData()` / `getAuth()` / `getOnboarding*()` in `src/data` reach it through
 * `dbData()` (so `src/data` never imports `@/server/*`).
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
 * that actor must never reach withActor/shapeAccess or a workspace-scoped service (Task 12 replaces it).
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
      if (found.kind === "actor") return { redirect: "/" };
      // The person setting up becomes the new workspace's owner (Task 12 fills in the wizard).
      // Set-up only: this actor has no workspace (NO_WORKSPACE_ACTOR_ID), so it must never reach
      // withActor/shapeAccess or any workspace-scoped service. Task 12 replaces it.
      const actor = {
        userId: found.userId,
        workspaceId: NO_WORKSPACE_ACTOR_ID,
        role: "owner" as const,
        name: "",
      };
      return { actor, service: createDbOnboarding({ userId: found.userId }) };
    },
  };
}

export const dbDataProvider: DbDataProvider = createDbDataProvider({
  actorFromHeaders,
  now: () => new Date(),
});
