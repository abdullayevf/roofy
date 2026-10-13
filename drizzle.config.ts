import { defineConfig } from "drizzle-kit";
import { loadDotEnv, requireEnv } from "./src/server/db/env";

loadDotEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./src/server/db/migrations",
  dbCredentials: { url: requireEnv("MIGRATE_DATABASE_URL") },
});
