import { existsSync } from "node:fs";

/** The only database the test tooling may reset or point the app pools at. */
export const TEST_DATABASE_NAME = "roofy_test";

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
 * Loads `.env` and points the app-facing variables (DATABASE_URL, AUTH_DATABASE_URL,
 * MIGRATE_DATABASE_URL) at the TEST_* URLs, so code that reads them (the pools in client.ts)
 * never touches the dev database. Every TEST_* URL must name `roofy_test`; otherwise nothing
 * is changed. There are no built-in fallbacks: copy `.env.example` to `.env`.
 */
export function applyTestEnv(): void {
  loadDotEnv();
  const pairs = [
    ["TEST_DATABASE_URL", "DATABASE_URL"],
    ["TEST_AUTH_DATABASE_URL", "AUTH_DATABASE_URL"],
    ["TEST_MIGRATE_DATABASE_URL", "MIGRATE_DATABASE_URL"],
  ] as const;
  const urls = pairs.map(([testName]) => {
    const url = requireEnv(testName);
    if (databaseName(url) !== TEST_DATABASE_NAME) {
      throw new Error(`${testName} must point at the database ${TEST_DATABASE_NAME}.`);
    }
    return url;
  });
  pairs.forEach(([, name], i) => {
    process.env[name] = urls[i];
  });
}
