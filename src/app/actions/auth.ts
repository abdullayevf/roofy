"use server";
/**
 * Sign in and sign up, the email links, the two-factor code and invites. Prototype: the fake auth service
 * says who, this sets the demo session cookies and names where to go. Db mode: Better Auth sets its own
 * cookies (`nextCookies()`), so this only names where to go: Home, `/onboarding`, `/check-email`,
 * `/two-factor`, or Google's authorize URL. No prototype cookie is set in db mode.
 */
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { getAuth, isFakeMode, startNewWorkspace } from "@/data";
import { isDataError, type ActionResult, type AuthRedirect, type AuthService, type AuthSession } from "@/data/contracts";
import { fieldIssues, firstIssue } from "@/data/mutations";
import { SIGN_IN_FAILED } from "@/lib/auth-input";
import { ROLE_COOKIE, SESSION_COOKIE_OPTIONS, ensureDemoSession, isHttps } from "@/data/session";

const credentials = z.object({ email: z.string().max(1000), password: z.string().max(1000) });
const modeSchema = z.enum(["sign-in", "sign-up"]);
const short = z.string().max(1000);

async function enter(
  work: (auth: AuthService) => Promise<AuthSession | AuthRedirect>,
): Promise<ActionResult<{ next: string }>> {
  try {
    const session = await work(getAuth());
    if ("redirectTo" in session) return { ok: true, next: session.redirectTo };
    if (!isFakeMode()) return { ok: true, next: session.next };
    await ensureDemoSession();
    if (session.next === "/onboarding") await startNewWorkspace();
    (await cookies()).set(ROLE_COOKIE, session.role, { ...SESSION_COOKIE_OPTIONS, secure: isHttps("", await headers()) });
    return { ok: true, next: session.next };
  } catch (e) {
    if (isDataError(e)) return { ok: false, code: e.code, message: e.message, issues: [...e.issues] };
    console.error(e);
    return { ok: false, code: "unavailable", message: SIGN_IN_FAILED, issues: [] };
  }
}

function refuse<T extends object>(error: z.ZodError): ActionResult<T> {
  return { ok: false, code: "invalid", message: firstIssue(error), issues: fieldIssues(error) };
}

export async function signIn(email: string, password: string): Promise<ActionResult<{ next: string }>> {
  const parsed = credentials.safeParse({ email, password });
  return parsed.success ? enter((a) => a.signIn(parsed.data)) : refuse(parsed.error);
}

export async function signUp(email: string, password: string): Promise<ActionResult<{ next: string }>> {
  const parsed = credentials.safeParse({ email, password });
  return parsed.success ? enter((a) => a.signUp(parsed.data)) : refuse(parsed.error);
}

export async function continueWithGoogle(mode: "sign-in" | "sign-up"): Promise<ActionResult<{ next: string }>> {
  const parsed = modeSchema.safeParse(mode);
  return parsed.success ? enter((a) => a.continueWithGoogle(parsed.data)) : refuse(parsed.error);
}

export async function verifyTwoFactor(code: string): Promise<ActionResult<{ next: string }>> {
  const parsed = short.safeParse(code);
  return parsed.success ? enter((a) => a.verifyTwoFactor(parsed.data)) : refuse(parsed.error);
}

export async function verifyEmail(token: string): Promise<ActionResult<{ next: string }>> {
  const parsed = short.safeParse(token);
  return parsed.success ? enter((a) => a.verifyEmail(parsed.data)) : refuse(parsed.error);
}

export async function acceptInvite(invitationId: string): Promise<ActionResult<{ next: string }>> {
  const parsed = short.safeParse(invitationId);
  return parsed.success ? enter((a) => a.acceptInvite(parsed.data)) : refuse(parsed.error);
}

/** Runs a step that signs nobody in: its refusals read like sign-in's. */
async function answer<T extends object>(work: (auth: AuthService) => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await work(getAuth())) };
  } catch (e) {
    if (isDataError(e)) return { ok: false, code: e.code, message: e.message, issues: [...e.issues] };
    console.error(e);
    return { ok: false, code: "unavailable", message: SIGN_IN_FAILED, issues: [] };
  }
}

/** "Send link": the same sentence whether or not the email has an account. */
export async function requestPasswordReset(email: string): Promise<ActionResult<{ message: string }>> {
  const parsed = short.safeParse(email);
  return parsed.success ? answer((a) => a.requestPasswordReset(parsed.data)) : refuse(parsed.error);
}

/** The new password from the reset link; afterwards the person signs in again. */
export async function resetPassword(token: string, password: string): Promise<ActionResult<object>> {
  const parsed = z.object({ token: short, password: short }).safeParse({ token, password });
  return parsed.success ? answer(async (a) => (await a.resetPassword(parsed.data.token, parsed.data.password), {})) : refuse(parsed.error);
}
