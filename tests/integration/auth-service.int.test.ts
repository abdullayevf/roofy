/**
 * The real sign-in service (Task 12 run 2) against Better Auth on roofy_test. Each "browser" is a cookie
 * jar: the service reads the request's cookies from it and hands Set-Cookie back to it, as `nextCookies()`
 * does inside a Server Function.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError } from "@/data/contracts";
import { createFakeAuth } from "@/data/fake/services/auth";
import {
  EMAIL_NOT_VERIFIED,
  EMAIL_TAKEN,
  GOOGLE_OFF,
  INVITE_GONE,
  INVITE_OTHER_EMAIL,
  LINK_EXPIRED,
  RESET_LINK_SENT,
  SIGN_IN_AGAIN,
  TOO_MANY_TRIES,
  TWO_FACTOR_CODE,
  WRONG_CODE,
  WRONG_PASSWORD,
} from "@/lib/auth-input";
import { actorFromHeaders } from "@/server/auth/actor";
import { APIError } from "better-auth/api";
import { createAuth, getAuth, type Auth } from "@/server/auth/auth";
import { codeSubjects } from "@/server/auth/throttle";
import { createDbAuth } from "@/server/services/auth";
import { closePools, makeWorkspace, pool, rows } from "./helpers";

const BASE = "http://localhost:3100";
const PASSWORD = "correct horse battery";
let mailLog = "";

type Mail = { to: string; subject: string; text: string; links: string[] };
function mailsTo(to: string): Mail[] {
  if (!existsSync(mailLog)) return [];
  return readFileSync(mailLog, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Mail)
    .filter((m) => m.to === to);
}
function tokenFrom(link: string): string {
  const url = new URL(link);
  return url.searchParams.get("token") ?? url.pathname.split("/").pop() ?? "";
}
function base32Decode(text: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of text.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2))).toString("utf8");
}

/** One browser: its cookies, the headers it sends, and the service bound to it. */
function browser(auth = getAuth, now?: () => number) {
  const cookies = new Map<string, string>();
  const headers = () => new Headers({ cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") });
  const service = createDbAuth({
    auth,
    now,
    requestHeaders: async () => headers(),
    keepCookies: (h) => {
      for (const c of h.getSetCookie()) {
        const pair = c.split(";")[0] ?? "";
        const at = pair.indexOf("=");
        const [k, v] = [pair.slice(0, at), pair.slice(at + 1)];
        if (v === "" || /max-age=0\b/i.test(c)) cookies.delete(k);
        else cookies.set(k, v);
      }
    },
  });
  return { cookies, headers, service };
}

async function refusal(p: Promise<unknown>): Promise<DataError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof DataError) return e;
    throw e;
  }
  throw new Error("expected a refusal");
}

let n = 0;
const freshEmail = () => `svc${Date.now()}${n++}@example.com`;

/** Signs up and follows the verification link in the same browser: signed in, no workspace yet. */
async function verifiedUser(b = browser(), email = freshEmail()) {
  await b.service.signUp({ email, password: PASSWORD });
  await b.service.verifyEmail(tokenFrom(mailsTo(email).at(-1)?.links[0] ?? ""));
  const found = await actorFromHeaders(b.headers());
  if (found.kind !== "no-workspace") throw new Error(`expected no workspace, got ${found.kind}`);
  return { b, email, userId: found.userId };
}

