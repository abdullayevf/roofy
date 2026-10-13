import {
  acquireTestLock,
  describeConnectError,
  ensureRoles,
  resetTestDatabase,
} from "../../src/server/db/admin";
import { applyTestEnv, requireEnv } from "../../src/server/db/env";

// Runs once per `vitest run`: takes the test-database lock (a second run waits for it), drops and
// re-migrates roofy_test, then sets the role passwords. The returned function is the teardown and
// releases the lock. applyTestEnv also points DATABASE_URL and friends at roofy_test; the test
// workers inherit that.
export default async function setup(): Promise<() => Promise<void>> {
  applyTestEnv();
  const ownerUrl = requireEnv("TEST_MIGRATE_DATABASE_URL");
  let release: () => Promise<void>;
  try {
    release = await acquireTestLock(ownerUrl);
  } catch (error) {
    throw new Error(describeConnectError(error, ownerUrl));
  }
  try {
    await resetTestDatabase(ownerUrl);
    await ensureRoles(ownerUrl, {
      app: requireEnv("ROOFY_APP_DB_PASSWORD"),
      auth: requireEnv("ROOFY_AUTH_DB_PASSWORD"),
    });
  } catch (error) {
    await release();
    throw error;
  }
  return release;
}
