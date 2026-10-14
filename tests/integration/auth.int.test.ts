import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actorFromHeaders, roleFrom } from "../../src/server/auth/actor";
import { createAuth, getAuth, ROLES_AC } from "../../src/server/auth/auth";
import { roleEnum } from "../../src/server/db/schema";
import { closePools, pool, rows } from "./helpers";

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

/** The Cookie header a browser would send back after these Set-Cookie headers. */
function cookieHeader(h: Headers): Headers {
  const cookie = h
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

function base32Decode(text: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of text.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = (bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2));
  return Buffer.from(bytes).toString("utf8");
}

let n = 0;
const freshEmail = () => `user${Date.now()}${n++}@example.com`;

async function signUpVerified(
  email = freshEmail(),
): Promise<{ email: string; headers: Headers; userId: string }> {
  const auth = getAuth();
  const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "Sam Roof" } });
  const link = mailsTo(email)[0]?.links[0] ?? "";
  await auth.api.verifyEmail({ query: { token: tokenFrom(link) } });
  const signIn = await auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
  return { email, headers: cookieHeader(signIn.headers), userId: res.user.id };
}

async function rejection(
  p: Promise<unknown>,
): Promise<{ status?: unknown; statusCode?: unknown; body?: { code?: string } }> {
  try {
    await p;
  } catch (e) {
    return e as { status?: unknown; statusCode?: unknown; body?: { code?: string } };
  }
  throw new Error("expected a rejection");
}

