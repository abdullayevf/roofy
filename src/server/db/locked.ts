import { sql } from "drizzle-orm";
import type { Tx } from "./with-actor";

const resetFlag = (tx: Tx) => tx.execute(sql`select set_config('app.locked_write', '', true)`);

/**
 * Runs `fn` with the locked-log guard lifted (migration 0005): inside it, a `work_log` may be locked
 * (pay_run_id set), unlocked, or a locked one changed or deleted. The flag is set transaction-local
 * (`set_config(..., true)`, like withActor) and reset to '' as soon as `fn` settles, so later
 * statements in the same transaction are guarded again. Only the Phase 7 approve and reopen
 * service calls this; `locked.test.ts` checks that no other source file names the flag.
 */
export async function withLockedWrite<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  await tx.execute(sql`select set_config('app.locked_write', 'on', true)`);
  let result: T;
  try {
    result = await fn();
  } catch (error) {
    // A database error in fn aborts the transaction, so the reset fails too. Nothing leaks then:
    // the flag is transaction-local and goes with the rollback. Rethrow fn's error, not the reset's.
    await resetFlag(tx).catch(() => undefined);
    throw error;
  }
  await resetFlag(tx);
  return result;
}
