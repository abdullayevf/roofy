// The audit trail (plan 04-db-auth Task 5): one SECURITY DEFINER trigger function, attached to
// exactly AUDITED_TABLES, writes one audit_event row per insert, update and delete with the row's
// before/after JSON (secret columns left out), app.user_id and the row's workspace.
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/data/contracts";
import { AUDIT_SECRET_COLUMNS, AUDITED_TABLES } from "@/server/db/audit";
import { TENANT_TABLES } from "@/server/db/tenancy";
import { withActor } from "@/server/db/with-actor";
import { closePools, pool, rows, seedWorkspace } from "./helpers";

type AuditRow = {
  id: string;
  workspace_id: string;
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor_user_id: string | null;
};

let a: Actor;
let b: Actor;

beforeAll(async () => {
  a = await seedWorkspace("Golf Roofing");
  b = await seedWorkspace("Hotel Roofing");
});

afterAll(async () => {
  await closePools();
});

const sorted = (list: readonly string[]) => [...list].sort();

/** Audit rows for one row, read through the owner pool (no RLS), keyed by action. */
async function auditOf(table: string, rowId: string) {
  const list = await rows<AuditRow>(
    "owner",
    `select id, workspace_id, table_name, row_id, action, before, after, actor_user_id
       from audit_event where table_name = $1 and row_id = $2`,
    [table, rowId],
  );
  return { list, by: Object.fromEntries(list.map((r) => [r.action, r])) as Record<string, AuditRow> };
}

/** The row as JSON, read through the owner pool. */
async function rowJson(table: string, id: string) {
  const [r] = await rows<{ row: Record<string, unknown> }>(
    "owner",
    `select to_jsonb(t) as row from "${table}" t where id = $1`,
    [id],
  );
  return r!.row;
}

async function seededId(table: string, workspaceId: string) {
  const [r] = await rows<{ id: string }>("owner", `select id from "${table}" where workspace_id = $1`, [
    workspaceId,
  ]);
  return r!.id;
}

