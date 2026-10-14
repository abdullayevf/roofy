// The Better Auth instance: Drizzle adapter on the roofy_auth pool, email + password with
// verification, the organization plugin (organization = workspace), TOTP, database rate limits.
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { createAccessControl } from "better-auth/plugins/access";
import { organization } from "better-auth/plugins/organization";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { and, desc, eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { DataError, type Role } from "@/data/contracts";
import { getAuthDb } from "@/server/db/client";
import { requireEnv } from "@/server/db/env";
import { account, invitation, member, rateLimit, session, twoFactor as twoFactorTable, user, verification, workspace } from "@/server/db/schema";
import { getMailer, inviteEmail, resetEmail, verificationEmail } from "@/server/email";
import { assertInvite, assertKeepsAnOwner } from "@/server/authz/members";
import { isRole, roleFrom } from "./role";

const ac = createAccessControl(defaultStatements);

/** The organization access-control roles, one per Roofy `Role`. What each may do lives in authz. */
export const ROLES_AC = {
  owner: ac.newRole(ownerAc.statements),
  manager: ac.newRole(adminAc.statements),
  foreman: ac.newRole(memberAc.statements),
  accountant: ac.newRole(memberAc.statements),
} satisfies Record<Role, unknown>;

/** Wrong passwords allowed per window (seconds) before sign-in answers 429. */
export const SIGN_IN_LIMIT = { window: 60, max: 5 };

async function send(to: string, content: { subject: string; text: string; html: string }): Promise<void> {
  await getMailer().send({ to, ...content });
}

function google(): { google: { clientId: string; clientSecret: string } } | Record<string, never> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  return { google: { clientId, clientSecret } };
}

/** Refuses (400 UNKNOWN_ROLE) a role that is not exactly one Roofy role, before any row is written. */
function oneRole(role: unknown): void {
  if (!isRole(role)) {
    throw new APIError("BAD_REQUEST", { code: "UNKNOWN_ROLE", message: "Pick one of owner, manager, foreman or accountant." });
  }
}

/** A service refusal as the Better Auth error the organization endpoints answer with. */
function asApiError(e: unknown): unknown {
  if (!(e instanceof DataError)) return e;
  const status = e.code === "forbidden" ? "FORBIDDEN" : "BAD_REQUEST";
  return new APIError(status, { code: e.code.toUpperCase(), message: e.message });
}

/**
 * Carry note T8: `/api/auth/organization/invite-member` called directly is held to the service's
 * rules (`assertInvite`): Manager never invites as Owner, an Owner only with 2FA, no email already
 * in the team or already invited. Better Auth's own checks run too; this one decides the wording.
 */
async function guardInvite(inv: { email: string; role: string; organizationId: string; inviterId: string }): Promise<void> {
  const db = getAuthDb();
  const wsId = inv.organizationId;
  const email = inv.email.trim().toLowerCase();
  const [me] = await db
    .select({ role: member.role, twoFactorEnabled: user.twoFactorEnabled, name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.workspaceId, wsId), eq(member.userId, inv.inviterId)));
  if (!me) throw new APIError("FORBIDDEN", { code: "FORBIDDEN", message: "You don't have access to this." });
  const taken = await db
    .select({ id: member.id })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.workspaceId, wsId), sql`lower(${user.email}) = ${email}`));
  const pending = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(and(eq(invitation.workspaceId, wsId), sql`lower(${invitation.email}) = ${email}`, eq(invitation.status, "pending"), sql`${invitation.expiresAt} > now()`));
  const actor = { userId: inv.inviterId, workspaceId: wsId, role: roleFrom(me.role), name: me.name, twoFactorEnabled: me.twoFactorEnabled };
  try {
    assertInvite(actor, roleFrom(inv.role), { alreadyMember: taken.length > 0, alreadyInvited: pending.length > 0 });
  } catch (e) {
    throw asApiError(e);
  }
}

/** Carry note T8: `update-member-role` called directly never leaves a workspace without an Owner. */
async function guardKeepsAnOwner(m: { role: string; organizationId: string }, newRole: string): Promise<void> {
  const owners = await getAuthDb()
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.workspaceId, m.organizationId), eq(member.role, "owner")));
  try {
    assertKeepsAnOwner(m.role, newRole, owners.length);
  } catch (e) {
    throw asApiError(e);
  }
}

/** The workspace a new session opens: the user's most recently joined membership, or none. */
async function latestWorkspaceId(userId: string): Promise<string | undefined> {
  const [row] = await getAuthDb()
    .select({ workspaceId: member.workspaceId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(desc(member.createdAt), desc(member.id))
    .limit(1);
  return row?.workspaceId;
}

/** Builds a Better Auth instance from the environment as it is now. */
export function createAuth() {
  const secret = requireEnv("BETTER_AUTH_SECRET");
  const baseURL = requireEnv("BETTER_AUTH_URL").replace(/\/+$/, "");
  return betterAuth({
    secret,
    baseURL,
    basePath: "/api/auth",
    database: drizzleAdapter(getAuthDb(), {
      provider: "pg",
      schema: { user, session, account, verification, twoFactor: twoFactorTable, rateLimit, workspace, member, invitation },
    }),
    advanced: {
      database: { generateId: () => uuidv7() },
      useSecureCookies: baseURL.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => send(user.email, resetEmail(url)),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => send(user.email, verificationEmail(url)),
    },
    socialProviders: google(),
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (session.activeOrganizationId) return;
            const activeOrganizationId = await latestWorkspaceId(session.userId);
            return activeOrganizationId ? { data: { activeOrganizationId } } : undefined;
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: { "/sign-in/email": SIGN_IN_LIMIT },
    },
    plugins: [
      organization({
        ac,
        roles: ROLES_AC,
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
        // Workspaces are soft-deleted through Roofy, never cascaded away through Better Auth.
        disableOrganizationDeletion: true,
        organizationHooks: {
          beforeCreateInvitation: async ({ invitation }) => {
            oneRole(invitation.role);
            await guardInvite(invitation);
          },
          beforeAddMember: async ({ member }) => oneRole(member.role),
          beforeUpdateMemberRole: async ({ member, newRole }) => {
            oneRole(newRole);
            await guardKeepsAnOwner(member, newRole);
          },
        },
        schema: {
          session: { fields: { activeOrganizationId: "activeWorkspaceId" } },
          organization: { modelName: "workspace" },
          member: { fields: { organizationId: "workspaceId" } },
          invitation: { fields: { organizationId: "workspaceId" } },
        },
        sendInvitationEmail: async ({ id, role, email, organization: ws, inviter }) =>
          send(
            email,
            inviteEmail({
              workspaceName: ws.name,
              inviterName: inviter.user.name,
              role: roleFrom(role),
              url: `${baseURL}/invite/${id}`,
            }),
          ),
      }),
      twoFactor({ issuer: "Roofy" }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** The shared instance, built on first use so a missing variable fails then, not at import. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
