// The per-email (and per-waiting-sign-in) try count shared by the auth service and the catch-all
// /api/auth route, so both entry points spend one count. Stored in Better Auth's `rate_limit` table.
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getAuthDb } from "@/server/db/client";

/** Five tries a minute: the same rule Better Auth's own limiter applies to sign-in per IP. */
export const SIGN_IN_LIMIT = { window: 60, max: 5 };

export type ThrottleKind = "sign-in" | "sign-up" | "reset" | "two-factor";

export const normalEmail = (email: string) => email.trim().toLowerCase();

/**
 * Counts one try at `kind` for `subject` at `now` (ms) and answers whether it is past the limit. The window
 * starts at the first try; a refused try does not extend it. Keys are hashed (no email stored) and prefixed
 * apart from Better Auth's. A try that starts a new count also clears this throttle's ended counts.
 */
export async function overLimit(kind: ThrottleKind, subject: string, now: number): Promise<boolean> {
  const key = `roofy:${kind}:${createHash("sha256").update(subject).digest("hex")}`;
  const since = now - SIGN_IN_LIMIT.window * 1000;
  const db = getAuthDb();
  const res = await db.execute<{ count: number }>(sql`
    insert into rate_limit (id, key, count, last_request)
    values (gen_random_uuid(), ${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limit.last_request <= ${since} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request <= ${since} then ${now} else rate_limit.last_request end
    returning count`);
  const count = Number(res.rows[0]?.count ?? 0);
  if (count === 1) await db.execute(sql`delete from rate_limit where key like 'roofy:%' and last_request <= ${since}`);
  return count > SIGN_IN_LIMIT.max;
}

/**
 * The cookies that name a code check: the sign-in waiting for its code, or the session turning TOTP on.
 * Each is counted on its own, so junk copies sent beside the real cookie still count against the real one.
 * Values are percent-decoded as Better Auth reads them, so a re-encoded copy is the same subject.
 */
export function codeSubjects(h: Headers): string[] {
  const found = (h.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => /^(__Secure-)?better-auth\.(two_factor|session_token)=/.test(c))
    .map((c) => {
      const at = c.indexOf("=");
      return `${c.slice(0, at)}=${decoded(c.slice(at + 1))}`;
    });
  return [...new Set(found)];
}

function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The paths of the catch-all route that the hook counts, and what each counts. */
export const THROTTLED_PATHS: Record<string, ThrottleKind> = {
  "/sign-in/email": "sign-in",
  "/sign-up/email": "sign-up",
  "/request-password-reset": "reset",
  "/two-factor/verify-totp": "two-factor",
};

/** The subjects one request spends a try on: the email for sign-in, sign-up and reset; the code cookies for TOTP. */
export function subjectsOf(kind: ThrottleKind, body: unknown, h: Headers): string[] {
  if (kind === "two-factor") return codeSubjects(h);
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? [normalEmail(email)] : [];
}
