import type { Pool } from "pg";
import { v7 as uuidv7 } from "uuid";
import type { Actor } from "../../src/data/contracts";
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

/**
 * Makes a workspace with one Owner (a user plus an owner member) through the owner pool, which
 * is a superuser and so is not held back by row-level security. Ids are app-made uuid v7.
 */
export async function makeWorkspace(
  name = "Test Roofing",
): Promise<{ workspaceId: string; ownerActor: Actor }> {
  const owner = pool("owner");
  const userId = uuidv7();
  const workspaceId = uuidv7();
  const ownerName = `${name} owner`;
  await owner.query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [
    userId,
    ownerName,
    `owner-${userId}@example.test`,
  ]);
  await owner.query(`insert into workspace (id, name, timezone) values ($1, $2, 'Australia/Sydney')`, [
    workspaceId,
    name,
  ]);
  await owner.query(`insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, 'owner')`, [
    uuidv7(),
    workspaceId,
    userId,
  ]);
  return { workspaceId, ownerActor: { userId, workspaceId, role: "owner", name: ownerName } };
}
