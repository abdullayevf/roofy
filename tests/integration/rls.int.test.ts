// Row-level security on every tenant table (plan Task 4, review focus 1): the catalogue, role
// ownership and grants, and a cross-tenant select/insert/update/delete on every TENANT_TABLES
// entry as actor A against workspace B's seeded row.
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/data/contracts";
import { AUTH_TABLES, TENANT_TABLES } from "@/server/db/tenancy";
import { withActor } from "@/server/db/with-actor";
import { closePools, makeWorkspace, pool, rows } from "./helpers";

afterAll(async () => {
  await closePools();
});

const sorted = (list: readonly string[]) => [...list].sort();

/** The column each tenant table's policy matches on: `workspace` is its own tenant key. */
const keyOf = (table: string) => (table === "workspace" ? "id" : "workspace_id");

/** Better Auth reaches these tenant tables, with USING (true) policies. */
const AUTH_TENANT_TABLES = ["invitation", "member", "workspace"];

/** The Postgres error code a promise rejects with (drizzle wraps the pg error in `cause`). */
async function pgCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
  }
  return undefined;
}

describe("catalogue", () => {
  it("every public table is a tenant or an auth table, and only auth tables and workspace lack workspace_id", async () => {
    const tables = await rows<{ name: string; tenant_key: boolean }>(
      "owner",
      `select c.relname as name, exists (select 1 from pg_attribute a where a.attrelid = c.oid
         and a.attname = 'workspace_id' and not a.attisdropped) as tenant_key
       from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')`,
    );
    expect(sorted(tables.map((t) => t.name))).toEqual(sorted([...TENANT_TABLES, ...AUTH_TABLES]));
    expect(sorted(tables.filter((t) => !t.tenant_key).map((t) => t.name))).toEqual(
      sorted([...AUTH_TABLES, "workspace"]),
    );
  });

  it("RLS is enabled and forced on exactly the tenant tables", async () => {
    const forced = await rows<{ name: string }>(
      "owner",
      `select relname as name from pg_class where relnamespace = 'public'::regnamespace
         and relkind in ('r', 'p') and relrowsecurity and relforcerowsecurity`,
    );
    expect(sorted(forced.map((t) => t.name))).toEqual(sorted(TENANT_TABLES));
  });

  it("each tenant table has one roofy_app policy matching app.workspace_id on its tenant key", async () => {
    const policies = await rows<{ table: string; roles: string[]; qual: string; check: string | null }>(
      "owner",
      `select tablename as table, roles::text[] as roles, qual, with_check as check
       from pg_policies where schemaname = 'public'`,
    );
    for (const p of policies)
      expect(p.roles.length === 1 && ["roofy_app", "roofy_auth"].includes(p.roles[0]!)).toBe(true);
    const app = policies.filter((p) => p.roles[0] === "roofy_app");
    expect(sorted(app.map((p) => p.table))).toEqual(sorted(TENANT_TABLES));
    for (const p of app) {
      const expected = `(${keyOf(p.table)} = (NULLIF(current_setting('app.workspace_id'::text, true), ''::text))::uuid)`;
      expect({ table: p.table, qual: p.qual, check: p.check }).toEqual({
        table: p.table,
        qual: expected,
        check: expected,
      });
    }
    const auth = policies.filter((p) => p.roles[0] === "roofy_auth");
    expect(sorted(auth.map((p) => p.table))).toEqual(AUTH_TENANT_TABLES);
  });
});

describe("roles", () => {
  it("roofy_app and roofy_auth own nothing and cannot bypass RLS", async () => {
    const owned = await rows(
      "owner",
      `select c.relname from pg_class c join pg_roles r on r.oid = c.relowner
      where r.rolname in ('roofy_app', 'roofy_auth')`,
    );
    expect(owned).toEqual([]);
    const roles = await rows(
      "owner",
      `select rolname, rolbypassrls, rolsuper from pg_roles
      where rolname in ('roofy_app', 'roofy_auth') order by rolname`,
    );
    expect(roles).toEqual([
      { rolname: "roofy_app", rolbypassrls: false, rolsuper: false },
      { rolname: "roofy_auth", rolbypassrls: false, rolsuper: false },
    ]);
  });

  it("roofy_app has DML on every tenant table, SELECT only on audit_event, and nothing else", async () => {
    const grants = await rows<{ table: string; privileges: string }>(
      "owner",
      `select table_name as table, string_agg(privilege_type, ',' order by privilege_type) as privileges
       from information_schema.role_table_grants where grantee = 'roofy_app' group by table_name`,
    );
    const expected = TENANT_TABLES.map((t) => ({
      table: t,
      privileges: t === "audit_event" ? "SELECT" : "DELETE,INSERT,SELECT,UPDATE",
    }));
    expect(grants.sort((a, b) => a.table.localeCompare(b.table))).toEqual(
      expected.sort((a, b) => a.table.localeCompare(b.table)),
    );
  });

  it("roofy_auth has no privilege on a tenant table except workspace, member and invitation", async () => {
    const reachable = await rows<{ name: string }>(
      "owner",
      `select relname as name from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
         and has_table_privilege('roofy_auth', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`,
    );
    expect(sorted(reachable.map((t) => t.name))).toEqual(sorted([...AUTH_TABLES, ...AUTH_TENANT_TABLES]));
  });
});

