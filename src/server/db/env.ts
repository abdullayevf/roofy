import { existsSync } from "node:fs";

// Dev-only values from ops/compose.dev.yml and .env.example. Used for the test database
// when .env is absent (a fresh clone), so `pnpm test:integration` works after `pnpm db:up`.
const TEST_DEFAULTS: Record<string, string> = {
  TEST_DATABASE_URL: "postgres://roofy_app:roofy_app_dev_pw@127.0.0.1:5440/roofy_test",
  TEST_AUTH_DATABASE_URL: "postgres://roofy_auth:roofy_auth_dev_pw@127.0.0.1:5440/roofy_test",
  TEST_MIGRATE_DATABASE_URL: "postgres://roofy:roofy_dev_pw@127.0.0.1:5440/roofy_test",
  ROOFY_APP_DB_PASSWORD: "roofy_app_dev_pw",
  ROOFY_AUTH_DB_PASSWORD: "roofy_auth_dev_pw",
};

/** Loads `.env` into process.env when it exists. Values already set in the environment win. */
export function loadDotEnv(path = ".env"): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

/** Reads a required variable, or throws a plain error naming it. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env (see .env.example).`);
  return value;
}

/** The database name in a Postgres connection URL. */
export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/**
 * Loads `.env`, fills the dev defaults for the test database, and points the app-facing
 * variables (DATABASE_URL, AUTH_DATABASE_URL, MIGRATE_DATABASE_URL) at the test database,
 * so code that reads them (the pools in client.ts) never touches the dev database.
 * Refuses any test URL whose database name does not end in `_test`.
 */
export function applyTestEnv(): void {
  loadDotEnv();
  for (const [name, value] of Object.entries(TEST_DEFAULTS)) {
    if (!process.env[name]) process.env[name] = value;
  }
  const pairs = [
    ["TEST_DATABASE_URL", "DATABASE_URL"],
    ["TEST_AUTH_DATABASE_URL", "AUTH_DATABASE_URL"],
    ["TEST_MIGRATE_DATABASE_URL", "MIGRATE_DATABASE_URL"],
  ] as const;
  for (const [testName, name] of pairs) {
    const url = requireEnv(testName);
    if (!databaseName(url).endsWith("_test")) {
      throw new Error(`${testName} must point at a database whose name ends in _test.`);
    }
    process.env[name] = url;
  }
}
