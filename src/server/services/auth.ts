/**
 * The real sign-in service (Task 12): Better Auth's endpoints, answered in the fake's words.
 *
 * The browser's cookies come from `requestHeaders()` and Set-Cookie goes back through `keepCookies()`.
 * Inside a Server Function, `nextCookies()` (the Better Auth plugin) already writes them, so the default
 * keeps nothing; tests hand in a cookie jar. No prototype cookie is ever set here.
 *
 * Where to go next: unverified → `/check-email`, TOTP on → `/two-factor`, no workspace or an unfinished one
 * → `/onboarding`, otherwise Home. The role is the member row of the workspace the session opens.
 */
import { and, desc, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { headers as nextHeaders } from "next/headers";
import {
  DataError,
  type AuthService,
  type AuthSession,
  type FieldIssue,
  type Role,
  type SignInInput,
} from "@/data/contracts";
import {
  authProblems,
  emailProblem,
  EMAIL_NOT_VERIFIED,
  EMAIL_TAKEN,
  GOOGLE_OFF,
  INVITE_GONE,
  INVITE_OTHER_EMAIL,
  LINK_EXPIRED,
  passwordProblem,
  RESET_LINK_SENT,
  SIGN_IN_AGAIN,
  TOO_MANY_TRIES,
  TWO_FACTOR_CODE,
  WRONG_CODE,
  WRONG_OWN_PASSWORD,
  WRONG_PASSWORD,
  type AuthMode,
} from "@/lib/auth-input";
import { getAuth, type Auth } from "@/server/auth/auth";
import { codeSubjects, normalEmail, overLimit, type ThrottleKind } from "@/server/auth/throttle";
import { roleFrom } from "@/server/auth/role";
import { getAuthDb } from "@/server/db/client";
import { member, workspace } from "@/server/db/schema";

export interface DbAuthDeps {
  auth(): Auth;
  /** The incoming request's headers: the session cookie, or the cookie of a sign-in waiting for its code. */
  requestHeaders(): Promise<Headers>;
  /** Hands Set-Cookie back to the browser. In a Server Function `nextCookies()` already has. */
  keepCookies(h: Headers): void | Promise<void>;
  /** The clock the try count reads (ms); `Date.now` unless a test turns it. */
  now?: () => number;
}

/** The db service also signs out (the prototype's sign-out only drops its cookies). */
export type DbAuthService = AuthService & { signOut(): Promise<void> };

const DEFAULT_DEPS: DbAuthDeps = {
  auth: getAuth,
  requestHeaders: async () => new Headers(await nextHeaders()),
  keepCookies: () => undefined,
};

function refuseField(field: string, message: string): never {
  throw new DataError("invalid", message, [{ field, message }]);
}

function check(mode: AuthMode, input: SignInInput): void {
  const problems = authProblems(mode, input);
  const issues: FieldIssue[] = [];
  if (problems.email) issues.push({ field: "email", message: problems.email });
  if (problems.password) issues.push({ field: "password", message: problems.password });
  if (issues.length > 0) throw new DataError("invalid", issues[0]!.message, issues);
}

/** Better Auth's refusal as `{ status, code }`; anything else (an outage) is rethrown untouched. */
function refusalOf(e: unknown): { status: number; code: string } {
  if (!(e instanceof APIError)) throw e;
  return { status: e.statusCode, code: String((e.body as { code?: string } | undefined)?.code ?? "") };
}

function tooMany(status: number): void {
  if (status === 429) throw new DataError("invalid", TOO_MANY_TRIES);
}

/** Where a signed-in user lands: the workspace the session opens (the latest membership, as Better Auth's session hook picks) or one named. */
async function landing(userId: string, workspaceId?: string): Promise<AuthSession> {
  const [row] = await getAuthDb()
    .select({ role: member.role, step: workspace.onboardingStep })
    .from(member)
    .innerJoin(workspace, eq(workspace.id, member.workspaceId))
    .where(
      workspaceId
        ? and(eq(member.userId, userId), eq(member.workspaceId, workspaceId))
        : eq(member.userId, userId),
    )
    .orderBy(desc(member.createdAt), desc(member.id))
    .limit(1);
  if (!row) return { role: "owner", next: "/onboarding" };
  return { role: roleFrom(row.role), next: row.step === "done" ? "/" : "/onboarding" };
}

const normal = normalEmail;

/**
 * The service calls `auth.api.*` directly, which Better Auth's per-IP limiter never sees, so each call
 * spends a try in the shared per-email count first (the catch-all route's hook spends the same count).
 */
async function throttle(kind: ThrottleKind, subject: string, now: number): Promise<void> {
  if (await overLimit(kind, subject, now)) throw new DataError("invalid", TOO_MANY_TRIES);
}

export function createDbAuth(deps: DbAuthDeps = DEFAULT_DEPS): DbAuthService {
  const api = () => deps.auth().api;
  const now = () => (deps.now ?? Date.now)();

  return {
    async signIn(input) {
      check("sign-in", input);
      const email = normal(input.email);
      await throttle("sign-in", email, now());
      try {
        const res = await api().signInEmail({
          body: { email, password: input.password },
          headers: await deps.requestHeaders(),
          returnHeaders: true,
        });
        await deps.keepCookies(res.headers);
        const body = res.response as { twoFactorRedirect?: boolean; user?: { id: string } };
        if (body.twoFactorRedirect) return { ...(await landingByEmail(email)), next: "/two-factor" };
        return landing(body.user?.id ?? "");
      } catch (e) {
        const { status, code } = refusalOf(e);
        tooMany(status);
        if (code === "EMAIL_NOT_VERIFIED") throw new DataError("invalid", EMAIL_NOT_VERIFIED);
        throw new DataError("invalid", WRONG_PASSWORD);
      }
    },

    async signUp(input) {
      check("sign-up", input);
      const email = normal(input.email);
      await throttle("sign-up", email, now());
      // Better Auth answers a taken email with a silent success; the sign-up screen says so instead (the fake's copy).
      if (await userIdByEmail(email)) refuseField("email", EMAIL_TAKEN);
      try {
        // Better Auth needs a name; until set-up asks, the email's local part stands in.
        await api().signUpEmail({
          body: { email, password: input.password, name: email.split("@")[0] ?? email },
        });
      } catch (e) {
        const { status, code } = refusalOf(e);
        tooMany(status);
        if (code.startsWith("USER_ALREADY_EXISTS")) refuseField("email", EMAIL_TAKEN);
        throw e;
      }
      return { role: "owner", next: "/check-email" };
    },

    async continueWithGoogle(mode) {
      try {
        const res = await api().signInSocial({
          body: {
            provider: "google",
            callbackURL: mode === "sign-up" ? "/onboarding" : "/",
            newUserCallbackURL: "/onboarding",
            errorCallbackURL: mode === "sign-up" ? "/sign-up" : "/sign-in",
          },
          headers: await deps.requestHeaders(),
          returnHeaders: true,
        });
        await deps.keepCookies(res.headers);
        if (!res.response.url) throw new DataError("unavailable", GOOGLE_OFF);
        return { redirectTo: res.response.url };
      } catch (e) {
        if (e instanceof DataError) throw e;
        const { code } = refusalOf(e);
        if (code === "PROVIDER_NOT_FOUND") throw new DataError("unavailable", GOOGLE_OFF);
        throw e;
      }
    },

    async verifyEmail(token) {
      if (token.trim() === "") throw new DataError("invalid", LINK_EXPIRED);
      try {
        const res = await api().verifyEmail({ query: { token: token.trim() }, returnHeaders: true });
        await deps.keepCookies(res.headers);
        const user = (res.response as { user?: { id: string } } | null)?.user;
        return user ? landing(user.id) : { role: "owner", next: "/onboarding" };
      } catch (e) {
        refusalOf(e);
        throw new DataError("invalid", LINK_EXPIRED);
      }
    },

    async requestPasswordReset(email) {
      const problem = emailProblem(email);
      if (problem) refuseField("email", problem);
      await throttle("reset", normal(email), now());
      try {
        await api().requestPasswordReset({ body: { email: normal(email), redirectTo: "/reset-password" } });
      } catch (e) {
        // Never reveal whether the email has an account, not even through a failure only known emails reach.
        console.error(e);
      }
      return { message: RESET_LINK_SENT };
    },

    async resetPassword(token, password) {
      if (token.trim() === "") throw new DataError("invalid", LINK_EXPIRED);
      const problem = passwordProblem(password, "sign-up");
      if (problem) refuseField("password", problem);
      try {
        await api().resetPassword({ body: { token: token.trim(), newPassword: password } });
      } catch (e) {
        refusalOf(e);
        throw new DataError("invalid", LINK_EXPIRED);
      }
    },

    async verifyTwoFactor(code) {
      if (!/^\d{6}$/.test(code.trim())) refuseField("code", TWO_FACTOR_CODE);
      const h = await deps.requestHeaders();
      // No sign-in waiting and no session: Better Auth refuses it without checking a code.
      for (const subject of codeSubjects(h)) await throttle("two-factor", subject, now());
      try {
        const res = await api().verifyTOTP({
          body: { code: code.trim() },
          headers: h,
          returnHeaders: true,
        });
        await deps.keepCookies(res.headers);
        return landing((res.response as { user: { id: string } }).user.id);
      } catch (e) {
        const found = refusalOf(e);
        tooMany(found.status);
        if (found.code === "INVALID_CODE") refuseField("code", WRONG_CODE);
        throw new DataError("invalid", SIGN_IN_AGAIN);
      }
    },

    /** A password sign-in leaves a "credential" account; a Google sign-up does not. */
    async hasPassword() {
      const h = await deps.requestHeaders();
      if (!(await api().getSession({ headers: h }))) throw new DataError("invalid", SIGN_IN_AGAIN);
      const accounts = (await api().listUserAccounts({ headers: h })) as { providerId: string }[];
      return accounts.some((a) => a.providerId === "credential");
    },

    /** Better Auth makes a new key for the signed-in person; it asks for the password unless the account has none (Google). */
    async startTwoFactor(password) {
      const h = await deps.requestHeaders();
      if (!(await api().getSession({ headers: h }))) throw new DataError("invalid", SIGN_IN_AGAIN);
      try {
        const res = (await api().enableTwoFactor({
          body: { method: "totp", ...(password === "" ? {} : { password }) },
          headers: h,
        })) as { totpURI: string };
        const secret = new URL(res.totpURI).searchParams.get("secret") ?? "";
        return { secret: secret.replace(/(.{4})(?=.)/g, "$1 "), uri: res.totpURI };
      } catch (e) {
        const found = refusalOf(e);
        if (found.code === "INVALID_PASSWORD") refuseField("password", WRONG_OWN_PASSWORD);
        throw new DataError("invalid", SIGN_IN_AGAIN);
      }
    },

    /** The first code from the app: Better Auth checks it against the new key and then turns two-factor on. */
    async confirmTwoFactor(code) {
      if (!/^\d{6}$/.test(code.trim())) refuseField("code", TWO_FACTOR_CODE);
      const h = await deps.requestHeaders();
      for (const subject of codeSubjects(h)) await throttle("two-factor", subject, now());
      try {
        const res = await api().verifyTOTP({ body: { code: code.trim() }, headers: h, returnHeaders: true });
        await deps.keepCookies(res.headers);
      } catch (e) {
        const found = refusalOf(e);
        tooMany(found.status);
        if (found.code === "INVALID_CODE") refuseField("code", WRONG_CODE);
        throw new DataError("invalid", SIGN_IN_AGAIN);
      }
    },

    async inviteDetails(invitationId) {
      if (invitationId.trim() === "") throw new DataError("invalid", INVITE_GONE);
      const h = await deps.requestHeaders();
      if (!(await api().getSession({ headers: h }))) throw new DataError("invalid", SIGN_IN_AGAIN);
      try {
        const found = (await api().getInvitation({ query: { id: invitationId.trim() }, headers: h })) as {
          status: string;
          role: string;
          organizationName: string;
        } | null;
        if (!found || found.status !== "pending") throw new DataError("invalid", INVITE_GONE);
        return { workspaceName: found.organizationName, role: found.role as Role };
      } catch (e) {
        if (e instanceof DataError) throw e;
        refusalOf(e);
        throw new DataError("invalid", INVITE_GONE);
      }
    },

    async acceptInvite(invitationId) {
      if (invitationId.trim() === "") throw new DataError("invalid", INVITE_GONE);
      const h = await deps.requestHeaders();
      const session = await api().getSession({ headers: h });
      if (!session) throw new DataError("invalid", SIGN_IN_AGAIN);
      try {
        const res = await api().acceptInvitation({
          body: { invitationId: invitationId.trim() },
          headers: h,
          returnHeaders: true,
        });
        await deps.keepCookies(res.headers);
        const joined = res.response as { invitation: { organizationId: string } } | null;
        if (!joined) throw new DataError("invalid", INVITE_GONE);
        return landing(session.user.id, joined.invitation.organizationId);
      } catch (e) {
        if (e instanceof DataError) throw e;
        const { code } = refusalOf(e);
        if (code === "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION")
          throw new DataError("forbidden", INVITE_OTHER_EMAIL);
        throw new DataError("invalid", INVITE_GONE);
      }
    },

    async signOut() {
      try {
        const res = await api().signOut({ headers: await deps.requestHeaders(), returnHeaders: true });
        await deps.keepCookies(res.headers);
      } catch (e) {
        // No session to end (already signed out) is fine; any other refusal or outage is rethrown.
        if (refusalOf(e).status !== 401) throw e;
      }
    },
  };

  /** The role a sign-in waiting for its code will land with (the session opens only after the code). */
  async function landingByEmail(email: string): Promise<AuthSession> {
    return landing((await userIdByEmail(email)) ?? "");
  }

  async function userIdByEmail(email: string): Promise<string | undefined> {
    const ctx = await deps.auth().$context;
    return (await ctx.internalAdapter.findUserByEmail(email))?.user.id;
  }
}
