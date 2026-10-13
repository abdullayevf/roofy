// Row-level security on every tenant table (plan Task 4, review focus 1): the catalogue, role
// ownership and grants, and a cross-tenant select/insert/update/delete on every TENANT_TABLES
// entry as actor A against workspace B's seeded row.
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/data/contracts";
import { AUTH_TABLES, TENANT_TABLES } from "@/server/db/tenancy";
import { withActor } from "@/server/db/with-actor";
import { closePools, rows, SEED, seedOnly, seedWorkspace } from "./helpers";

afterAll(async () => {
  await closePools();
});

const sorted = (list: readonly string[]) => [...list].sort();

/** The column each tenant table's policy matches on: `workspace` is its own tenant key. */
const keyOf = (table: string) => (table === "workspace" ? "id" : "workspace_id");

/** Better Auth reaches these tenant tables, with USING (true) policies. */
const AUTH_TENANT_TABLES = ["invitation", "member", "workspace"];

/** The Postgres error a promise rejects with (drizzle wraps the pg error in `cause`). */
async function pgError(promise: Promise<unknown>): Promise<{ code?: string; message?: string } | undefined> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    return e.cause?.code
      ? { code: e.cause.code, message: e.cause.message }
      : { code: e.code, message: e.message };
  }
  return undefined;
}

const pgCode = async (promise: Promise<unknown>) => (await pgError(promise))?.code;

/** RLS refusals and missing grants share SQLSTATE 42501; tell them apart by the message. */
const RLS_REFUSAL = { code: "42501", message: expect.stringContaining("row-level security") };
const GRANT_REFUSAL = { code: "42501", message: expect.stringContaining("permission denied") };

/** Whether roofy_app holds a privilege on a table, PUBLIC grants included. */
async function appMay(table: string, privilege: string): Promise<boolean> {
  const [r] = await rows<{ ok: boolean }>("owner", `select has_table_privilege('roofy_app', $1, $2) as ok`, [
    `public."${table}"`,
    privilege,
  ]);
  return r!.ok;
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
    const all = await rows<{
      table: string;
      cmd: string;
      roles: string[];
      qual: string | null;
      check: string | null;
    }>(
      "owner",
      `select tablename as table, cmd, roles::text[] as roles, qual, with_check as check
       from pg_policies where schemaname = 'public'`,
    );
    // The one exception: the audit trigger (SECURITY DEFINER, owned by roofy) may insert audit rows
    // even when roofy is not a superuser. Insert only, nothing readable.
    const ownerPolicies = all.filter((p) => p.roles.includes("roofy"));
    expect(ownerPolicies).toEqual([
      { table: "audit_event", cmd: "INSERT", roles: ["roofy"], qual: null, check: "true" },
    ]);
    const policies = all.filter((p) => !p.roles.includes("roofy"));
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
    // has_table_privilege counts PUBLIC grants too, so a GRANT ... TO PUBLIC would show up here.
    const grants = await rows<{ table: string; privileges: string }>(
      "owner",
      `select c.relname as table, string_agg(p.priv, ',' order by p.priv) as privileges
       from pg_class c
       cross join unnest(array['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']) as p(priv)
       where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
         and has_table_privilege('roofy_app', c.oid, p.priv)
       group by c.relname`,
    );
    const expected = TENANT_TABLES.map((t) => ({
      table: t,
      privileges: t === "audit_event" ? "SELECT" : "DELETE,INSERT,SELECT,UPDATE",
    }));
    expect(grants.sort((a, b) => a.table.localeCompare(b.table))).toEqual(
      expected.sort((a, b) => a.table.localeCompare(b.table)),
    );
  });

  it("PUBLIC holds no privilege on any public relation", async () => {
    const publicGrants = await rows(
      "owner",
      `select c.relname, a.privilege_type from pg_class c, aclexplode(c.relacl) a
       where c.relnamespace = 'public'::regnamespace and a.grantee = 0`,
    );
    expect(publicGrants).toEqual([]);
  });

  it("roofy_app and roofy_auth cannot create objects in schema public", async () => {
    const may = await rows<{ app: boolean; auth: boolean }>(
      "owner",
      `select has_schema_privilege('roofy_app', 'public', 'CREATE') as app,
              has_schema_privilege('roofy_auth', 'public', 'CREATE') as auth`,
    );
    expect(may).toEqual([{ app: false, auth: false }]);
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
        async (tx) =>
          (await tx.execute(sql`select 1 from ${t} where ${key} = ${ws}${sql.raw(seedOnly(table))}`)).rows
            .length,
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
    const refusal = await pgError(
      withActor(a, (tx) =>
        tx.execute(
          sql`insert into ${t} select * from json_populate_record(null::${t}, ${JSON.stringify(row)}::json)`,
        ),
      ),
    );
    // audit_event has no INSERT grant (writes come from the Task 5 trigger); every other table
    // grants INSERT, so its refusal must come from the policy.
    const granted = await appMay(table, "INSERT");
    expect(granted).toBe(table !== "audit_event");
    expect(refusal).toEqual(granted ? RLS_REFUSAL : GRANT_REFUSAL);
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
    const left = await rows(
      "owner",
      `select 1 from "${table}" where ${keyOf(table)} = $1${seedOnly(table)}`,
      [b.workspaceId],
    );
    expect(left).toHaveLength(1);
  });

  it.each(TENANT_TABLES)("%s: moving A's own row to workspace B is refused (WITH CHECK)", async (table) => {
    const t = sql.identifier(table);
    const key = sql.identifier(keyOf(table));
    const refusal = await pgError(
      withActor(a, (tx) =>
        tx.execute(sql`update ${t} set ${key} = ${b.workspaceId} where ${key} = ${a.workspaceId}`),
      ),
    );
    const granted = await appMay(table, "UPDATE");
    expect(granted).toBe(table !== "audit_event");
    expect(refusal).toEqual(granted ? RLS_REFUSAL : GRANT_REFUSAL);
    const own = await rows("owner", `select 1 from "${table}" where ${keyOf(table)} = $1${seedOnly(table)}`, [
      a.workspaceId,
    ]);
    expect(own).toHaveLength(1);
  });
});
