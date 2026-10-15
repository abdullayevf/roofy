import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { MIGRATIONS_FOLDER, ensureRoles } from "../src/server/db/admin";
import { loadDotEnv, requireEnv } from "../src/server/db/env";
import { E2E_DB_NAME, databaseOf, e2eDatabaseUrls, mailLogPath, withDatabase } from "../tests/e2e-db/env";

async function withOwner<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Creates roofy_e2e when it is missing (what ops/dev/init.sql does for roofy_test), owned by the owner login. */
async function ensureDatabase(ownerUrl: string): Promise<void> {
  const owner = decodeURIComponent(new URL(ownerUrl).username);
  await withOwner(withDatabase(ownerUrl, "postgres"), async (client) => {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [E2E_DB_NAME]);
    if (!rowCount) await client.query(`create database ${client.escapeIdentifier(E2E_DB_NAME)} owner ${client.escapeIdentifier(owner)}`);
  });
}

/** Drops and re-migrates roofy_e2e, like resetTestDatabase does for roofy_test. Refuses any other database before the first drop. */
async function resetDatabase(ownerUrl: string): Promise<void> {
  if (databaseOf(ownerUrl) !== E2E_DB_NAME) throw new Error(`Refusing to reset "${databaseOf(ownerUrl)}": only ${E2E_DB_NAME} can be reset.`);
  await withOwner(ownerUrl, async (client) => {
    const { rows } = await client.query<{ db: string }>("select current_database() as db");
    if (rows[0]?.db !== E2E_DB_NAME) throw new Error(`Refusing to reset: connected to "${rows[0]?.db}", not ${E2E_DB_NAME}.`);
    await client.query("drop schema if exists drizzle cascade");
    await client.query("drop schema if exists public cascade");
    await client.query("create schema public");
    await client.query("grant usage on schema public to public");
    if (existsSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"))) {
      await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    }
  });
}

// Run before the db server starts: a reset under a running server drops the tables from beneath its pools.
async function main(): Promise<void> {
  loadDotEnv();
  const ownerUrl = e2eDatabaseUrls().MIGRATE_DATABASE_URL ?? requireEnv("TEST_MIGRATE_DATABASE_URL");
  await ensureDatabase(ownerUrl);
  await resetDatabase(ownerUrl);
  await ensureRoles(ownerUrl, { app: requireEnv("ROOFY_APP_DB_PASSWORD"), auth: requireEnv("ROOFY_AUTH_DB_PASSWORD") });
  // A fresh database starts with a fresh mail log.
  rmSync(mailLogPath(), { force: true });
}

main().then(
  () => console.log(`${E2E_DB_NAME} is created, reset and migrated.`),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
