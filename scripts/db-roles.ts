import { ensureRoles } from "../src/server/db/admin";
import { loadDotEnv, requireEnv } from "../src/server/db/env";

// Sets LOGIN and passwords for roofy_app and roofy_auth on the database in MIGRATE_DATABASE_URL.
loadDotEnv();
ensureRoles(requireEnv("MIGRATE_DATABASE_URL"), {
  app: requireEnv("ROOFY_APP_DB_PASSWORD"),
  auth: requireEnv("ROOFY_AUTH_DB_PASSWORD"),
}).then(
  () => console.log("Database roles are ready."),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
