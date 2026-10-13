import { Client } from "pg";
import { ensureRoles, resetTestDatabase } from "../../src/server/db/admin";
import { applyTestEnv, requireEnv } from "../../src/server/db/env";

// Runs once per `vitest run`: drops and re-migrates roofy_test, then sets the role passwords.
// applyTestEnv also points DATABASE_URL and friends at roofy_test; the test workers inherit that.
export default async function setup(): Promise<void> {
  applyTestEnv();
  const ownerUrl = requireEnv("TEST_MIGRATE_DATABASE_URL");
  const probe = new Client({ connectionString: ownerUrl, connectionTimeoutMillis: 3000 });
  try {
    await probe.connect();
  } catch {
    throw new Error("Test database not reachable on 127.0.0.1:5440. Run pnpm db:up.");
  } finally {
    await probe.end().catch(() => undefined);
  }
  await resetTestDatabase(ownerUrl);
  await ensureRoles(ownerUrl, {
    app: requireEnv("ROOFY_APP_DB_PASSWORD"),
    auth: requireEnv("ROOFY_AUTH_DB_PASSWORD"),
  });
}
