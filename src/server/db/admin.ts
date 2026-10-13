import { existsSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { databaseName } from "./env";

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

/**
 * Creates `roofy_app` and `roofy_auth` NOLOGIN if they are missing, then sets LOGIN and the
 * passwords. Safe to run repeatedly, and compatible with the Task 4 migration that creates the
 * same roles NOLOGIN if missing.
 */
export async function ensureRoles(
  ownerUrl: string,
  passwords: { app: string; auth: string },
): Promise<void> {
  await withOwner(ownerUrl, async (client) => {
    for (const [role, password] of [
      ["roofy_app", passwords.app],
      ["roofy_auth", passwords.auth],
    ] as const) {
      await client.query(`do $$ begin
        if not exists (select from pg_roles where rolname = '${role}') then
          create role ${role} nologin;
        end if;
      end $$`);
      await client.query(
        `alter role ${role} login nosuperuser nocreatedb nocreaterole nobypassrls password ${client.escapeLiteral(password)}`,
      );
    }
  });
}

/**
 * Drops and recreates the `public` schema of a test database (and the migration journal
 * schema), then runs the migrations as the owner. With no migrations yet it only resets.
 * Refuses any database whose name does not end in `_test`.
 */
export async function resetTestDatabase(ownerUrl: string): Promise<void> {
  const name = databaseName(ownerUrl);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": only databases ending in _test can be reset.`);
  }
  await withOwner(ownerUrl, async (client) => {
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
