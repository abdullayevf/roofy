/**
 * Runs once when a Next.js server instance starts, before it handles requests (Next's
 * `instrumentation.ts` `register` hook). With `ROOFY_DATA=db` on the Node.js runtime it registers the
 * database data layer; the import is dynamic so the edge runtime and the fake mode never load
 * Postgres or Better Auth.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.ROOFY_DATA !== "db") return;
  const [{ registerDbData }, { dbDataProvider }] = await Promise.all([import("@/data/db-registry"), import("@/server/data")]);
  registerDbData(dbDataProvider);
}
