// Task 11 run 2: members, invites, roles, assignments and two-factor on the real workspace service,
// against roofy_test through withActor (roofy_app, row-level security on). Member names, emails and
// 2FA come from workspace_member_profiles() (carry note T4(7)); roofy_app has no grant on "user".
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError, type Actor, type Role } from "@/data/contracts";
import { withActor } from "@/server/db/with-actor";
import { createWorkspaceService } from "@/server/services/workspace";
import { closePools, makeWorkspace, pool, rows } from "./helpers";

const ws = createWorkspaceService();
let a: Actor; // Owner of Alpha
let b: Actor; // Owner of Bravo
let manager: Actor;
let accountant: Actor;
let foreman: Actor;
let foremanMemberId = "";
let projectA = "";
let projectB = "";
let mailLog = "";

async function addMember(workspaceId: string, role: Role): Promise<Actor> {
  const userId = uuidv7();
  const name = `${role} ${userId.slice(-4)}`;
  await pool("owner").query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [userId, name, `${role}-${userId}@example.test`]);
  await pool("owner").query(`insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, $4)`, [uuidv7(), workspaceId, userId, role]);
  return { userId, workspaceId, role, name };
}
const memberIdOf = async (actor: Actor) =>
  (await rows<{ id: string }>("owner", "select id from member where user_id = $1 and workspace_id = $2", [actor.userId, actor.workspaceId]))[0]!.id;
const addProject = async (workspaceId: string) => {
  const id = uuidv7();
  await pool("owner").query(`insert into project (id, workspace_id, site_address, job_type) values ($1, $2, '1 Test St', 'repair')`, [id, workspaceId]);
  return id;
};
const setTwoFactor = (actor: Actor, on: boolean) =>
  pool("owner").query(`update "user" set two_factor_enabled = $2 where id = $1`, [actor.userId, on]);
const mailsTo = (to: string) =>
  existsSync(mailLog) ? readFileSync(mailLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { to: string; subject: string }).filter((m) => m.to === to) : [];

async function refusal(p: Promise<unknown>): Promise<string> {
  return p.then(
    () => expect.fail("expected a refusal"),
    (e: unknown) => {
      expect(e).toBeInstanceOf(DataError);
      return `${(e as DataError).code}: ${(e as DataError).message}`;
    },
  );
}
const FORBIDDEN = "forbidden: You don't have access to this.";
const NOT_FOUND = /^not_found: /;

beforeAll(async () => {
  mailLog = join(mkdtempSync(join(tmpdir(), "roofy-mail-")), "mail.jsonl");
  process.env.ROOFY_MAIL = "console";
  process.env.ROOFY_MAIL_LOG = mailLog;
  process.env.BETTER_AUTH_URL ??= "http://localhost:3100";
  a = (await makeWorkspace("Alpha Members")).ownerActor;
  b = (await makeWorkspace("Bravo Members")).ownerActor;
  manager = await addMember(a.workspaceId, "manager");
  accountant = await addMember(a.workspaceId, "accountant");
  foreman = await addMember(a.workspaceId, "foreman");
  foremanMemberId = await memberIdOf(foreman);
  projectA = await addProject(a.workspaceId);
  projectB = await addProject(b.workspaceId);
});
afterAll(closePools);

describe("member profiles (T4(7))", () => {
  it("roofy_app cannot read the user table, and B's actor sees none of A's emails", async () => {
    await expect(withActor(b, (tx) => tx.execute(sql`select email from "user"`))).rejects.toThrow();
    const seen = await withActor(b, (tx) => tx.execute<{ email: string }>(sql`select email from workspace_member_profiles()`));
    const emails = seen.rows.map((r) => r.email);
    expect(emails).not.toContain(`manager-${manager.userId}@example.test`);
    expect(emails).toHaveLength(1);
  });
});