describe("db auth service", () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
    process.env.BETTER_AUTH_URL = BASE;
    process.env.ROOFY_MAIL = "console";
    mailLog = join(mkdtempSync(join(tmpdir(), "roofy-auth-svc-")), "mail.jsonl");
    process.env.ROOFY_MAIL_LOG = mailLog;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
  afterAll(async () => {
    await closePools();
  });

  it("signUp names /check-email and sends one verification mail; the same email again is taken", async () => {
    const email = freshEmail();
    expect(await browser().service.signUp({ email, password: PASSWORD })).toEqual({
      role: "owner",
      next: "/check-email",
    });
    expect(mailsTo(email)).toHaveLength(1);
    expect(await rows("owner", 'select email_verified from "user" where email = $1', [email])).toEqual([
      { email_verified: false },
    ]);
    const e = await refusal(browser().service.signUp({ email: email.toUpperCase(), password: PASSWORD }));
    expect([e.code, e.message, e.issues]).toEqual([
      "invalid",
      EMAIL_TAKEN,
      [{ field: "email", message: EMAIL_TAKEN }],
    ]);
  });

  it("refuses a blank or unusable field with the same issues as the fake, before anything is written", async () => {
    const fake = createFakeAuth();
    for (const [mode, input] of [
      ["signUp", { email: "", password: "" }],
      ["signUp", { email: "not-an-email", password: "short" }],
      ["signIn", { email: "", password: "" }],
    ] as const) {
      const real = await refusal(browser().service[mode](input));
      const expected = await refusal(fake[mode](input));
      expect([real.code, real.message, real.issues]).toEqual([
        expected.code,
        expected.message,
        expected.issues,
      ]);
    }
  });

  it("signIn before the email is verified is refused with the fake's copy and sends a new link", async () => {
    const email = freshEmail();
    await browser().service.signUp({ email, password: PASSWORD });
    const e = await refusal(browser().service.signIn({ email, password: PASSWORD }));
    expect([e.code, e.message]).toEqual(["invalid", EMAIL_NOT_VERIFIED]);
    expect(mailsTo(email)).toHaveLength(2);
  });

  it("verifyEmail signs the person in and names set-up; a bad link is refused with the fake's copy", async () => {
    const email = freshEmail();
    const b = browser();
    await b.service.signUp({ email, password: PASSWORD });
    expect(await b.service.verifyEmail(tokenFrom(mailsTo(email)[0]?.links[0] ?? ""))).toEqual({
      role: "owner",
      next: "/onboarding",
    });
    expect((await actorFromHeaders(b.headers())).kind).toBe("no-workspace");
    const e = await refusal(browser().service.verifyEmail("not-a-token"));
    expect([e.code, e.message]).toEqual(["invalid", LINK_EXPIRED]);
  });

  it("signIn: a wrong password names no field; no workspace names set-up; a finished workspace names Home with the member's role", async () => {
    const { email, userId } = await verifiedUser();
    const wrong = await refusal(browser().service.signIn({ email, password: "not the password" }));
    expect([wrong.code, wrong.message, wrong.issues]).toEqual(["invalid", WRONG_PASSWORD, []]);
    const b = browser();
    expect(await b.service.signIn({ email, password: PASSWORD })).toEqual({
      role: "owner",
      next: "/onboarding",
    });
    expect(b.cookies.has("better-auth.session_token")).toBe(true);

    const { workspaceId } = await makeWorkspace("Sign-in Roofing");
    await pool("owner").query("update workspace set onboarding_step = 'done' where id = $1", [workspaceId]);
    await pool("owner").query(
      "insert into member (id, workspace_id, user_id, role) values (gen_random_uuid(), $1, $2, 'manager')",
      [workspaceId, userId],
    );
    const c = browser();
    expect(await c.service.signIn({ email, password: PASSWORD })).toEqual({ role: "manager", next: "/" });
    expect(await actorFromHeaders(c.headers())).toMatchObject({
      kind: "actor",
      actor: { workspaceId, role: "manager" },
    });
  });

  it("signIn with TOTP on names /two-factor; the code finishes sign-in; bad codes are refused", async () => {
    const { b, email } = await verifiedUser();
    const enabled = await getAuth().api.enableTwoFactor({
      body: { password: PASSWORD },
      headers: b.headers(),
    });
    if (enabled.method !== "totp") throw new Error("expected TOTP");
    const secret = base32Decode(new URL(enabled.totpURI).searchParams.get("secret") ?? "");
    await getAuth().api.verifyTOTP({
      body: { code: (await getAuth().api.generateTOTP({ body: { secret } })).code },
      headers: b.headers(),
    });

    const c = browser();
    expect(await c.service.signIn({ email, password: PASSWORD })).toEqual({
      role: "owner",
      next: "/two-factor",
    });
    expect((await actorFromHeaders(c.headers())).kind).toBe("signed-out");
    const format = await refusal(c.service.verifyTwoFactor("12ab"));
    expect([format.code, format.issues]).toEqual(["invalid", [{ field: "code", message: TWO_FACTOR_CODE }]]);
    const { code } = await getAuth().api.generateTOTP({ body: { secret } });
    const wrong = await refusal(c.service.verifyTwoFactor(code === "000000" ? "111111" : "000000"));
    expect([wrong.code, wrong.issues]).toEqual(["invalid", [{ field: "code", message: WRONG_CODE }]]);
    expect(await c.service.verifyTwoFactor(code)).toEqual({ role: "owner", next: "/onboarding" });
    expect((await actorFromHeaders(c.headers())).kind).toBe("no-workspace");

    const none = await refusal(browser().service.verifyTwoFactor(code));
    expect([none.code, none.message]).toEqual(["invalid", SIGN_IN_AGAIN]);
  });

  it("requestPasswordReset answers the same for known and unknown emails and mails only the known one", async () => {
    const { email } = await verifiedUser();
    const unknown = freshEmail();
    const before = mailsTo(email).length;
    expect(await browser().service.requestPasswordReset(email)).toEqual({ message: RESET_LINK_SENT });
    expect(await browser().service.requestPasswordReset(unknown)).toEqual({ message: RESET_LINK_SENT });
    expect(mailsTo(email)).toHaveLength(before + 1);
    expect(mailsTo(unknown)).toHaveLength(0);
    const bad = await refusal(browser().service.requestPasswordReset("nope"));
    expect([bad.code, bad.issues.map((i) => i.field)]).toEqual(["invalid", ["email"]]);
  });

  it("resetPassword sets the new password from the mailed link; a bad link or short password is refused", async () => {
    const { email } = await verifiedUser();
    await browser().service.requestPasswordReset(email);
    const token = tokenFrom(mailsTo(email).at(-1)?.links[0] ?? "");
    const short = await refusal(browser().service.resetPassword(token, "short"));
    expect([short.code, short.issues.map((i) => i.field)]).toEqual(["invalid", ["password"]]);
    const gone = await refusal(browser().service.resetPassword("not-a-token", "a brand new password"));
    expect([gone.code, gone.message]).toEqual(["invalid", LINK_EXPIRED]);
    await browser().service.resetPassword(token, "a brand new password");
    expect(await browser().service.signIn({ email, password: "a brand new password" })).toMatchObject({
      next: "/onboarding",
    });
    const old = await refusal(browser().service.signIn({ email, password: PASSWORD }));
    expect(old.message).toBe(WRONG_PASSWORD);
  });

  it("acceptInvite joins with the invited role and opens that workspace; someone else, a used or an unknown invite is refused", async () => {
    const owner = await verifiedUser();
    const ws = await getAuth().api.createOrganization({
      body: { name: "Invite Co", slug: `inv-svc-${Date.now()}` },
      headers: owner.b.headers(),
    });
    if (!ws) throw new Error("no workspace");
    await pool("owner").query("update workspace set onboarding_step = 'done' where id = $1", [ws.id]);
    const inviteeEmail = freshEmail();
    const inv = await getAuth().api.createInvitation({
      body: { email: inviteeEmail, role: "foreman", organizationId: ws.id },
      headers: owner.b.headers(),
    });

    const other = await verifiedUser();
    const notYours = await refusal(other.b.service.acceptInvite(inv.id));
    expect([notYours.code, notYours.message]).toEqual(["forbidden", INVITE_OTHER_EMAIL]);
    const signedOut = await refusal(browser().service.acceptInvite(inv.id));
    expect([signedOut.code, signedOut.message]).toEqual(["invalid", SIGN_IN_AGAIN]);

    const invitee = await verifiedUser(browser(), inviteeEmail);
    // The invitee also owns an unfinished workspace joined "later": the answer must be the invited one's.
    const own = await makeWorkspace("Own Co");
    await pool("owner").query(
      "insert into member (id, workspace_id, user_id, role, created_at) values (gen_random_uuid(), $1, $2, 'owner', now() + interval '1 hour')",
      [own.workspaceId, invitee.userId],
    );
    expect(await invitee.b.service.acceptInvite(inv.id)).toEqual({ role: "foreman", next: "/" });
    expect(await actorFromHeaders(invitee.b.headers())).toMatchObject({
      kind: "actor",
      actor: { workspaceId: ws.id, role: "foreman" },
    });
    const again = await refusal(invitee.b.service.acceptInvite(inv.id));
    expect([again.code, again.message]).toEqual(["invalid", INVITE_GONE]);
    const unknown = await refusal(invitee.b.service.acceptInvite("01900000-0000-7000-8000-000000000000"));
    expect([unknown.code, unknown.message]).toEqual(["invalid", INVITE_GONE]);
  });

  it("continueWithGoogle is unavailable without Google set up, and names Google's authorize URL with it", async () => {
    const off = await refusal(browser().service.continueWithGoogle("sign-in"));
    expect([off.code, off.message]).toEqual(["unavailable", GOOGLE_OFF]);
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    try {
      const withGoogle = createAuth();
      const b = browser(() => withGoogle);
      const res = await b.service.continueWithGoogle("sign-up");
      if (!("redirectTo" in res)) throw new Error("expected a redirect");
      expect(new URL(res.redirectTo).host).toBe("accounts.google.com");
      expect(b.cookies.size).toBeGreaterThan(0);
    } finally {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });

  /** A verified user with TOTP on, and a browser whose sign-in is waiting for the code. */
  async function waitingForCode() {
    const { b, email } = await verifiedUser();
    const enabled = await getAuth().api.enableTwoFactor({ body: { password: PASSWORD }, headers: b.headers() });
    if (enabled.method !== "totp") throw new Error("expected TOTP");
    const secret = base32Decode(new URL(enabled.totpURI).searchParams.get("secret") ?? "");
    await getAuth().api.verifyTOTP({
      body: { code: (await getAuth().api.generateTOTP({ body: { secret } })).code },
      headers: b.headers(),
    });
    const c = browser();
    await c.service.signIn({ email, password: PASSWORD });
    return { c, secret };
  }

  it("R1: a sixth sign-in for one email inside a minute is too many tries, right password or not; another email is not", async () => {
    const { email } = await verifiedUser();
    for (let i = 0; i < 5; i++)
      expect((await refusal(browser().service.signIn({ email, password: "not the password" }))).message).toBe(
        WRONG_PASSWORD,
      );
    const sixth = await refusal(browser().service.signIn({ email: email.toUpperCase(), password: PASSWORD }));
    expect([sixth.code, sixth.message]).toEqual(["invalid", TOO_MANY_TRIES]);
    const { email: other } = await verifiedUser();
    expect((await browser().service.signIn({ email: other, password: PASSWORD })).next).toBe("/onboarding");
  });

  it("R1: a sixth sign-up for one email inside a minute is too many tries", async () => {
    const email = freshEmail();
    await browser().service.signUp({ email, password: PASSWORD });
    for (let i = 0; i < 4; i++)
      expect((await refusal(browser().service.signUp({ email: i % 2 ? email : email.toUpperCase(), password: PASSWORD }))).message).toBe(EMAIL_TAKEN);
    const sixth = await refusal(browser().service.signUp({ email: email.toUpperCase(), password: PASSWORD }));
    expect([sixth.code, sixth.message]).toEqual(["invalid", TOO_MANY_TRIES]);
  });

  it("R1: a sixth TOTP code for one waiting sign-in is too many tries, even the right code", async () => {
    const { c, secret } = await waitingForCode();
    const { code } = await getAuth().api.generateTOTP({ body: { secret } });
    const bad = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      expect((await refusal(c.service.verifyTwoFactor(bad))).issues).toEqual([{ field: "code", message: WRONG_CODE }]);
    // A junk copy of the cookie sent before or after the real one does not start a fresh count.
    const withJunk = (first: boolean) => {
      const real = c.headers().get("cookie") ?? "";
      const junk = `better-auth.two_factor=junk${Date.now()}`;
      return createDbAuth({
        auth: getAuth,
        requestHeaders: async () => new Headers({ cookie: first ? `${junk}; ${real}` : `${real}; ${junk}` }),
        keepCookies: () => undefined,
      });
    };
    const sixth = await refusal(withJunk(true).verifyTwoFactor(code));
    expect([sixth.code, sixth.message]).toEqual(["invalid", TOO_MANY_TRIES]);
    const seventh = await refusal(withJunk(false).verifyTwoFactor(code));
    expect([seventh.code, seventh.message]).toEqual(["invalid", TOO_MANY_TRIES]);
    expect((await refusal(c.service.verifyTwoFactor(code))).message).toBe(TOO_MANY_TRIES);
    expect((await actorFromHeaders(c.headers())).kind).toBe("signed-out");
  });

  it("R1: a sixth reset request for one email inside a minute is too many tries and sends no sixth mail", async () => {
    const { email } = await verifiedUser();
    const unknown = freshEmail();
    const before = mailsTo(email).length;
    for (const to of [email, unknown]) {
      for (let i = 0; i < 5; i++)
        expect(await browser().service.requestPasswordReset(i % 2 ? to : to.toUpperCase())).toEqual({ message: RESET_LINK_SENT });
      const sixth = await refusal(browser().service.requestPasswordReset(to.toUpperCase()));
      expect([sixth.code, sixth.message]).toEqual(["invalid", TOO_MANY_TRIES]);
    }
    expect(mailsTo(email)).toHaveLength(before + 5);
  });

  /** One request through the catch-all route, from a fresh IP each time (Better Auth's per-IP limiter never trips). */
  let ip = 0;
  const http = (path: string, body: object, cookie = "") =>
    getAuth().handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: BASE,
          "x-forwarded-for": `10.77.${Math.floor(++ip / 250) % 250}.${(ip % 250) + 1}`,
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );

  it("F1: the per-email count ends with its minute: a sign-in after it is let in and the count starts again", async () => {
    const { email } = await verifiedUser();
    const start = Date.now() - 61_000;
    const then = () => start;
    for (let i = 0; i < 5; i++)
      expect((await refusal(browser(getAuth, then).service.signIn({ email, password: "not the password" }))).message).toBe(WRONG_PASSWORD);
    expect((await refusal(browser(getAuth, then).service.signIn({ email, password: PASSWORD }))).message).toBe(TOO_MANY_TRIES);
    // Reset is counted apart from sign-in: five wrong passwords do not use up its tries.
    expect(await browser(getAuth, then).service.requestPasswordReset(email)).toEqual({ message: RESET_LINK_SENT });
    expect((await browser().service.signIn({ email, password: PASSWORD })).next).toBe("/onboarding");
    for (let i = 0; i < 4; i++)
      expect((await refusal(browser().service.signIn({ email, password: "not the password" }))).message).toBe(WRONG_PASSWORD);
    expect((await refusal(browser().service.signIn({ email, password: PASSWORD }))).message).toBe(TOO_MANY_TRIES);
  });

  it("F1: ten sign-ins at once for one email: five are checked and five are too many tries", async () => {
    const { email } = await verifiedUser();
    const all = await Promise.all(
      Array.from({ length: 10 }, () => refusal(browser().service.signIn({ email, password: "not the password" }))),
    );
    expect(all.map((e) => e.message).sort()).toEqual([...Array(5).fill(TOO_MANY_TRIES), ...Array(5).fill(WRONG_PASSWORD)].sort());
  });

  it("F2: the HTTP route and the service share one per-email count for sign-in, sign-up and reset", async () => {
    const { email } = await verifiedUser();
    for (let i = 0; i < 5; i++)
      expect((await refusal(browser().service.signIn({ email, password: "not the password" }))).message).toBe(WRONG_PASSWORD);
    expect((await http("/sign-in/email", { email: email.toUpperCase(), password: PASSWORD })).status).toBe(429);

    const { email: viaHttp } = await verifiedUser();
    for (let i = 0; i < 5; i++)
      expect((await http("/sign-in/email", { email: viaHttp, password: "not the password" })).status).toBe(401);
    expect((await refusal(browser().service.signIn({ email: viaHttp, password: PASSWORD }))).message).toBe(TOO_MANY_TRIES);

    const taken = freshEmail();
    await browser().service.signUp({ email: taken, password: PASSWORD });
    for (let i = 0; i < 4; i++) await refusal(browser().service.signUp({ email: taken, password: PASSWORD }));
    expect((await http("/sign-up/email", { email: taken, password: PASSWORD, name: "x" })).status).toBe(429);

    const before = mailsTo(email).length;
    for (let i = 0; i < 5; i++) await browser().service.requestPasswordReset(email);
    expect((await http("/request-password-reset", { email, redirectTo: "/reset-password" })).status).toBe(429);
    expect(mailsTo(email)).toHaveLength(before + 5);
  });

  it("F2/F4: TOTP codes over HTTP share the count; a re-encoded copy of the cookie is the same sign-in", async () => {
    const { c, secret } = await waitingForCode();
    const { code } = await getAuth().api.generateTOTP({ body: { secret } });
    const bad = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      expect((await refusal(c.service.verifyTwoFactor(bad))).issues).toEqual([{ field: "code", message: WRONG_CODE }]);
    // Better Auth percent-decodes cookie values, so a re-encoded copy names the same waiting sign-in and count.
    const [name, value] = [...c.cookies].find(([k]) => k.endsWith("two_factor"))!;
    const same = [...value].map((ch) => (/[g-z]/i.test(ch) ? `%${ch.charCodeAt(0).toString(16)}` : ch)).join("");
    const reencoded = new Headers({ cookie: [...c.cookies].map(([k, v]) => `${k}=${k === name ? same : v}`).join("; ") });
    expect(reencoded.get("cookie")).not.toBe(c.headers().get("cookie"));
    expect(codeSubjects(reencoded)).toEqual(codeSubjects(c.headers()));
    expect(codeSubjects(c.headers())).toHaveLength(1);
    expect((await http("/two-factor/verify-totp", { code }, c.headers().get("cookie") ?? "")).status).toBe(429);
    expect((await actorFromHeaders(c.headers())).kind).toBe("signed-out");
  });

  it("F6: a new count clears this throttle's ended counts and leaves Better Auth's own", async () => {
    const stale = Date.now() - 120_000;
    const [mine, theirs] = [`roofy:sign-in:stale${Date.now()}`, `stale${Date.now()}/sign-in/email`];
    for (const key of [mine, theirs])
      await pool("owner").query("insert into rate_limit (id, key, count, last_request) values (gen_random_uuid(), $1, 6, $2)", [key, stale]);
    await refusal(browser().service.signIn({ email: freshEmail(), password: "not the password" }));
    const left = await rows<{ key: string }>("owner", "select key from rate_limit where key = any($1)", [[mine, theirs]]);
    expect(left.map((r) => r.key)).toEqual([theirs]);
  });

  it("R5: signIn for a member of an unfinished workspace names set-up", async () => {
    const { email, userId } = await verifiedUser();
    const { workspaceId } = await makeWorkspace("Unfinished Roofing");
    await pool("owner").query("update workspace set onboarding_step = 'crew' where id = $1", [workspaceId]);
    await pool("owner").query(
      "insert into member (id, workspace_id, user_id, role) values (gen_random_uuid(), $1, $2, 'manager')",
      [workspaceId, userId],
    );
    expect(await browser().service.signIn({ email, password: PASSWORD })).toEqual({
      role: "manager",
      next: "/onboarding",
    });
  });

  it("R8: signOut ignores only a no-session refusal and rethrows any other Better Auth failure", async () => {
    const failing = (status: "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR") => () =>
      ({
        api: {
          signOut: async () => {
            throw new APIError(status, { message: "from the test" });
          },
        },
      }) as unknown as Auth;
    const e = await browser(failing("INTERNAL_SERVER_ERROR"))
      .service.signOut()
      .then(
        () => null,
        (x: unknown) => x,
      );
    expect(e).toBeInstanceOf(APIError);
    expect((e as APIError).statusCode).toBe(500);
    await expect(browser(failing("UNAUTHORIZED")).service.signOut()).resolves.toBeUndefined();
    await expect(browser().service.signOut()).resolves.toBeUndefined();
  });

  it("signOut ends the session in the database and clears the cookie", async () => {
    const { b, userId } = await verifiedUser();
    const kept = b.headers();
    await b.service.signOut();
    expect(b.cookies.has("better-auth.session_token")).toBe(false);
    expect((await actorFromHeaders(kept)).kind).toBe("signed-out");
    expect(await rows("owner", "select id from session where user_id = $1", [userId])).toEqual([]);
  });
});
