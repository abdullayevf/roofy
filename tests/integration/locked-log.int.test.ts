// Locked logs (plan 04-db-auth Task 6): a work_log with pay_run_id set cannot be updated, soft-deleted,
// deleted or unlocked, and no log can be locked or inserted locked, except inside withLockedWrite (the
// Phase 7 approve and reopen path). Deleting a whole workspace still cascades through its locked logs.
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/data/contracts";
import { withLockedWrite } from "@/server/db/locked";
import { withActor, type Tx } from "@/server/db/with-actor";
import { closePools, pool, rows, seedWorkspace } from "./helpers";

const LOCKED = { code: "RF001", message: "This log is in an approved pay run" };

type Ids = {
  actor: Actor;
  workspace: string;
  crew_member: string;
  project: string;
  stage: string;
  pay_run: string;
};

let a: Actor;
let ids: Ids;

/** The seeded parent rows of one workspace, read through the owner pool. */
async function idsOf(actor: Actor): Promise<Ids> {
  const workspaceId = actor.workspaceId;
  const found: Record<string, unknown> = { actor, workspace: workspaceId };
  for (const table of ["crew_member", "project", "stage", "pay_run"]) {
    const [row] = await rows<{ id: string }>(
      "owner",
      `select id from ${table} where workspace_id = $1 limit 1`,
      [workspaceId],
    );
    found[table] = row!.id;
  }
  return found as Ids;
}

/** An insert of a fresh 8-hour log of `of`'s workspace, with pay_run_id set when given. */
const insertLog = (of: Ids, id: string, payRunId: string | null, adjustsLogId: string | null = null) =>
  sql`insert into work_log (id, workspace_id, date, crew_member_id, project_id, stage_id, basis, quantity, hours,
        rate_cents, amount_cents, source, entry_id, adjusts_log_id, pay_run_id, entered_by)
      values (${id}, ${of.workspace}, '2026-09-28', ${of.crew_member}, ${of.project}, ${of.stage}, 'hourly', 8, 8,
        4500, 36000, ${adjustsLogId ? "adjustment" : "grid"}, ${uuidv7()}, ${adjustsLogId}, ${payRunId},
        ${of.actor.userId})`;

/** Inserts a fresh unlocked log as the workspace's actor, then locks it to `payRunId` through withLockedWrite. */
async function makeLog(
  of: Ids,
  payRunId: string | null,
  adjustsLogId: string | null = null,
): Promise<string> {
  const id = uuidv7();
  await withActor(of.actor, async (tx) => {
    await tx.execute(insertLog(of, id, null, adjustsLogId));
    if (payRunId) {
      await withLockedWrite(tx, () =>
        tx.execute(sql`update work_log set pay_run_id = ${payRunId} where id = ${id}`),
      );
    }
  });
  return id;
}

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

const logRow = async (id: string) =>
  (
    await rows<{ hours: string; pay_run_id: string | null; deleted_at: Date | null }>(
      "owner",
      "select hours, pay_run_id, deleted_at from work_log where id = $1",
      [id],
    )
  )[0];