describe("members", () => {
  it("lists A's members with email and 2FA for Owner and Manager; B sees none of them", async () => {
    await setTwoFactor(manager, true);
    const list = await ws.members(manager);
    expect(list.map((m) => m.role).sort()).toEqual(["accountant", "foreman", "manager", "owner"]);
    const mgr = list.find((m) => m.userId === manager.userId)!;
    expect(mgr).toMatchObject({ email: `manager-${manager.userId}@example.test`, twoFactorEnabled: true, projectIds: [] });
    const bList = await ws.members(b);
    expect(bList.map((m) => m.userId)).toEqual([b.userId]);
  });
  it("refuses foreman and accountant", async () => {
    expect(await refusal(ws.members(foreman))).toBe(FORBIDDEN);
    expect(await refusal(ws.members(accountant))).toBe(FORBIDDEN);
  });
});

describe("inviteMember", () => {
  it("creates a pending invitation and sends one invite mail", async () => {
    const email = `New.Person-${uuidv7()}@Example.test`;
    const invited = await ws.inviteMember(a, { email, name: "New Person", role: "foreman" });
    const lower = email.toLowerCase();
    expect(invited).toMatchObject({ email: lower, name: "New Person", role: "foreman", twoFactorEnabled: false, projectIds: [] });
    const inv = await rows("owner", "select email, role, status, inviter_id from invitation where id = $1 and workspace_id = $2", [invited.id, a.workspaceId]);
    expect(inv).toEqual([{ email: lower, role: "foreman", status: "pending", inviter_id: a.userId }]);
    expect(mailsTo(lower)).toHaveLength(1);
    expect(await refusal(ws.inviteMember(manager, { email, name: "Again", role: "foreman" }))).toBe("conflict: This person has already been invited.");
    expect(mailsTo(lower)).toHaveLength(1);
  });
  it("refuses an existing member's email, in any case", async () => {
    const email = `MANAGER-${manager.userId}@example.test`;
    expect(await refusal(ws.inviteMember(a, { email, name: "Dup", role: "foreman" }))).toBe("conflict: This person is already in your team.");
  });
  it("lets a Manager invite non-owners but never as Owner; accountant and foreman are forbidden", async () => {
    await ws.inviteMember(manager, { email: `m-${uuidv7()}@example.test`, name: "By manager", role: "accountant" });
    expect(await refusal(ws.inviteMember(manager, { email: `o-${uuidv7()}@example.test`, name: "X", role: "owner" }))).toBe(FORBIDDEN);
    expect(await refusal(ws.inviteMember(accountant, { email: `x-${uuidv7()}@example.test`, name: "X", role: "foreman" }))).toBe(FORBIDDEN);
    expect(await refusal(ws.inviteMember(foreman, { email: `y-${uuidv7()}@example.test`, name: "X", role: "foreman" }))).toBe(FORBIDDEN);
  });
});

describe("setMemberRole", () => {
  it("refuses demoting the last Owner", async () => {
    await setTwoFactor(a, true);
    expect(await refusal(ws.setMemberRole(a, await memberIdOf(a), "manager"))).toBe("conflict: Your business needs at least one owner.");
  });
  it("forbids a Manager setting anyone to or from Owner", async () => {
    expect(await refusal(ws.setMemberRole(manager, await memberIdOf(a), "manager"))).toBe(FORBIDDEN);
    expect(await refusal(ws.setMemberRole(manager, foremanMemberId, "owner"))).toBe(FORBIDDEN);
  });
  it("lets a Manager change other roles, audited with the actor", async () => {
    const acc = await memberIdOf(accountant);
    expect(await ws.setMemberRole(manager, acc, "manager")).toMatchObject({ id: acc, role: "manager" });
    const audit = await rows("owner", "select action, actor_user_id from audit_event where workspace_id = $1 and table_name = 'member' and row_id = $2 and action = 'update'", [a.workspaceId, acc]);
    expect(audit).toEqual([{ action: "update", actor_user_id: manager.userId }]);
    await ws.setMemberRole(manager, acc, "accountant");
  });
  it("B on A's member and a bad id reject not_found; accountant writes are forbidden", async () => {
    expect(await refusal(ws.setMemberRole(b, foremanMemberId, "manager"))).toMatch(NOT_FOUND);
    expect(await refusal(ws.setMemberRole(a, "nope", "manager"))).toMatch(NOT_FOUND);
    expect(await refusal(ws.setMemberRole(accountant, foremanMemberId, "manager"))).toBe(FORBIDDEN);
  });
});