async function pgError(promise: Promise<unknown>) {
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
const GRANT_REFUSAL = { code: "42501", message: expect.stringContaining("permission denied") };

describe("catalogue", () => {
  it("every audited table is a tenant table", () => {
    for (const table of AUDITED_TABLES) expect(TENANT_TABLES).toContain(table);
  });

  it("the audit trigger is attached to exactly AUDITED_TABLES, after each row insert, update and delete", async () => {
    const triggers = await rows<{ table: string; tgtype: number; args: string; enabled: string }>(
      "owner",
      `select c.relname as table, t.tgtype, encode(t.tgargs, 'escape') as args, t.tgenabled as enabled
         from pg_trigger t join pg_class c on c.oid = t.tgrelid
        where t.tgfoid = 'public.audit_row()'::regprocedure and not t.tgisinternal`,
    );
    expect(sorted(triggers.map((t) => t.table))).toEqual(sorted(AUDITED_TABLES));
    // ROW (1) + INSERT (4) + DELETE (8) + UPDATE (16); not BEFORE (2), INSTEAD (64) or TRUNCATE (32).
    for (const t of triggers)
      expect({ table: t.table, tgtype: t.tgtype, enabled: t.enabled }).toEqual({
        table: t.table,
        tgtype: 29,
        enabled: "O",
      });
    // Each trigger's arguments are that table's secret columns, and nothing else.
    const args = Object.fromEntries(triggers.map((t) => [t.table, t.args.split("\\000").filter(Boolean)]));
    const expected = Object.fromEntries(AUDITED_TABLES.map((t) => [t, [...(AUDIT_SECRET_COLUMNS[t] ?? [])]]));
    expect(args).toEqual(expected);
  });

  it("the trigger function is SECURITY DEFINER, owned by roofy, with search_path pinned and no PUBLIC execute", async () => {
    const [fn] = await rows<{
      definer: boolean;
      owner: string;
      config: string[];
      app: boolean;
      auth: boolean;
    }>(
      "owner",
      `select p.prosecdef as definer, pg_get_userbyid(p.proowner) as owner, p.proconfig as config,
              has_function_privilege('roofy_app', p.oid, 'EXECUTE') as app,
              has_function_privilege('roofy_auth', p.oid, 'EXECUTE') as auth
         from pg_proc p where p.oid = 'public.audit_row()'::regprocedure`,
    );
    expect(fn).toEqual({
      definer: true,
      owner: "roofy",
      config: ["search_path=pg_catalog, public, pg_temp"],
      app: false,
      auth: false,
    });
  });

  it("the only secret-like columns on audited tables are the ones left out", async () => {
    const cols = await rows<{ name: string }>(
      "owner",
      `select c.relname || '.' || a.attname as name from pg_attribute a join pg_class c on c.oid = a.attrelid
        where c.relnamespace = 'public'::regnamespace and c.relname = any($1) and a.attnum > 0
          and not a.attisdropped and a.attname ~ '(token|hash|secret|password|otp|key)'`,
      [[...AUDITED_TABLES]],
    );
    const dropped = Object.entries(AUDIT_SECRET_COLUMNS).flatMap(([t, list]) =>
      list!.map((c) => `${t}.${c}`),
    );
    expect(sorted(cols.map((c) => c.name))).toEqual(sorted(dropped));
  });
});

describe("audit rows", () => {
  it("an insert, update and delete on rate inside withActor write exactly 3 audit rows", async () => {
    const crewMemberId = await seededId("crew_member", a.workspaceId);
    const rateId = uuidv7();
    await withActor(a, (tx) =>
      tx.execute(sql`insert into rate (id, workspace_id, crew_member_id, basis, amount_cents, effective_from)
        values (${rateId}, ${a.workspaceId}, ${crewMemberId}, 'hourly', 4500, '2026-02-02')`),
    );
    const inserted = await rowJson("rate", rateId);
    await withActor(a, (tx) => tx.execute(sql`update rate set amount_cents = 5000 where id = ${rateId}`));
    const updated = await rowJson("rate", rateId);
    await withActor(a, (tx) => tx.execute(sql`delete from rate where id = ${rateId}`));

    const { list, by } = await auditOf("rate", rateId);
    expect(sorted(list.map((r) => r.action))).toEqual(["delete", "insert", "update"]);
    const common = {
      workspace_id: a.workspaceId,
      table_name: "rate",
      row_id: rateId,
      actor_user_id: a.userId,
    };
    expect(by.insert).toEqual({
      ...common,
      id: expect.any(String),
      action: "insert",
      before: null,
      after: inserted,
    });
    expect(by.update).toEqual({
      ...common,
      id: expect.any(String),
      action: "update",
      before: inserted,
      after: updated,
    });
    expect(by.delete).toEqual({
      ...common,
      id: expect.any(String),
      action: "delete",
      before: updated,
      after: null,
    });
    expect(inserted.amount_cents).toBe(4500);
    expect(updated.amount_cents).toBe(5000);
    // Audit ids are uuid v7 like every other id.
    for (const r of list)
      expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("an owner-pool insert (no actor set) records actor_user_id as null", async () => {
    const rateId = await seededId("rate", a.workspaceId);
    const { list } = await auditOf("rate", rateId);
    expect(list).toEqual([
      expect.objectContaining({ action: "insert", actor_user_id: null, workspace_id: a.workspaceId }),
    ]);
  });

  it("a workspace row is audited under its own id", async () => {
    const { list } = await auditOf("workspace", a.workspaceId);
    expect(list).toEqual([
      expect.objectContaining({
        action: "insert",
        workspace_id: a.workspaceId,
        before: null,
        actor_user_id: null,
      }),
    ]);
  });

  /** The row as the audit trail should show it: everything but the token hash. */
  const withoutTokenHash = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(row).filter(([column]) => column !== "token_hash"));

  it("statement_link.token_hash is left out of before and after", async () => {
    const linkId = await seededId("statement_link", a.workspaceId);
    const full = await rowJson("statement_link", linkId);
    expect(full.token_hash).toEqual(expect.any(String));
    const shown = withoutTokenHash(full);
    await withActor(a, (tx) =>
      tx.execute(sql`update statement_link set expires_at = '2031-01-01T00:00:00Z' where id = ${linkId}`),
    );
    const shownAfter = withoutTokenHash(await rowJson("statement_link", linkId));
    await withActor(a, (tx) => tx.execute(sql`delete from statement_link where id = ${linkId}`));
    const { list, by } = await auditOf("statement_link", linkId);
    expect(list).toHaveLength(3);
    expect(by.insert!.after).toEqual(shown);
    expect(by.update!.before).toEqual(shown);
    expect(by.update!.after).toEqual(shownAfter);
    expect(by.delete!.before).toEqual(shownAfter);
    expect(JSON.stringify(list)).not.toContain(String(full.token_hash));
  });
});

describe("deleting", () => {
  it("an owner-pool delete of a seeded workspace succeeds and leaves no audit rows for it", async () => {
    const gone = await seedWorkspace("India Roofing");
    const before = await rows<{ n: number }>(
      "owner",
      "select count(*)::int as n from audit_event where workspace_id = $1",
      [gone.workspaceId],
    );
    expect(before[0]!.n).toBeGreaterThan(0);
    expect(
      await pgError(rows("owner", "delete from workspace where id = $1", [gone.workspaceId])),
    ).toBeUndefined();
    const left = await rows<{ n: number }>(
      "owner",
      "select count(*)::int as n from workspace where id = $1",
      [gone.workspaceId],
    );
    expect(left[0]!.n).toBe(0);
    const after = await rows<{ n: number }>(
      "owner",
      "select count(*)::int as n from audit_event where workspace_id = $1",
      [gone.workspaceId],
    );
    expect(after[0]!.n).toBe(0);
  });

  it("deleting a single member still writes its delete audit row", async () => {
    const userId = uuidv7();
    const memberId = uuidv7();
    await rows("owner", `insert into "user" (id, name, email) values ($1, 'Leaving', $2)`, [
      userId,
      `leaving-${userId}@example.test`,
    ]);
    await rows(
      "owner",
      `insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, 'manager')`,
      [memberId, a.workspaceId, userId],
    );
    await rows("owner", "delete from member where id = $1", [memberId]);
    const { by } = await auditOf("member", memberId);
    expect(by.delete).toEqual(
      expect.objectContaining({
        workspace_id: a.workspaceId,
        after: null,
        before: expect.objectContaining({ id: memberId }),
      }),
    );
  });
});

describe("audit_event insert policy for roofy", () => {
  it("a non-superuser, non-BYPASSRLS member of roofy can insert an audit row but cannot read, update or delete any", async () => {
    const client = await pool("owner").connect();
    const probe = `audit_probe_${uuidv7().replaceAll("-", "")}`;
    try {
      await client.query("begin");
      await client.query(`create role ${probe} nologin nosuperuser nobypassrls`);
      await client.query(`grant roofy to ${probe}`);
      await client.query(`set local role ${probe}`);
      const inserted = await client.query(
        `insert into audit_event (id, workspace_id, table_name, row_id, action) values ($1, $2, 'rate', $3, 'insert')`,
        [uuidv7(), a.workspaceId, uuidv7()],
      );
      expect(inserted.rowCount).toBe(1);
      expect((await client.query("select count(*)::int as n from audit_event")).rows[0].n).toBe(0);
      expect((await client.query("update audit_event set action = 'delete'")).rowCount).toBe(0);
      expect((await client.query("delete from audit_event")).rowCount).toBe(0);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});

describe("roofy_app and audit_event", () => {
  it("cannot insert, update or delete audit rows (permission error)", async () => {
    const own = await auditOf("rate", await seededId("rate", a.workspaceId));
    const id = own.list[0]!.id;
    expect(
      await pgError(
        withActor(a, (tx) => tx.execute(sql`update audit_event set action = 'delete' where id = ${id}`)),
      ),
    ).toEqual(GRANT_REFUSAL);
    expect(
      await pgError(withActor(a, (tx) => tx.execute(sql`delete from audit_event where id = ${id}`))),
    ).toEqual(GRANT_REFUSAL);
    expect(
      await pgError(
        withActor(a, (tx) =>
          tx.execute(sql`insert into audit_event (id, workspace_id, table_name, row_id, action)
            values (${uuidv7()}, ${a.workspaceId}, 'rate', ${id}, 'insert')`),
        ),
      ),
    ).toEqual(GRANT_REFUSAL);
    expect((await auditOf("rate", own.list[0]!.row_id)).list).toEqual(own.list);
  });

  it("actor A reads its own audit rows and none of B's", async () => {
    const seen = await withActor(
      a,
      async (tx) => (await tx.execute(sql`select workspace_id from audit_event`)).rows,
    );
    // Exactly A's rows (the owner pool sees them all), and B has rows that stay hidden.
    const aRows = await rows("owner", `select 1 from audit_event where workspace_id = $1`, [a.workspaceId]);
    expect(seen).toHaveLength(aRows.length);
    expect(new Set(seen.map((r) => r.workspace_id))).toEqual(new Set([a.workspaceId]));
    const bRows = await rows("owner", `select 1 from audit_event where workspace_id = $1`, [b.workspaceId]);
    expect(bRows.length).toBeGreaterThan(0);
    const bSeen = await withActor(
      a,
      async (tx) =>
        (await tx.execute(sql`select 1 from audit_event where workspace_id = ${b.workspaceId}`)).rows,
    );
    expect(bSeen).toEqual([]);
  });
});