type Audit = {
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
const lastAudit = async (id: string) =>
  (
    await rows<Audit>(
      "owner",
      "select action, before, after from audit_event where table_name = 'work_log' and row_id = $1 order by at desc limit 1",
      [id],
    )
  )[0];

beforeAll(async () => {
  a = await seedWorkspace("India Roofing");
  ids = await idsOf(a);
});

afterAll(async () => {
  await closePools();
});

type Change = { name: string; locked: boolean; run: (tx: Tx, id: string) => Promise<unknown> };
const CHANGES: Change[] = [
  {
    name: "updating hours",
    locked: true,
    run: (tx, id) => tx.execute(sql`update work_log set hours = 9 where id = ${id}`),
  },
  {
    name: "setting deleted_at",
    locked: true,
    run: (tx, id) => tx.execute(sql`update work_log set deleted_at = now() where id = ${id}`),
  },
  { name: "deleting", locked: true, run: (tx, id) => tx.execute(sql`delete from work_log where id = ${id}`) },
  {
    name: "setting pay_run_id to null",
    locked: true,
    run: (tx, id) => tx.execute(sql`update work_log set pay_run_id = null where id = ${id}`),
  },
  {
    name: "setting pay_run_id on an unlocked log",
    locked: false,
    run: (tx, id) => tx.execute(sql`update work_log set pay_run_id = ${ids.pay_run} where id = ${id}`),
  },
];

describe("a locked log, outside withLockedWrite", () => {
  it.each(CHANGES)("$name raises RF001 and leaves the row as it was", async ({ locked, run }) => {
    const id = await makeLog(ids, locked ? ids.pay_run : null);
    const before = await logRow(id);
    expect(await pgError(withActor(a, (tx) => run(tx, id)))).toEqual(LOCKED);
    expect(await logRow(id)).toEqual(before);
  });

  it("an unlocked log can still be updated and deleted", async () => {
    const id = await makeLog(ids, null);
    await withActor(a, (tx) => tx.execute(sql`update work_log set hours = 9 where id = ${id}`));
    expect((await logRow(id))?.hours).toBe("9.00");
    await withActor(a, (tx) => tx.execute(sql`delete from work_log where id = ${id}`));
    expect(await logRow(id)).toBeUndefined();
  });

  it("inserting a log with pay_run_id set raises RF001 and writes nothing, for roofy_app and the owner pool", async () => {
    const id = uuidv7();
    expect(await pgError(withActor(a, (tx) => tx.execute(insertLog(ids, id, ids.pay_run))))).toEqual(LOCKED);
    const owner = drizzle(pool("owner"));
    expect(await pgError(owner.execute(insertLog(ids, id, ids.pay_run)))).toEqual(LOCKED);
    expect(await logRow(id)).toBeUndefined();
  });

  it("the owner pool (a superuser) is refused too, for update and a direct delete", async () => {
    const id = await makeLog(ids, ids.pay_run);
    expect(await pgError(pool("owner").query("update work_log set hours = 9 where id = $1", [id]))).toEqual(
      LOCKED,
    );
    expect(await pgError(pool("owner").query("delete from work_log where id = $1", [id]))).toEqual(LOCKED);
    expect(await logRow(id)).toBeDefined();
  });
});

describe("inside withLockedWrite", () => {
  it.each(CHANGES)("$name succeeds and is audited", async ({ name, locked, run }) => {
    const id = await makeLog(ids, locked ? ids.pay_run : null);
    await withActor(a, (tx) => withLockedWrite(tx, () => run(tx, id)));
    const audit = await lastAudit(id);
    const after = await logRow(id);
    if (name === "deleting") {
      expect(after).toBeUndefined();
      expect(audit).toMatchObject({ action: "delete", after: null, before: { id, pay_run_id: ids.pay_run } });
      return;
    }
    expect(audit?.action).toBe("update");
    expect(audit?.before).toMatchObject({ id, pay_run_id: locked ? ids.pay_run : null, hours: 8 });
    const expected: Record<string, Partial<Record<string, unknown>>> = {
      "updating hours": { hours: 9, pay_run_id: ids.pay_run, deleted_at: null },
      "setting deleted_at": { hours: 8, pay_run_id: ids.pay_run, deleted_at: expect.any(String) },
      "setting pay_run_id to null": { hours: 8, pay_run_id: null },
      "setting pay_run_id on an unlocked log": { hours: 8, pay_run_id: ids.pay_run },
    };
    expect(audit?.after).toMatchObject({ id, ...expected[name] });
    expect(after?.pay_run_id ?? null).toBe(expected[name]!.pay_run_id);
  });

  it("inserting a log with pay_run_id set succeeds and is audited", async () => {
    const id = uuidv7();
    await withActor(a, (tx) => withLockedWrite(tx, () => tx.execute(insertLog(ids, id, ids.pay_run))));
    expect((await logRow(id))?.pay_run_id).toBe(ids.pay_run);
    expect(await lastAudit(id)).toMatchObject({
      action: "insert",
      before: null,
      after: { id, pay_run_id: ids.pay_run },
    });
  });

  it("after it returns, an update in the same transaction is rejected again", async () => {
    const id = await makeLog(ids, ids.pay_run);
    const run = withActor(a, async (tx) => {
      await withLockedWrite(tx, () => tx.execute(sql`update work_log set hours = 9 where id = ${id}`));
      await tx.execute(sql`update work_log set hours = 10 where id = ${id}`);
    });
    expect(await pgError(run)).toEqual(LOCKED);
    expect((await logRow(id))?.hours).toBe("8.00");
  });

  it("after fn throws, an update in the same transaction is rejected again", async () => {
    const id = await makeLog(ids, ids.pay_run);
    const run = withActor(a, async (tx) => {
      await expect(
        withLockedWrite(tx, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      await tx.execute(sql`update work_log set hours = 10 where id = ${id}`);
    });
    expect(await pgError(run)).toEqual(LOCKED);
    expect((await logRow(id))?.hours).toBe("8.00");
  });

  it("is transaction-local: a database error in fn rethrows it, and the pooled connection is locked again", async () => {
    const id = await makeLog(ids, ids.pay_run);
    let pid = 0;
    const run = withActor(a, async (tx) => {
      const [row] = (await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows;
      pid = row!.pid;
      await withLockedWrite(tx, () => tx.execute(sql`select 1 / 0`));
    });
    expect((await pgError(run))?.code).toBe("22012");
    // pg-pool hands back the most recently released client: the same connection, after a rollback.
    const client = await pool("app").connect();
    try {
      const { rows: same } = await client.query<{ pid: number }>("select pg_backend_pid() as pid");
      expect(same[0]!.pid).toBe(pid);
      await client.query("begin");
      await client.query("select set_config('app.workspace_id', $1, true)", [a.workspaceId]);
      expect(await pgError(client.query("update work_log set hours = 9 where id = $1", [id]))).toEqual(
        LOCKED,
      );
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});

describe("foreign keys that touch work_log", () => {
  it("deleting a workspace through the owner pool cascades through its locked logs and adjustments", async () => {
    const owner = await seedWorkspace("Juliet Roofing");
    const of = await idsOf(owner);
    const locked = await makeLog(of, of.pay_run);
    await makeLog(of, of.pay_run, locked);
    await makeLog(of, null, locked);
    await pool("owner").query("delete from workspace where id = $1", [owner.workspaceId]);
    expect(
      await rows("owner", "select id from work_log where workspace_id = $1", [owner.workspaceId]),
    ).toEqual([]);
  });

  it("deleting its own workspace as roofy_app cascades through its locked logs", async () => {
    const owner = await seedWorkspace("Kilo Roofing");
    const of = await idsOf(owner);
    await makeLog(of, of.pay_run);
    await withActor(owner, (tx) => tx.execute(sql`delete from workspace where id = ${owner.workspaceId}`));
    expect(
      await rows("owner", "select id from work_log where workspace_id = $1", [owner.workspaceId]),
    ).toEqual([]);
  });

  it("a direct delete (trigger depth 1) of a locked log raises RF001 even when its workspace row is gone", async () => {
    const owner = await seedWorkspace("Lima Roofing");
    const of = await idsOf(owner);
    const id = await makeLog(of, of.pay_run);
    const client = await pool("owner").connect();
    try {
      await client.query("begin");
      // Replica mode skips the FK cascade, so the workspace row goes and its locked log stays.
      await client.query("set local session_replication_role = replica");
      await client.query("delete from workspace where id = $1", [owner.workspaceId]);
      await client.query("set local session_replication_role = origin");
      expect(await pgError(client.query("delete from work_log where id = $1", [id]))).toEqual(LOCKED);
    } finally {
      await client.query("rollback");
      client.release();
    }
    expect(await logRow(id)).toBeDefined();
  });

  it("deleting a pay run that has locked logs is refused by work_log_pay_run_fk (no action)", async () => {
    const payRun = uuidv7();
    await pool("owner").query(
      "insert into pay_run (id, workspace_id, period_start, period_end) values ($1, $2, '2026-10-05', '2026-10-11')",
      [payRun, a.workspaceId],
    );
    const id = await makeLog(ids, payRun);
    const error = await pgError(pool("owner").query("delete from pay_run where id = $1", [payRun]));
    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("work_log_pay_run_fk");
    expect((await logRow(id))?.pay_run_id).toBe(payRun);
  });

  it("deleting a locked log that an adjustment points at raises RF001 before the self-FK check", async () => {
    const locked = await makeLog(ids, ids.pay_run);
    await makeLog(ids, null, locked);
    expect(await pgError(pool("owner").query("delete from work_log where id = $1", [locked]))).toEqual(
      LOCKED,
    );
  });
});

describe("the catalogue", () => {
  it("one BEFORE INSERT OR UPDATE OR DELETE row trigger on work_log runs the guard, and no other table has it", async () => {
    const triggers = await rows<{ table: string; name: string; tgtype: number; enabled: string }>(
      "owner",
      `select c.relname as table, t.tgname as name, t.tgtype, t.tgenabled as enabled
         from pg_trigger t join pg_class c on c.oid = t.tgrelid
        where t.tgfoid = 'public.locked_log_guard()'::regprocedure and not t.tgisinternal`,
    );
    // ROW (1) + BEFORE (2) + INSERT (4) + DELETE (8) + UPDATE (16); not TRUNCATE (32) or INSTEAD (64).
    expect(triggers).toEqual([{ table: "work_log", name: "work_log_locked", tgtype: 31, enabled: "O" }]);
  });

  it("the guard is SECURITY INVOKER, owned by roofy, with search_path pinned and no execute for anyone else", async () => {
    const [fn] = await rows(
      "owner",
      `select p.prosecdef as definer, pg_get_userbyid(p.proowner) as owner, p.proconfig as config, p.proacl::text[] as acl,
              has_function_privilege('roofy_app', p.oid, 'EXECUTE') as app,
              has_function_privilege('roofy_auth', p.oid, 'EXECUTE') as auth
         from pg_proc p where p.oid = 'public.locked_log_guard()'::regprocedure`,
    );
    expect(fn).toEqual({
      definer: false,
      owner: "roofy",
      config: ["search_path=pg_catalog, public, pg_temp"],
      acl: ["roofy=X/roofy"],
      app: false,
      auth: false,
    });
  });
});