describe("Better Auth", () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
    process.env.BETTER_AUTH_URL = BASE;
    process.env.ROOFY_MAIL = "console";
    mailLog = join(mkdtempSync(join(tmpdir(), "roofy-auth-")), "mail.jsonl");
    process.env.ROOFY_MAIL_LOG = mailLog;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
  afterAll(async () => {
    await closePools();
  });

  it("fails with a plain error naming BETTER_AUTH_SECRET at first use, not at import", () => {
    const saved = process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    try {
      expect(() => createAuth()).toThrow(/^BETTER_AUTH_SECRET is not set/);
    } finally {
      process.env.BETTER_AUTH_SECRET = saved;
    }
  });

  it("sends one verification mail on sign-up and refuses sign-in before verification", async () => {
    const email = freshEmail();
    const res = await getAuth().api.signUpEmail({ body: { email, password: PASSWORD, name: "Sam Roof" } });
    expect(res.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const mails = mailsTo(email);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.links[0]).toContain(`${BASE}/verify?token=`);
    const err = await rejection(getAuth().api.signInEmail({ body: { email, password: PASSWORD } }));
    expect(err.statusCode).toBe(403);
    expect(err.body?.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("verifies, then signs in with an HttpOnly, SameSite=Lax cookie that is not Secure on http", async () => {
    const email = freshEmail();
    await getAuth().api.signUpEmail({ body: { email, password: PASSWORD, name: "Sam Roof" } });
    const verified = await getAuth().api.verifyEmail({
      query: { token: tokenFrom(mailsTo(email)[0]?.links[0] ?? "") },
      returnHeaders: true,
    });
    // Auto sign-in after verification sets the session cookie.
    expect(verified.headers.getSetCookie().join()).toContain("better-auth.session_token=");
    const res = await getAuth().api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
    expect(res.status).toBe(200);
    const session = res.headers.getSetCookie().find((c) => c.startsWith("better-auth.session_token="));
    expect(session).toMatch(/; HttpOnly/i);
    expect(session).toMatch(/; SameSite=Lax/i);
    expect(session).not.toMatch(/; Secure/i);
  });

  it("marks the session cookie Secure when BETTER_AUTH_URL is https", async () => {
    const saved = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "https://roofy.example.com";
    try {
      const secure = createAuth();
      const { email } = await signUpVerified();
      const res = await secure.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
      const session = res.headers
        .getSetCookie()
        .find((c) => c.startsWith("__Secure-better-auth.session_token="));
      expect(session).toMatch(/; Secure/i);
      expect(session).toMatch(/; HttpOnly/i);
      expect(session).toMatch(/; SameSite=Lax/i);
    } finally {
      process.env.BETTER_AUTH_URL = saved;
    }
  });

  it("sends a reset mail, the new password works and the old sessions are signed out", async () => {
    const { email, headers } = await signUpVerified();
    expect((await actorFromHeaders(headers)).kind).toBe("no-workspace");
    await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
    const reset = mailsTo(email).filter((m) => m.links.some((l) => l.includes("/reset-password/")));
    expect(reset).toHaveLength(1);
    const token = new URL(reset[0]?.links[0] ?? "").pathname.split("/").pop() ?? "";
    await getAuth().api.resetPassword({ body: { newPassword: "a brand new password", token } });
    const err = await rejection(getAuth().api.signInEmail({ body: { email, password: PASSWORD } }));
    expect(err.statusCode).toBe(401);
    const ok = await getAuth().api.signInEmail({ body: { email, password: "a brand new password" } });
    expect(ok.user.email).toBe(email);
    expect(await actorFromHeaders(headers)).toEqual({ kind: "signed-out" });
  });

  it("makes the workspace creator owner and maps the session to an Actor", async () => {
    const { headers, userId } = await signUpVerified();
    expect(await actorFromHeaders(headers)).toEqual({ kind: "no-workspace", userId });
    const ws = await getAuth().api.createOrganization({
      body: { name: "Top Roofing", slug: `top-${userId}` },
      headers,
    });
    const member = await rows<{ role: string }>(
      "owner",
      "select role from member where workspace_id = $1 and user_id = $2",
      [ws?.id, userId],
    );
    expect(member).toEqual([{ role: "owner" }]);
    expect(await actorFromHeaders(headers)).toEqual({
      kind: "actor",
      actor: { userId, workspaceId: ws?.id, role: "owner", name: "Sam Roof" },
      timezone: "Australia/Sydney",
      workspaceName: "Top Roofing",
      onboardingStep: "business",
    });
  });

  it("gives no actor for a workspace the user is not a member of", async () => {
    const a = await signUpVerified();
    const b = await signUpVerified();
    await getAuth().api.createOrganization({
      body: { name: "A Roofing", slug: `a-${a.userId}` },
      headers: a.headers,
    });
    const wsB = await getAuth().api.createOrganization({
      body: { name: "B Roofing", slug: `b-${b.userId}` },
      headers: b.headers,
    });
    await pool("owner").query("update session set active_workspace_id = $1 where user_id = $2", [
      wsB?.id,
      a.userId,
    ]);
    expect(await actorFromHeaders(a.headers)).toEqual({ kind: "no-workspace", userId: a.userId });
  });

  it("answers signed-out without a cookie", async () => {
    expect(await actorFromHeaders(new Headers())).toEqual({ kind: "signed-out" });
  });

  it("narrows role strings to a known Role and refuses anything else", () => {
    expect(roleFrom("foreman")).toBe("foreman");
    expect(() => roleFrom("admin")).toThrow('Unknown role "admin".');
    expect(() => roleFrom("owner,manager")).toThrow('Unknown role "owner,manager".');
  });

  it("exports exactly the four Roofy roles, the same list as the member_role enum", () => {
    expect(Object.keys(ROLES_AC).sort()).toEqual(["accountant", "foreman", "manager", "owner"]);
    expect(Object.keys(ROLES_AC).sort()).toEqual([...roleEnum.enumValues].sort());
    for (const role of roleEnum.enumValues) expect(roleFrom(role)).toBe(role);
  });

  it("sends an invite mail naming the workspace and role", async () => {
    const { headers } = await signUpVerified();
    const ws = await getAuth().api.createOrganization({
      body: { name: "Invite Roofing", slug: `inv-${Date.now()}` },
      headers,
    });
    const invitee = freshEmail();
    const inv = await getAuth().api.createInvitation({
      body: { email: invitee, role: "foreman", organizationId: ws?.id },
      headers,
    });
    const mails = mailsTo(invitee);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain("Invite Roofing");
    expect(mails[0]?.text.toLowerCase()).toContain("foreman");
    expect(mails[0]?.links[0]).toBe(`${BASE}/invite/${inv.id}`);
  });

  it("requires the second factor at sign-in once TOTP is enabled and verified", async () => {
    const { email, headers } = await signUpVerified();
    const enabled = await getAuth().api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (enabled.method !== "totp") throw new Error(`expected a TOTP setup, got ${enabled.method}`);
    // The URI carries the secret base32-encoded; generateTOTP takes it raw.
    const secret = base32Decode(new URL(enabled.totpURI).searchParams.get("secret") ?? "");
    const { code } = await getAuth().api.generateTOTP({ body: { secret } });
    await getAuth().api.verifyTOTP({ body: { code }, headers });
    const flags = await rows<{ two_factor_enabled: boolean }>(
      "owner",
      'select two_factor_enabled from "user" where email = $1',
      [email],
    );
    expect(flags).toEqual([{ two_factor_enabled: true }]);
    const again = await getAuth().api.signInEmail({ body: { email, password: PASSWORD } });
    expect(again).toMatchObject({ twoFactorRedirect: true });
    expect(new URL(enabled.totpURI).searchParams.get("issuer")).toBe("Roofy");
  });

  it("rate-limits the 6th wrong password within the window with a 429 stored in rate_limit", async () => {
    const { email } = await signUpVerified();
    const ip = `10.9.${n % 250}.${(Date.now() % 250) + 1}`;
    const attempt = () =>
      getAuth().handler(
        new Request(`${BASE}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
          body: JSON.stringify({ email, password: "wrong password" }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    const stored = await rows<{ key: string }>("owner", "select key from rate_limit where key like $1", [
      `%${ip}%`,
    ]);
    expect(stored.length).toBe(1);
  });

  it("lists no social provider without Google env, and gives a Google URL with it", async () => {
    const ctx = await getAuth().$context;
    expect(ctx.socialProviders).toEqual([]);
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    try {
      const withGoogle = createAuth();
      const res = await withGoogle.api.signInSocial({ body: { provider: "google", callbackURL: "/" } });
      expect(new URL(res.url ?? "").host).toBe("accounts.google.com");
    } finally {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });

  it("fails with a plain error naming BETTER_AUTH_URL when it is unset", () => {
    const saved = process.env.BETTER_AUTH_URL;
    delete process.env.BETTER_AUTH_URL;
    try {
      expect(() => createAuth()).toThrow(/^BETTER_AUTH_URL is not set/);
    } finally {
      process.env.BETTER_AUTH_URL = saved;
    }
  });

  it("refuses to delete a workspace through Better Auth, even for the owner", async () => {
    const { headers, userId } = await signUpVerified();
    const ws = await getAuth().api.createOrganization({ body: { name: "Keep Roofing", slug: `keep-${userId}` }, headers });
    const err = await rejection(getAuth().api.deleteOrganization({ body: { organizationId: ws?.id ?? "" }, headers }));
    expect(err.statusCode).toBe(404);
    expect(err.body?.code).toBe("ORGANIZATION_DELETION_DISABLED");
    expect(await rows("owner", "select id from workspace where id = $1", [ws?.id])).toEqual([{ id: ws?.id }]);
  });

  describe("refuses any role that is not exactly one Roofy role", () => {
    async function ownerWithForeman() {
      const owner = await signUpVerified();
      const ws = await getAuth().api.createOrganization({
        body: { name: "Role Roofing", slug: `role-${owner.userId}` },
        headers: owner.headers,
      });
      const crew = await signUpVerified();
      const added = await getAuth().api.addMember({ body: { userId: crew.userId, role: "foreman", organizationId: ws?.id } });
      return { owner, wsId: ws?.id ?? "", crew, memberId: added?.id ?? "" };
    }
    const bad: (string | string[])[] = [["manager", "foreman"], "owner,manager", "manager,foreman"];

    it.each(bad)("createInvitation with %j: 400 UNKNOWN_ROLE, no invitation row, no mail", async (role) => {
      const { owner, wsId } = await ownerWithForeman();
      const invitee = freshEmail();
      const err = await rejection(
        getAuth().api.createInvitation({
          body: { email: invitee, role: role as "foreman", organizationId: wsId },
          headers: owner.headers,
        }),
      );
      expect(err.statusCode).toBe(400);
      expect(err.body?.code).toBe("UNKNOWN_ROLE");
      expect(await rows("owner", "select id from invitation where email = $1", [invitee])).toEqual([]);
      expect(mailsTo(invitee)).toEqual([]);
    });

    it.each(bad)("updateMemberRole with %j: 400 UNKNOWN_ROLE, role unchanged", async (role) => {
      const { owner, wsId, memberId } = await ownerWithForeman();
      const err = await rejection(
        getAuth().api.updateMemberRole({
          body: { memberId, role: role as "foreman", organizationId: wsId },
          headers: owner.headers,
        }),
      );
      expect(err.statusCode).toBe(400);
      expect(err.body?.code).toBe("UNKNOWN_ROLE");
      expect(await rows("owner", "select role from member where id = $1", [memberId])).toEqual([{ role: "foreman" }]);
    });

    it.each(bad)("addMember with %j: 400 UNKNOWN_ROLE, no member row", async (role) => {
      const { wsId } = await ownerWithForeman();
      const other = await signUpVerified();
      const err = await rejection(
        getAuth().api.addMember({ body: { userId: other.userId, role: role as "foreman", organizationId: wsId } }),
      );
      expect(err.statusCode).toBe(400);
      expect(err.body?.code).toBe("UNKNOWN_ROLE");
      expect(await rows("owner", "select id from member where user_id = $1", [other.userId])).toEqual([]);
    });

    it("still accepts one plain role", async () => {
      const { owner, wsId, memberId } = await ownerWithForeman();
      await getAuth().api.updateMemberRole({ body: { memberId, role: "manager", organizationId: wsId }, headers: owner.headers });
      expect(await rows("owner", "select role from member where id = $1", [memberId])).toEqual([{ role: "manager" }]);
    });
  });

  it("opens the most recently joined workspace on a new sign-in", async () => {
    const { email, headers, userId } = await signUpVerified();
    await getAuth().api.createOrganization({ body: { name: "First Roofing", slug: `first-${userId}` }, headers });
    const second = await getAuth().api.createOrganization({ body: { name: "Second Roofing", slug: `second-${userId}` }, headers });
    await getAuth().api.signOut({ headers });
    expect(await actorFromHeaders(headers)).toEqual({ kind: "signed-out" });
    const again = await getAuth().api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
    const result = await actorFromHeaders(cookieHeader(again.headers));
    expect(result).toMatchObject({ kind: "actor", actor: { userId, workspaceId: second?.id, role: "owner" } });
  });

  it("builds the invite link without a double slash when BETTER_AUTH_URL ends in /", async () => {
    const { headers } = await signUpVerified();
    const ws = await getAuth().api.createOrganization({ body: { name: "Slash Roofing", slug: `slash-${Date.now()}` }, headers });
    const saved = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = `${BASE}/`;
    try {
      const invitee = freshEmail();
      const inv = await createAuth().api.createInvitation({
        body: { email: invitee, role: "foreman", organizationId: ws?.id },
        headers,
      });
      expect(mailsTo(invitee)[0]?.links[0]).toBe(`${BASE}/invite/${inv.id}`);
    } finally {
      process.env.BETTER_AUTH_URL = saved;
    }
  });
});