describe("assignments", () => {
  it("setAssignments limits a foreman's projectIds", async () => {
    await ws.setAssignments(a, foremanMemberId, [projectA, projectA]);
    expect(await ws.assignments(manager)).toEqual([{ memberId: foremanMemberId, name: foreman.name, projectIds: [projectA] }]);
    expect((await ws.members(a)).find((m) => m.id === foremanMemberId)!.projectIds).toEqual([projectA]);
    await ws.setAssignments(manager, foremanMemberId, []);
    expect((await ws.assignments(a))[0]!.projectIds).toEqual([]);
  });
  it("refuses a non-foreman, B's project, B on A's foreman, and accountant or foreman callers", async () => {
    expect(await refusal(ws.setAssignments(a, await memberIdOf(manager), [projectA]))).toBe("invalid: Only a foreman is assigned to jobs.");
    expect(await refusal(ws.setAssignments(a, foremanMemberId, [projectB]))).toMatch(NOT_FOUND);
    expect(await refusal(ws.setAssignments(b, foremanMemberId, [projectB]))).toMatch(NOT_FOUND);
    expect(await refusal(ws.setAssignments(accountant, foremanMemberId, [projectA]))).toBe(FORBIDDEN);
    expect(await refusal(ws.assignments(foreman))).toBe(FORBIDDEN);
    expect(await ws.assignments(b)).toEqual([]);
  });
});

describe("turnOnTwoFactor", () => {
  it("reflects Better Auth's TOTP state for the caller", async () => {
    await setTwoFactor(foreman, false);
    expect(await refusal(ws.turnOnTwoFactor(foreman, "12 34 56"))).toBe(
      "conflict: Scan the code with your authenticator app and confirm it first.",
    );
    expect(await refusal(ws.turnOnTwoFactor(foreman, "12345"))).toBe("invalid: Enter the 6-digit code from your app.");
    await setTwoFactor(foreman, true);
    expect(await ws.turnOnTwoFactor(foreman, "123456")).toEqual({ twoFactorEnabled: true });
  });
});

// ─── Task 11 fix 1 ──────────────────────────────────────────────────────────

describe("fix 1: Owner 2FA in settings is read inside withActor (B1/F8)", () => {
  it("reports the actor's own Owner 2FA off and on, never another business's", async () => {
    const own = async (actor: Actor) => {
      const v = await ws.settings(actor);
      return v.view === "manager" ? v.ownerTwoFactor : undefined;
    };
    await setTwoFactor(a, false);
    await setTwoFactor(b, true);
    expect(await own(a)).toBe(false);
    expect(await own(b)).toBe(true);
    await setTwoFactor(a, true);
    expect(await own(a)).toBe(true);
    await setTwoFactor(a, false);
    await setTwoFactor(b, false);
  });
});

describe("fix 1: last-owner rule is atomic (F2)", () => {
  it("the database refuses taking the role away from the only Owner", async () => {
    const c = (await makeWorkspace("Lone Owner")).ownerActor;
    const id = await memberIdOf(c);
    await expect(pool("owner").query(`update member set role = 'manager' where id = $1`, [id])).rejects.toThrow(/roofy_last_owner/);
    await expect(pool("owner").query(`delete from member where id = $1`, [id])).rejects.toThrow(/roofy_last_owner/);
  });
  it("two Owners demoting each other at the same moment leave one Owner", async () => {
    for (let i = 0; i < 3; i++) {
      const o1 = (await makeWorkspace(`Race ${i}`)).ownerActor;
      const o2 = await addMember(o1.workspaceId, "owner");
      await setTwoFactor(o1, true);
      await setTwoFactor(o2, true);
      const [m1, m2] = [await memberIdOf(o1), await memberIdOf(o2)];
      const results = await Promise.allSettled([ws.setMemberRole(o1, m2, "manager"), ws.setMemberRole(o2, m1, "manager")]);
      const owners = await rows("owner", "select id from member where workspace_id = $1 and role = 'owner'", [o1.workspaceId]);
      expect(owners).toHaveLength(1);
      const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      expect(failed).toHaveLength(1);
      expect(`${(failed[0]!.reason as DataError).code}: ${(failed[0]!.reason as DataError).message}`).toBe(
        "conflict: Your business needs at least one owner.",
      );
    }
  });
});