// One row per tenant table per workspace, in an order that respects the composite FKs. The keys
// must equal TENANT_TABLES exactly; `workspace` and `member` come from makeWorkspace().
type Ctx = { user: string; id: Record<string, string> };
const FROM_MAKE_WORKSPACE = "makeWorkspace" as const;
const SEED: Record<string, ((c: Ctx) => Record<string, unknown>) | typeof FROM_MAKE_WORKSPACE> = {
  workspace: FROM_MAKE_WORKSPACE,
  member: FROM_MAKE_WORKSPACE,
  invitation: (c) => ({
    email: `invite-${uuidv7()}@example.test`,
    role: "manager",
    expires_at: "2030-01-01T00:00:00Z",
    inviter_id: c.user,
  }),
  client: () => ({ name: "Client" }),
  project: () => ({ site_address: "1 Test St", job_type: "repair" }),
  project_assignment: (c) => ({ member_id: c.id.member, project_id: c.id.project }),
  stage_template: () => ({ job_type: "repair", name: "Template" }),
  stage_template_item: (c) => ({ template_id: c.id.stage_template, name: "Item", position: 1 }),
  stage: (c) => ({ project_id: c.id.project, name: "Stage", position: 1 }),
  stage_segment: (c) => ({ stage_id: c.id.stage, start_date: "2026-09-28" }),
  crew_level: () => ({ name: "Level", floor_rate_cents: 3000 }),
  crew_member: () => ({ name: "Crew", type: "employee", active_from: "2026-01-05" }),
  rate: (c) => ({
    crew_member_id: c.id.crew_member,
    basis: "hourly",
    amount_cents: 4500,
    effective_from: "2026-01-05",
  }),
  stage_completion_share: (c) => ({
    stage_id: c.id.stage,
    crew_member_id: c.id.crew_member,
    share_bp: 10000,
  }),
  progress_entry: (c) => ({
    stage_id: c.id.stage,
    date: "2026-09-28",
    quantity: "12.50",
    entered_by: c.user,
  }),
  progress_share: (c) => ({
    progress_entry_id: c.id.progress_entry,
    crew_member_id: c.id.crew_member,
    share_bp: 10000,
  }),
  work_log: (c) => ({
    date: "2026-09-28",
    crew_member_id: c.id.crew_member,
    project_id: c.id.project,
    stage_id: c.id.stage,
    basis: "hourly",
    quantity: "8.00",
    hours: "8.00",
    rate_cents: 4500,
    amount_cents: 36000,
    source: "grid",
    entry_id: uuidv7(),
    entered_by: c.user,
  }),
  no_work: (c) => ({
    crew_member_id: c.id.crew_member,
    date: "2026-09-29",
    reason: "rain",
    entered_by: c.user,
  }),
  expense_category: () => ({ name: "Category" }),
  expense: (c) => ({
    project_id: c.id.project,
    category_id: c.id.expense_category,
    supplier: "Bunnings",
    date: "2026-09-28",
    amount_ex_gst_cents: 10000,
    gst_cents: 1000,
    paid_by: "company_card",
    entered_by: c.user,
  }),
  pay_run: () => ({ period_start: "2026-09-28", period_end: "2026-10-04" }),
  pay_run_line: (c) => ({
    pay_run_id: c.id.pay_run,
    crew_member_id: c.id.crew_member,
    kind: "log",
    ref_id: c.id.work_log,
    snapshot: "{}",
    amount_cents: 36000,
  }),
  ledger_entry: (c) => ({
    crew_member_id: c.id.crew_member,
    date: "2026-09-28",
    kind: "advance",
    amount_cents: 100,
  }),
  statement_link: (c) => ({
    pay_run_id: c.id.pay_run,
    crew_member_id: c.id.crew_member,
    token_hash: uuidv7(),
    expires_at: "2030-01-01T00:00:00Z",
  }),
  file: (c) => ({
    storage_key: `${c.id.workspace}/${uuidv7()}`,
    name: "a.jpg",
    mime: "image/jpeg",
    bytes: 1024,
    sha256: "0".repeat(64),
    entity_type: "project",
    entity_id: c.id.project,
  }),
  client_mutation: (c) => ({ user_id: c.user, type: "crew_day" }),
  audit_event: (c) => ({ table_name: "project", row_id: c.id.project, action: "insert" }),
};

