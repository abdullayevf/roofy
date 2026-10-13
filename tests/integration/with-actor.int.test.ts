// withActor: one transaction on the roofy_app pool with app.workspace_id, app.user_id and app.role
// set LOCAL, so a pooled connection reused afterwards carries no actor and sees no tenant rows.
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/data/contracts";
import { TENANT_TABLES } from "@/server/db/tenancy";
import { withActor } from "@/server/db/with-actor";
import { closePools, pool, rows, SEED, seedOnly, seedWorkspace } from "./helpers";

let actor: Actor;
let other: Actor;

// Both workspaces get one row in every tenant table, so "sees 0 rows" below is not vacuous
// whatever order the integration files run in.
beforeAll(async () => {
  actor = { ...(await seedWorkspace("Echo Roofing")), role: "manager" };
  other = await seedWorkspace("Foxtrot Roofing");
});

const sorted = (list: readonly string[]) => [...list].sort();
const keyOf = (table: string) => (table === "workspace" ? "id" : "workspace_id");

/** Rows per tenant table for one workspace, read through the owner pool (no RLS). */
async function seededCounts(workspaceId: string) {
  const counts: Record<string, number> = {};
  for (const table of TENANT_TABLES) {
    const [r] = await rows<{ n: number }>(
      "owner",
      `select count(*)::int as n from "${table}" where ${keyOf(table)} = $1${seedOnly(table)}`,
      [workspaceId],
    );
    counts[table] = r!.n;
  }
  return counts;
}

afterAll(async () => {
  await closePools();
});

/** Runs a withActor transaction that records its backend pid, then checks out the pool's next
 * client (pg-pool hands back the most recently released one) and returns what it sees. */
async function nextClientAfter(run: (pid: (n: number) => void) => Promise<unknown>) {
  let pid = 0;
  await run((n) => (pid = n)).catch(() => undefined);
  const client = await pool("app").connect();
  try {
    const [state] = (
      await client.query<{ pid: number; ws: string | null; user_id: string | null; role: string | null }>(
        `select pg_backend_pid() as pid, current_setting('app.workspace_id', true) as ws,
           current_setting('app.user_id', true) as user_id, current_setting('app.role', true) as role`,
      )
    ).rows;
    const counts: Record<string, number> = {};
    for (const table of TENANT_TABLES) {
      const { rows: r } = await client.query<{ n: number }>(`select count(*)::int as n from "${table}"`);
      counts[table] = r[0]!.n;
    }
    return { pid, state: state!, counts };
  } finally {
    client.release();
  }
}

const zeroCounts = () => Object.fromEntries(TENANT_TABLES.map((t) => [t, 0]));

describe("withActor", () => {
  it("has one seeded row in every tenant table for both workspaces", async () => {
    expect(sorted(Object.keys(SEED))).toEqual(sorted(TENANT_TABLES));
    const ones = Object.fromEntries(TENANT_TABLES.map((t) => [t, 1]));
    expect(await seededCounts(actor.workspaceId)).toEqual(ones);
    expect(await seededCounts(other.workspaceId)).toEqual(ones);
  });

  it("runs as roofy_app with the actor's workspace, user and role set, and returns fn's value", async () => {
    const seen = await withActor(actor, async (tx) => {
      const { rows: r } = await tx.execute<{ who: string; ws: string; user_id: string; role: string }>(
        sql`select current_user as who, current_setting('app.workspace_id') as ws,
              current_setting('app.user_id') as user_id, current_setting('app.role') as role`,
      );
      return r[0];
    });
    expect(seen).toEqual({ who: "roofy_app", ws: actor.workspaceId, user_id: actor.userId, role: "manager" });
  });

  it("sees its own workspace and members", async () => {
    const ids = await withActor(
      actor,
      async (tx) => (await tx.execute<{ id: string }>(sql`select id from workspace`)).rows,
    );
    expect(ids).toEqual([{ id: actor.workspaceId }]);
    const members = await withActor(actor, async (tx) => (await tx.execute(sql`select 1 from member`)).rows);
    expect(members).toHaveLength(1);
  });

  it("rolls everything back when fn throws", async () => {
    const id = uuidv7();
    await expect(
      withActor(actor, async (tx) => {
        await tx.execute(
          sql`insert into client (id, workspace_id, name) values (${id}, ${actor.workspaceId}, 'Gone')`,
        );
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect(await rows("owner", "select 1 from client where id = $1", [id])).toEqual([]);
  });

  it("concurrent transactions for two actors each see only their own workspace", async () => {
    const seenBy = (who: Actor) =>
      withActor(who, async (tx) => {
        await tx.execute(sql`select pg_sleep(0.005)`);
        const keys = new Set<string>();
        for (const table of TENANT_TABLES) {
          const t = sql.identifier(table);
          const key = sql.identifier(keyOf(table));
          const { rows: r } = await tx.execute<{ k: string }>(sql`select distinct ${key} as k from ${t}`);
          r.forEach((row) => keys.add(row.k));
        }
        return [...keys];
      });
    const runs = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? actor : other));
    const seen = await Promise.all(runs.map(seenBy));
    seen.forEach((keys, i) => expect(keys).toEqual([runs[i]!.workspaceId]));
  });

  it("leaves a pooled connection with no actor and no tenant rows after it commits", async () => {
    const after = await nextClientAfter((pid) =>
      withActor(actor, async (tx) => {
        pid((await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid);
      }),
    );
    expect(after.state.pid).toBe(after.pid);
    expect([after.state.ws, after.state.user_id, after.state.role].every((v) => !v)).toBe(true);
    expect(after.counts).toEqual(zeroCounts());
  });

  it("leaves a pooled connection with no actor and no tenant rows after it rolls back", async () => {
    const after = await nextClientAfter((pid) =>
      withActor(actor, async (tx) => {
        pid((await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid);
        throw new Error("stop");
      }),
    );
    expect(after.state.pid).toBe(after.pid);
    expect([after.state.ws, after.state.user_id, after.state.role].every((v) => !v)).toBe(true);
    expect(after.counts).toEqual(zeroCounts());
  });
});
