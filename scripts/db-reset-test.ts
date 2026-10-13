import { acquireTestLock, ensureRoles, resetTestDatabase } from "../src/server/db/admin";
import { applyTestEnv, requireEnv } from "../src/server/db/env";

// Drops and re-migrates roofy_test, then sets the role passwords. Waits if a test run holds the lock.
async function main(): Promise<void> {
  applyTestEnv();
  const ownerUrl = requireEnv("TEST_MIGRATE_DATABASE_URL");
  const release = await acquireTestLock(ownerUrl);
  try {
    await resetTestDatabase(ownerUrl);
    await ensureRoles(ownerUrl, {
      app: requireEnv("ROOFY_APP_DB_PASSWORD"),
      auth: requireEnv("ROOFY_AUTH_DB_PASSWORD"),
    });
  } finally {
    await release();
  }
}

main().then(
  () => console.log("Test database is reset and migrated."),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
