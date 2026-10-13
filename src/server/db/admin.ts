import { existsSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { databaseName, TEST_DATABASE_NAME } from "./env";

export const MIGRATIONS_FOLDER = join(process.cwd(), "src/server/db/migrations");

async function withOwner<T>(ownerUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Advisory-lock key that serialises everything that resets or migrates `roofy_test`. */
export const TEST_LOCK_KEY = "roofy:test-database";

type RoleClient = Pick<Client, "query" | "escapeLiteral" | "escapeIdentifier">;

const ROLE_NAME = /^[a-z_][a-z0-9_]*$/;

/**
 * Creates the role NOLOGIN if it is missing, then sets LOGIN and the password. Safe to repeat,
 * and safe against a concurrent create (duplicate_object and unique_violation are swallowed).
 * Compatible with the Task 4 migration, which creates the same roles NOLOGIN if missing.
 */
export async function ensureRole(client: RoleClient, role: string, password: string): Promise<void> {
  if (!ROLE_NAME.test(role)) throw new Error(`"${role}" is not a plain role name.`);
  const id = client.escapeIdentifier(role);
  await client.query(`do $$ begin
    create role ${id} nologin;
  exception when duplicate_object or unique_violation then null;
  end $$`);
  await client.query(
    `alter role ${id} login nosuperuser nocreatedb nocreaterole nobypassrls password ${client.escapeLiteral(password)}`,
  );
}

/** Sets up `roofy_app` and `roofy_auth` with LOGIN and their passwords. */
export async function ensureRoles(ownerUrl: string, passwords: { app: string; auth: string }): Promise<void> {
  await withOwner(ownerUrl, async (client) => {
    await ensureRole(client, "roofy_app", passwords.app);
    await ensureRole(client, "roofy_auth", passwords.auth);
  });
}

/**
 * Takes the test-database advisory lock on its own connection and returns a function that
 * releases it. A second run waits here instead of dropping tables under the first. The lock is
 * per session, so it also frees itself if the holder dies.
 */
export async function acquireTestLock(ownerUrl: string): Promise<() => Promise<void>> {
  const client = new Client({ connectionString: ownerUrl, connectionTimeoutMillis: 3000 });
  client.on("error", () => undefined);
  await client.connect();
  try {
    await client.query("select pg_advisory_lock(hashtext($1))", [TEST_LOCK_KEY]);
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
  return async () => {
    try {
      await client.query("select pg_advisory_unlock(hashtext($1))", [TEST_LOCK_KEY]);
    } finally {
      await client.end();
    }
  };
}

/** The message for a failed first connection: the db:up hint only when nothing is listening. */
export function describeConnectError(error: unknown, url: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || /timeout/i.test(message)) {
    const { hostname, port } = new URL(url);
    return `Test database not reachable on ${hostname}:${port || 5432}. Run pnpm db:up.`;
  }
  return `Test database check failed: ${message}`;
}

/**
 * Drops and recreates the `public` schema of `roofy_test` (and the migration journal schema),
 * then runs the migrations as the owner. With no migrations yet it only resets. Refuses any URL
 * not naming `roofy_test`, and any connection whose `current_database()` is not `roofy_test`,
 * before the first drop.
 */
export async function resetTestDatabase(ownerUrl: string): Promise<void> {
  const name = databaseName(ownerUrl);
  if (name !== TEST_DATABASE_NAME) {
    throw new Error(`Refusing to reset "${name}": only ${TEST_DATABASE_NAME} can be reset.`);
  }
  await withOwner(ownerUrl, async (client) => {
    const { rows } = await client.query<{ db: string }>("select current_database() as db");
    const connected = rows[0]?.db;
    if (connected !== TEST_DATABASE_NAME) {
      throw new Error(`Refusing to reset: connected to "${connected}", not ${TEST_DATABASE_NAME}.`);
    }
    await client.query("drop schema if exists drizzle cascade");
    await client.query("drop schema if exists public cascade");
    await client.query("create schema public");
    // A fresh initdb database grants this to PUBLIC; recreating the schema drops it.
    await client.query("grant usage on schema public to public");
    if (existsSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"))) {
      await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    }
  });
}
