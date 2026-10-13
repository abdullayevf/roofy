import { sql } from "drizzle-orm";
import type { Tx } from "./with-actor";

const setFlag = (tx: Tx) => tx.execute(sql`select set_config('app.locked_write', 'on', true)`);
const resetFlag = (tx: Tx) => tx.execute(sql`select set_config('app.locked_write', '', true)`);

/** How many withLockedWrite calls are open on each transaction. */
const depth = new WeakMap<Tx, number>();

/**
 * Runs `fn` with the locked-log guard lifted (migration 0005): inside it, a `work_log` may be inserted
 * locked, locked (pay_run_id set), unlocked, or a locked one changed or deleted. The flag is set
 * transaction-local (`set_config(..., true)`, like withActor) and reset to '' as soon as the outermost
 * call's `fn` settles, so later statements in the same transaction are guarded again. Nested calls on
 * the same transaction neither set nor reset it, so an inner call cannot turn the guard back on while
 * the outer `fn` is still running. Only the Phase 7 approve and reopen service calls this;
 * `locked.test.ts` checks that no other source file names the flag.
 */
export async function withLockedWrite<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  const open = depth.get(tx) ?? 0;
  if (open > 0) {
    depth.set(tx, open + 1);
    try {
      return await fn();
    } finally {
      depth.set(tx, open);
    }
  }
  await setFlag(tx);
  depth.set(tx, 1);
  let result: T;
  try {
    result = await fn();
  } catch (error) {
    depth.delete(tx);
    // A database error in fn aborts the transaction, so the reset fails too. Nothing leaks then:
    // the flag is transaction-local and goes with the rollback. Rethrow fn's error, not the reset's.
    await resetFlag(tx).catch(() => undefined);
    throw error;
  }
  depth.delete(tx);
  await resetFlag(tx);
  return result;
}
