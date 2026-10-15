// Task 11 run 2, carry note T8: /api/auth/organization/* called directly (here through auth.api)
// is held to the workspace service's member rules by the organization hooks in auth.ts.
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuth, ROLES_AC, guardInvite, guardKeepsAnOwner, guardMemberChange } from "../../src/server/auth/auth";
import { closePools, rows } from "./helpers";

const PASSWORD = "correct horse battery";
let mailLog = "";
let n = 0;

const linksTo = (to: string): string[] =>
  existsSync(mailLog)
    ? readFileSync(mailLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { to: string; links: string[] }).filter((m) => m.to === to).flatMap((m) => m.links)
    : [];

async function signUp(): Promise<{ email: string; userId: string; headers: Headers }> {
  const auth = getAuth();
  const email = `hook${Date.now()}${n++}@example.com`;
  const res = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "Hook Person" } });
  const token = new URL(linksTo(email)[0]!).searchParams.get("token")!;
  await auth.api.verifyEmail({ query: { token } });
  const signIn = await auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
  const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { email, userId: res.user.id, headers: new Headers({ cookie }) };
}

async function refused(p: Promise<unknown>): Promise<{ status: number; code?: string; message?: string }> {
  return p.then(
    () => expect.fail("expected a refusal"),
    (e: { statusCode: number; body?: { code?: string; message?: string } }) => ({ status: e.statusCode, code: e.body?.code, message: e.body?.message }),
  );
}

let owner: Awaited<ReturnType<typeof signUp>>;
let manager: Awaited<ReturnType<typeof signUp>>;
let organizationId = "";
let ownerMemberId = "";

beforeAll(async () => {
  process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString("hex");
  process.env.BETTER_AUTH_URL ??= "http://localhost:3100";
  process.env.ROOFY_MAIL = "console";
  mailLog = join(mkdtempSync(join(tmpdir(), "roofy-hooks-")), "mail.jsonl");
  process.env.ROOFY_MAIL_LOG = mailLog;
  owner = await signUp();
  manager = await signUp();
  const ws = await getAuth().api.createOrganization({ body: { name: "Hook Roofing", slug: `hook-${owner.userId}` }, headers: owner.headers });
  organizationId = ws!.id;
  await getAuth().api.addMember({ body: { userId: manager.userId, role: "manager", organizationId } });
  await getAuth().api.setActiveOrganization({ body: { organizationId }, headers: manager.headers });
  ownerMemberId = (await rows<{ id: string }>("owner", "select id from member where user_id = $1", [owner.userId]))[0]!.id;
});
afterAll(closePools);

const invite = (headers: Headers, email: string, role: "owner" | "manager" | "foreman" | "accountant") =>
  getAuth().api.createInvitation({ body: { email, role, organizationId }, headers });

