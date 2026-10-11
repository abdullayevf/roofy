"use server";
/** Sign in and sign up (prototype): the fake auth service says who, this sets the session cookies and names where to go. */
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { getAuth } from "@/data";
import { isDataError, type ActionResult, type AuthService, type AuthSession } from "@/data/contracts";
import { fieldIssues, firstIssue } from "@/data/mutations";
import { SIGN_IN_FAILED } from "@/lib/auth-input";
import { ROLE_COOKIE, SESSION_COOKIE_OPTIONS, ensureDemoSession, isHttps } from "@/data/session";

const credentials = z.object({ email: z.string().max(1000), password: z.string().max(1000) });
const modeSchema = z.enum(["sign-in", "sign-up"]);

async function enter(work: (auth: AuthService) => Promise<AuthSession>): Promise<ActionResult<{ next: string }>> {
  try {
    const session = await work(getAuth());
    await ensureDemoSession();
    (await cookies()).set(ROLE_COOKIE, session.role, { ...SESSION_COOKIE_OPTIONS, secure: isHttps("", await headers()) });
    return { ok: true, next: session.next };
  } catch (e) {
    if (isDataError(e)) return { ok: false, code: e.code, message: e.message, issues: [...e.issues] };
    console.error(e);
    return { ok: false, code: "unavailable", message: SIGN_IN_FAILED, issues: [] };
  }
}

function refuse(error: z.ZodError): ActionResult<{ next: string }> {
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