/** Seeds one row in every tenant table for a new workspace, through the owner pool. */
async function seedWorkspace(name: string): Promise<Actor> {
  const { workspaceId, ownerActor } = await makeWorkspace(name);
  const owner = pool("owner");
  const ctx: Ctx = { user: ownerActor.userId, id: { workspace: workspaceId } };
  const [member] = await rows<{ id: string }>("owner", "select id from member where workspace_id = $1", [
    workspaceId,
  ]);
  ctx.id.member = member!.id;
  for (const [table, seed] of Object.entries(SEED)) {
    if (seed === FROM_MAKE_WORKSPACE) continue;
    const row = { id: uuidv7(), workspace_id: workspaceId, ...seed(ctx) };
    const cols = Object.keys(row);
    await owner.query(
      `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
      Object.values(row),
    );
    ctx.id[table] = row.id;
  }
  return ownerActor;
}

let a: Actor;
let b: Actor;

beforeAll(async () => {
  a = await seedWorkspace("Alpha Roofing");
  b = await seedWorkspace("Bravo Roofing");
});

describe("cross-tenant access as actor A", () => {
  it("the seed map covers exactly TENANT_TABLES", () => {
    expect(sorted(Object.keys(SEED))).toEqual(sorted(TENANT_TABLES));
  });

  it.each(TENANT_TABLES)("%s: B's row is invisible, and A sees only its own rows", async (table) => {
    const t = sql.identifier(table);
    const key = sql.identifier(keyOf(table));
    const seen = (actor: Actor, ws: string) =>
      withActor(
        actor,
        async (tx) => (await tx.execute(sql`select 1 from ${t} where ${key} = ${ws}`)).rows.length,
      );
    expect(await seen(a, b.workspaceId)).toBe(0);
    expect(await seen(b, b.workspaceId)).toBe(1);
    expect(await seen(a, a.workspaceId)).toBe(1);
    const foreign = await withActor(
      a,
      async (tx) => (await tx.execute(sql`select 1 from ${t} where ${key} <> ${a.workspaceId}`)).rows.length,
    );
    expect(foreign).toBe(0);
  });

  it.each(TENANT_TABLES)("%s: inserting a row for workspace B is refused", async (table) => {
    const [copy] = await rows<{ row: Record<string, unknown> }>(
      "owner",
      `select row_to_json(t) as row from "${table}" t where ${keyOf(table)} = $1`,
      [b.workspaceId],
    );
    const row: Record<string, unknown> = { ...copy!.row, id: uuidv7() };
    if (table !== "workspace") expect(row.workspace_id).toBe(b.workspaceId);
    const t = sql.identifier(table);
    const code = await pgCode(
      withActor(a, (tx) =>
        tx.execute(
          sql`insert into ${t} select * from json_populate_record(null::${t}, ${JSON.stringify(row)}::json)`,
        ),
      ),
    );
    expect(code).toBe("42501");
  });

  it.each(TENANT_TABLES)("%s: updating or deleting B's row touches nothing", async (table) => {
    const t = sql.identifier(table);
    const key = sql.identifier(keyOf(table));
    const count = (actor: Actor, q: ReturnType<typeof sql>) =>
      withActor(actor, async (tx) => (await tx.execute(q)).rowCount);
    if (table === "audit_event") {
      // roofy_app may only read audit_event; writes come from the Task 5 trigger.
      expect(await pgCode(count(a, sql`update ${t} set id = id where ${key} = ${b.workspaceId}`))).toBe(
        "42501",
      );
      expect(await pgCode(count(a, sql`delete from ${t} where ${key} = ${b.workspaceId}`))).toBe("42501");
    } else {
      expect(await count(a, sql`update ${t} set id = id where ${key} = ${b.workspaceId}`)).toBe(0);
      expect(await count(a, sql`delete from ${t} where ${key} = ${b.workspaceId}`)).toBe(0);
      // Control: the same update on A's own row does reach it.
      expect(await count(a, sql`update ${t} set id = id where ${key} = ${a.workspaceId}`)).toBe(1);
    }
    const left = await rows("owner", `select 1 from "${table}" where ${keyOf(table)} = $1`, [b.workspaceId]);
    expect(left).toHaveLength(1);
  });
});
