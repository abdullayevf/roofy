import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/** An environment as Playwright and the specs pass it around: names to values. */
export type EnvSource = Record<string, string | undefined>;

/**
 * The db-mode e2e environment: one dedicated database (`roofy_e2e`), a server on port 3101, and a mail log the
 * specs read links from. Shared by playwright.config.ts, scripts/db-reset-e2e.ts, scripts/e2e-db-server.ts and the
 * specs, so the server, the reset and the tests can never disagree. Imports nothing from `@/server`.
 */
export const E2E_DB_NAME = "roofy_e2e";
export const E2E_PORT = 3101;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
/** Fixed, test-only; the server and nothing else reads it. */
export const E2E_AUTH_SECRET = "roofy-e2e-db-secret-not-for-production-0123456789";

/**
 * The shell's environment over `.env`, as a copy: nothing is written into process.env, so a Playwright worker never
 * inherits the dev DATABASE_URL and the like. The shell wins, as it does for `loadDotEnv`.
 */
export function dotEnvSource(path = ".env"): EnvSource {
  const file = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
  return { ...file, ...process.env };
}

/** Absolute path of the JSONL the console mailer appends to (src/server/email/console.ts). */
export function mailLogPath(cwd = process.cwd()): string {
  return resolve(cwd, ".superpowers/run/mail.jsonl");
}

/** The same Postgres URL pointed at another database. */
export function withDatabase(url: string, name: string): string {
  const next = new URL(url);
  next.pathname = `/${encodeURIComponent(name)}`;
  return next.toString();
}

/** The database name in a Postgres URL. */
export function databaseOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

const TEST_URL_PAIRS = [
  ["TEST_DATABASE_URL", "DATABASE_URL"],
  ["TEST_AUTH_DATABASE_URL", "AUTH_DATABASE_URL"],
  ["TEST_MIGRATE_DATABASE_URL", "MIGRATE_DATABASE_URL"],
] as const;

/** The three role URLs of `.env`'s TEST_* set (host, port, role passwords) pointed at roofy_e2e. Empty when `.env` has none. */
export function e2eDatabaseUrls(source: EnvSource = dotEnvSource()): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const [from, to] of TEST_URL_PAIRS) {
    const url = source[from];
    if (url) urls[to] = withDatabase(url, E2E_DB_NAME);
  }
  return urls;
}

/** The three role URLs, all pointed at roofy_e2e, or a thrown error naming what is missing. Isolation fails closed. */
export function requireE2eDatabaseUrls(source: EnvSource = dotEnvSource()): Record<string, string> {
  const urls = e2eDatabaseUrls(source);
  const missing = TEST_URL_PAIRS.filter(([, to]) => !urls[to]).map(([from]) => from);
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(", ")} not set. The db e2e needs all three TEST_* database URLs (see .env.example); it never falls back to the dev database.`,
    );
  }
  for (const [from, to] of TEST_URL_PAIRS) {
    const name = databaseOf(urls[to] ?? "");
    if (name !== E2E_DB_NAME) throw new Error(`${from} resolves to "${name}", not "${E2E_DB_NAME}".`);
  }
  return urls;
}

/** What the db-mode server needs to run, on top of the shell's environment. Throws unless all three database URLs point at roofy_e2e. */
export function e2eServerEnv(source: EnvSource = dotEnvSource(), cwd = process.cwd()): Record<string, string> {
  return {
    ROOFY_DATA: "db",
    ROOFY_MAIL: "console",
    ROOFY_MAIL_LOG: mailLogPath(cwd),
    BETTER_AUTH_URL: E2E_BASE_URL,
    BETTER_AUTH_SECRET: E2E_AUTH_SECRET,
    ...requireE2eDatabaseUrls(source),
  };
}
