import type { Pool } from "pg";
import { closePools, pool, type DbRole } from "../../src/server/db/client";

export { closePools, pool, type DbRole };

/** Runs a query as the given role and returns the rows. */
export async function rows<T extends object = Record<string, unknown>>(
  role: DbRole,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await (pool(role) as Pool).query<T>(sql, params);
  return result.rows;
}
