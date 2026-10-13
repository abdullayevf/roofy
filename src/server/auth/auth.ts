// The Better Auth instance: Drizzle adapter on the roofy_auth pool, email + password with
// verification, the organization plugin (organization = workspace), TOTP, database rate limits.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { createAccessControl } from "better-auth/plugins/access";
import { organization } from "better-auth/plugins/organization";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { v7 as uuidv7 } from "uuid";
import type { Role } from "@/data/contracts";
import { getAuthDb } from "@/server/db/client";
import { requireEnv } from "@/server/db/env";
import { account, invitation, member, rateLimit, session, twoFactor as twoFactorTable, user, verification, workspace } from "@/server/db/schema";
import { getMailer, inviteEmail, resetEmail, verificationEmail } from "@/server/email";
import { roleFrom } from "./role";

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

/** Builds a Better Auth instance from the environment as it is now. */
export function createAuth() {
  const secret = requireEnv("BETTER_AUTH_SECRET");
  const baseURL = requireEnv("BETTER_AUTH_URL");
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
      sendResetPassword: async ({ user, url }) => send(user.email, resetEmail(url)),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => send(user.email, verificationEmail(url)),
    },
    socialProviders: google(),
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
