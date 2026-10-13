import { ensureRoles, resetTestDatabase } from "../src/server/db/admin";
import { applyTestEnv, requireEnv } from "../src/server/db/env";

// Drops and re-migrates roofy_test, then sets the role passwords.
applyTestEnv();
const ownerUrl = requireEnv("TEST_MIGRATE_DATABASE_URL");
resetTestDatabase(ownerUrl)
  .then(() =>
    ensureRoles(ownerUrl, {
      app: requireEnv("ROOFY_APP_DB_PASSWORD"),
      auth: requireEnv("ROOFY_AUTH_DB_PASSWORD"),
    }),
  )
  .then(
    () => console.log("Test database is reset and migrated."),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
