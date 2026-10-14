// Session → Actor. The user's name comes from the Better Auth session; role, workspace name and
// timezone from the member and workspace rows, read through the roofy_auth pool.
import { and, eq } from "drizzle-orm";
import { cache } from "react";
import type { Actor, OnboardingStep } from "@/data/contracts";
import { getAuthDb } from "@/server/db/client";
import { member, workspace } from "@/server/db/schema";
import { getAuth } from "./auth";
import { roleFrom } from "./role";

export { roleFrom };

export type ActorResult =
  | { kind: "actor"; actor: Actor; timezone: string; workspaceName: string; onboardingStep: OnboardingStep }
  | { kind: "signed-out" }
  | { kind: "no-workspace"; userId: string };

/**
 * Who is asking, from the request headers. A session whose active workspace the user is not a
 * member of (or no active workspace) answers `no-workspace`, never an actor for that workspace.
 * Wrapped in `React.cache`, so one server request reads the session and member row once however
 * many services ask (outside a request it simply calls through).
 */
export const actorFromHeaders = cache(async function actorFromHeaders(h: Headers): Promise<ActorResult> {
  const found = await getAuth().api.getSession({ headers: h });
  if (!found) return { kind: "signed-out" };
  const userId = found.user.id;
  const workspaceId = found.session.activeOrganizationId;
  if (!workspaceId) return { kind: "no-workspace", userId };
  const [row] = await getAuthDb()
    .select({ role: member.role, name: workspace.name, timezone: workspace.timezone, step: workspace.onboardingStep })
    .from(member)
    .innerJoin(workspace, eq(workspace.id, member.workspaceId))
    .where(and(eq(member.workspaceId, workspaceId), eq(member.userId, userId)))
    .limit(1);
  if (!row) return { kind: "no-workspace", userId };
  return {
    kind: "actor",
    actor: { userId, workspaceId, role: roleFrom(row.role), name: found.user.name },
    timezone: row.timezone,
    workspaceName: row.name,
    onboardingStep: row.step,
  };
});