describe("fix 1: invites (F3, F9)", () => {
  it("a failed invite mail removes the invite, so the next invite works", async () => {
    const email = `mailfail-${uuidv7()}@example.test`;
    process.env.ROOFY_MAIL = "broken";
    try {
      expect(await refusal(ws.inviteMember(a, { name: "Fail", email, role: "foreman" }))).toBe(
        "unavailable: We couldn't send the invite. Try again.",
      );
    } finally {
      process.env.ROOFY_MAIL = "console";
    }
    expect(await rows("owner", "select id from invitation where lower(email) = $1", [email])).toEqual([]);
    await ws.inviteMember(a, { name: "Fail", email, role: "foreman" });
    expect(await rows("owner", "select id from invitation where lower(email) = $1 and status = 'pending'", [email])).toHaveLength(1);
    expect(mailsTo(email)).toHaveLength(1);
  });
  it("two invites for one email at the same moment make one invite", async () => {
    const email = `double-${uuidv7()}@example.test`;
    const results = await Promise.allSettled([1, 2].map(() => ws.inviteMember(a, { name: "Twice", email, role: "foreman" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await rows("owner", "select id from invitation where lower(email) = $1", [email])).toHaveLength(1);
  });
});

describe("fix 1: workspace_member_profiles() safety (F5)", () => {
  it("is a definer with a pinned search_path, runnable by roofy_app only", async () => {
    const [f] = await rows<{ prosecdef: boolean; proconfig: string[]; acl: string[] }>(
      "owner",
      `select prosecdef, proconfig, coalesce(proacl::text[], '{}') as acl from pg_proc where proname = 'workspace_member_profiles'`,
    );
    expect(f!.prosecdef).toBe(true);
    expect(f!.proconfig).toEqual(["search_path=pg_catalog, pg_temp"]);
    expect(f!.acl.some((e) => e.startsWith("="))).toBe(false);
    expect(f!.acl.some((e) => e.startsWith("roofy_app=X"))).toBe(true);
    const [g] = await rows<{ can: boolean }>("owner", `select has_table_privilege('roofy_app', 'public."user"', 'select') as can`);
    expect(g!.can).toBe(false);
  });
  it("returns exactly user_id, name, email, two_factor_enabled, and nothing with no business set", async () => {
    const cols = await rows<{ name: string }>(
      "owner",
      `select unnest(proargnames) as name from pg_proc where proname = 'workspace_member_profiles'`,
    );
    expect(cols.map((c) => c.name)).toEqual(["user_id", "name", "email", "two_factor_enabled"]);
    const client = await pool("app").connect();
    try {
      expect((await client.query("select * from workspace_member_profiles()")).rows).toEqual([]);
      await client.query("begin");
      await client.query("select set_config('app.workspace_id', '', true)");
      expect((await client.query("select * from workspace_member_profiles()")).rows).toEqual([]);
      await client.query("rollback");
    } finally {
      client.release();
    }
  });
  it("workspace B sees only its own people, never A's emails", async () => {
    const seen = await withActor(b, async (tx) => {
      const res: unknown = await tx.execute(sql`select email from workspace_member_profiles()`);
      return (Array.isArray(res) ? res : (res as { rows: { email: string }[] }).rows) as { email: string }[];
    });
    const aEmails = await rows<{ email: string }>(
      "owner",
      `select u.email from member m join "user" u on u.id = m.user_id where m.workspace_id = $1`,
      [a.workspaceId],
    );
    expect(aEmails.length).toBeGreaterThan(1);
    expect(seen.filter((s) => aEmails.some((x) => x.email === s.email))).toEqual([]);
    expect(seen).toHaveLength(1);
  });
});

describe("fix 1: another business's job id is not_found (spec NB1)", () => {
  it("setAssignments with B's job", async () => {
    expect(await refusal(ws.setAssignments(a, foremanMemberId, [projectB]))).toMatch(NOT_FOUND);
  });
});

describe("removeMember", () => {
  const gone = async (id: string) => (await rows("owner", "select id from member where id = $1", [id])).length === 0;
  it("a Manager removes a foreman: the member and their job assignments go, audited with the actor", async () => {
    const f = await addMember(a.workspaceId, "foreman");
    const id = await memberIdOf(f);
    await ws.setAssignments(a, id, [projectA]);
    await ws.removeMember(manager, id);
    expect(await gone(id)).toBe(true);
    expect(await rows("owner", "select 1 from project_assignment where member_id = $1", [id])).toEqual([]);
    const audit = await rows("owner", "select action, actor_user_id from audit_event where workspace_id = $1 and table_name = 'member' and row_id = $2 and action = 'delete'", [a.workspaceId, id]);
    expect(audit).toEqual([{ action: "delete", actor_user_id: manager.userId }]);
    expect(await refusal(ws.removeMember(a, id))).toMatch(NOT_FOUND);
  });
  it("accountant and foreman callers are forbidden; B's actor and a bad id are not_found", async () => {
    expect(await refusal(ws.removeMember(accountant, foremanMemberId))).toBe(FORBIDDEN);
    expect(await refusal(ws.removeMember(foreman, foremanMemberId))).toBe(FORBIDDEN);
    expect(await refusal(ws.removeMember(b, foremanMemberId))).toMatch(NOT_FOUND);
    expect(await refusal(ws.removeMember(a, "nope"))).toMatch(NOT_FOUND);
    expect(await gone(foremanMemberId)).toBe(false);
  });
  it("you can't remove yourself, and a Manager can't remove the Owner", async () => {
    await setTwoFactor(a, true);
    expect(await refusal(ws.removeMember(manager, await memberIdOf(manager)))).toBe("conflict: You can't remove yourself. Ask another owner.");
    expect(await refusal(ws.removeMember(a, await memberIdOf(a)))).toBe("conflict: You can't remove yourself. Ask another owner.");
    expect(await refusal(ws.removeMember(manager, await memberIdOf(a)))).toBe(FORBIDDEN);
  });
  it("an owner is removed only by an Owner with two-factor on, and one Owner always stays", async () => {
    const o1 = (await makeWorkspace("Remove Owners")).ownerActor;
    const o2 = await addMember(o1.workspaceId, "owner");
    const [m1, m2] = [await memberIdOf(o1), await memberIdOf(o2)];
    await setTwoFactor(o1, false);
    expect(await refusal(ws.removeMember(o1, m2))).toBe(FORBIDDEN);
    await setTwoFactor(o1, true);
    await ws.removeMember(o1, m2);
    expect(await gone(m2)).toBe(true);
    expect(await rows("owner", "select id from member where workspace_id = $1 and role = 'owner'", [o1.workspaceId])).toEqual([{ id: m1 }]);
    expect(await refusal(ws.removeMember(o1, m1))).toBe("conflict: You can't remove yourself. Ask another owner.");
  });
  it("two Owners removing each other at the same moment leave one Owner", async () => {
    const o1 = (await makeWorkspace("Remove Race")).ownerActor;
    const o2 = await addMember(o1.workspaceId, "owner");
    await setTwoFactor(o1, true);
    await setTwoFactor(o2, true);
    const [m1, m2] = [await memberIdOf(o1), await memberIdOf(o2)];
    const results = await Promise.allSettled([ws.removeMember(o1, m2), ws.removeMember(o2, m1)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await rows("owner", "select id from member where workspace_id = $1 and role = 'owner'", [o1.workspaceId])).toHaveLength(1);
  });
});
