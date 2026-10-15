/**
 * Which Playwright projects a run selects, read from its command line. The db-* projects are only added to the
 * config when asked for, so a plain `playwright test` (fake projects) never needs Postgres or the 3101 server.
 */
export const DB_PROJECT = /^db-/;

/** The project names given as `--project=a`, `--project a` or `--project=a,b`. */
export function projectArgs(argv: readonly string[]): string[] {
  const names: string[] = [];
  argv.forEach((arg, i) => {
    const value = arg.startsWith("--project=") ? arg.slice("--project=".length) : arg === "--project" ? argv[i + 1] : undefined;
    if (value) names.push(...value.split(",").filter(Boolean));
  });
  return names;
}

export interface Selection {
  /** Add the db-* projects and the 3101 server. */
  db: boolean;
  /** Keep the 3100 fake server: any run that is not db-only (which includes a run with no --project). */
  fake: boolean;
}

/** `ROOFY_DB_PROJECTS=1` is how the main process tells its workers (which do not see the flags) that the db projects exist. */
export function selection(argv: readonly string[], env: Record<string, string | undefined> = process.env): Selection {
  const names = projectArgs(argv);
  const db = env.ROOFY_DB_PROJECTS === "1" || names.some((n) => DB_PROJECT.test(n));
  const fake = names.length === 0 || names.some((n) => !DB_PROJECT.test(n));
  return { db, fake };
}
