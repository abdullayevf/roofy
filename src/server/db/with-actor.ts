import { sql } from "drizzle-orm";
import type { Actor } from "@/data/contracts";
import { getDb, type Db } from "./client";

/** The transaction handle `withActor` passes to its callback. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Runs `fn` in one transaction on the `roofy_app` pool, as `actor`. It first sets
 * `app.workspace_id`, then `app.user_id` and `app.role`, all transaction-local
 * (`set_config(..., true)`, the same as SET LOCAL), so row-level security sees only the actor's
 * workspace and the pooled connection carries nothing once the transaction ends, commit or not.
 * Every service query runs through here.
 */
export async function withActor<T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.workspace_id', ${actor.workspaceId}, true),
      set_config('app.user_id', ${actor.userId}, true), set_config('app.role', ${actor.role}, true)`);
    return fn(tx);
  });
}