describe("organization hooks (T8)", () => {
  it("refuses a Manager inviting as Owner (member.changeOwner), and an Owner without 2FA too", async () => {
    expect(await refused(invite(manager.headers, `x${n++}@example.com`, "owner"))).toMatchObject({ status: 403 });
    expect(await refused(invite(owner.headers, `y${n++}@example.com`, "owner"))).toMatchObject({
      status: 403,
      message: "You don't have access to this.",
    });
  });
  it("lets an Owner invite a foreman, then refuses the same email again", async () => {
    const email = `z${n++}@example.com`;
    await invite(owner.headers, email, "foreman");
    expect((await refused(invite(owner.headers, email, "foreman"))).status).toBe(400);
  });
  // Task 15 fix F1: managing members is the Owner's alone (product spec section 3). A Manager may
  // read the team but every write path over the direct API is refused, and nothing is written.
  it("refuses a Manager inviting anyone, even a foreman", async () => {
    const email = `mi${n++}@example.com`;
    expect(await refused(invite(manager.headers, email, "foreman"))).toMatchObject({ status: 403 });
    expect(await rows("owner", "select id from invitation where lower(email) = $1", [email])).toEqual([]);
  });
  it("refuses a Manager changing a foreman's role or removing them, and cancelling an invitation", async () => {
    const third = await signUp();
    await getAuth().api.addMember({ body: { userId: third.userId, role: "foreman", organizationId } });
    const [t] = await rows<{ id: string }>("owner", "select id from member where user_id = $1", [third.userId]);
    const roleOf = async () => (await rows<{ role: string }>("owner", "select role from member where id = $1", [t!.id]))[0]?.role;
    expect(
      await refused(getAuth().api.updateMemberRole({ body: { memberId: t!.id, role: "accountant", organizationId }, headers: manager.headers })),
    ).toMatchObject({ status: 403 });
    expect(await refused(getAuth().api.removeMember({ body: { memberIdOrEmail: t!.id, organizationId }, headers: manager.headers }))).toMatchObject({ status: 403 });
    expect(await roleOf()).toBe("foreman");
    const email = `mc${n++}@example.com`;
    const inv = await invite(owner.headers, email, "foreman");
    expect(await refused(getAuth().api.cancelInvitation({ body: { invitationId: inv.id }, headers: manager.headers }))).toMatchObject({ status: 403 });
    expect(await rows("owner", "select status from invitation where id = $1", [inv.id])).toEqual([{ status: "pending" }]);
    // The Owner can still do all three.
    await getAuth().api.updateMemberRole({ body: { memberId: t!.id, role: "accountant", organizationId }, headers: owner.headers });
    expect(await roleOf()).toBe("accountant");
    await getAuth().api.removeMember({ body: { memberIdOrEmail: t!.id, organizationId }, headers: owner.headers });
    expect(await roleOf()).toBeUndefined();
  });
  it("gives the Better Auth manager role no member or invitation powers, and no other role gains them", () => {
    const can = (role: keyof typeof ROLES_AC, permissions: Record<string, string[]>) => ROLES_AC[role].authorize(permissions).success;
    const grants: Record<string, string[]>[] = [{ member: ["create"] }, { member: ["update"] }, { member: ["delete"] }, { invitation: ["create"] }, { invitation: ["cancel"] }];
    for (const permissions of grants) {
      expect(can("owner", permissions)).toBe(true);
      for (const role of ["manager", "foreman", "accountant"] as const) expect(can(role, permissions)).toBe(false);
    }
    expect(can("manager", { organization: ["update"] })).toBe(true);
    expect(can("manager", { organization: ["delete"] })).toBe(false);
  });
  it("refuses inviting someone already in the team", async () => {
    expect((await refused(invite(owner.headers, manager.email, "foreman"))).status).toBe(400);
  });
  it("refuses demoting the last Owner and a Manager changing the Owner", async () => {
    const update = (headers: Headers) =>
      getAuth().api.updateMemberRole({ body: { memberId: ownerMemberId, role: "manager", organizationId }, headers });
    // Without 2FA an Owner change is refused first (F1); with it, the last-owner rule answers.
    expect(await refused(update(owner.headers))).toMatchObject({ status: 403 });
    await rows("owner", `update "user" set two_factor_enabled = true where id = $1`, [owner.userId]);
    expect(await refused(update(owner.headers))).toMatchObject({ status: 400, message: "Your business needs at least one owner." });
    await rows("owner", `update "user" set two_factor_enabled = false where id = $1`, [owner.userId]);
    expect((await refused(update(manager.headers))).status).toBe(403);
    const [m] = await rows<{ role: string }>("owner", "select role from member where id = $1", [ownerMemberId]);
    expect(m!.role).toBe("owner");
  });
  it("records a Better Auth role change in audit_event without an actor (accepted, see report)", async () => {
    const [mgr] = await rows<{ id: string }>("owner", "select id from member where user_id = $1", [manager.userId]);
    await getAuth().api.updateMemberRole({ body: { memberId: mgr!.id, role: "accountant", organizationId }, headers: owner.headers });
    const audit = await rows("owner", "select actor_user_id from audit_event where table_name = 'member' and row_id = $1 and action = 'update'", [mgr!.id]);
    expect(audit).toEqual([{ actor_user_id: null }]);
  });

  // Fix 1 (F4): Better Auth refuses these before beforeCreateInvitation runs, so the hook's own
  // branches are pinned by calling it directly; deleting a branch turns these red.
  it("guardInvite: Manager never, then (as Owner) already in the team (any case), already invited", async () => {
    await rows("owner", `update member set role = 'manager' where user_id = $1`, [manager.userId]);
    const asManager = { organizationId, inviterId: manager.userId };
    for (const role of ["owner", "foreman"] as const) {
      expect(await refused(guardInvite({ ...asManager, email: `g${n++}@example.com`, role }))).toMatchObject({
        status: 403,
        message: "You don't have access to this.",
      });
    }
    const base = { organizationId, inviterId: owner.userId };
    expect(await refused(guardInvite({ ...base, email: owner.email.toUpperCase(), role: "foreman" }))).toMatchObject({
      status: 400,
      message: "This person is already in your team.",
    });
    const email = `p${n++}@example.com`;
    await invite(owner.headers, email, "foreman");
    expect(await refused(guardInvite({ ...base, email, role: "foreman" }))).toMatchObject({
      status: 400,
      message: "This person has already been invited.",
    });
    await expect(guardInvite({ ...base, email: `ok${n++}@example.com`, role: "foreman" })).resolves.toBeUndefined();
  });
  it("guardKeepsAnOwner: the only Owner keeps the role", async () => {
    expect(await refused(guardKeepsAnOwner({ role: "owner", organizationId }, "manager"))).toMatchObject({
      status: 400,
      message: "Your business needs at least one owner.",
    });
    await expect(guardKeepsAnOwner({ role: "foreman", organizationId }, "manager")).resolves.toBeUndefined();
  });
  // Fix 1 (F1): role change and remove over the direct API need an Owner with 2FA for Owner changes.
  it("an Owner without 2FA cannot promote to Owner or remove an Owner; with 2FA they can", async () => {
    const third = await signUp();
    await getAuth().api.addMember({ body: { userId: third.userId, role: "foreman", organizationId } });
    const [t] = await rows<{ id: string }>("owner", "select id from member where user_id = $1", [third.userId]);
    const promote = () => getAuth().api.updateMemberRole({ body: { memberId: t!.id, role: "owner", organizationId }, headers: owner.headers });
    const remove = () => getAuth().api.removeMember({ body: { memberIdOrEmail: t!.id, organizationId }, headers: owner.headers });
    const roleOf = async () => (await rows<{ role: string }>("owner", "select role from member where id = $1", [t!.id]))[0]?.role;
    await rows("owner", `update "user" set two_factor_enabled = false where id = $1`, [owner.userId]);
    expect(await refused(promote())).toMatchObject({ status: 403, message: "You don't have access to this." });
    expect(await roleOf()).toBe("foreman");
    await rows("owner", `update "user" set two_factor_enabled = true where id = $1`, [owner.userId]);
    await promote();
    expect(await roleOf()).toBe("owner");
    await rows("owner", `update "user" set two_factor_enabled = false where id = $1`, [owner.userId]);
    expect(await refused(remove())).toMatchObject({ status: 403, message: "You don't have access to this." });
    expect(await roleOf()).toBe("owner");
    expect(await refused(guardMemberChange({ userId: owner.userId, organizationId, memberIdOrEmail: third.email, role: null }))).toMatchObject({ status: 403 });
    await rows("owner", `update "user" set two_factor_enabled = true where id = $1`, [owner.userId]);
    await remove();
    expect(await roleOf()).toBeUndefined();
  });
});
