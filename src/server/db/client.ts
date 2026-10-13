import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";
import * as schema from "./schema";

export type DbRole = "app" | "auth" | "owner";

/** The env var that holds each role's connection URL. */
export const ROLE_ENV: Record<DbRole, string> = {
  app: "DATABASE_URL",
  auth: "AUTH_DATABASE_URL",
  owner: "MIGRATE_DATABASE_URL",
};

export type Db = NodePgDatabase<typeof schema>;

// Pools live on globalThis so a Next dev hot reload, which re-evaluates this module, reuses them
// instead of leaking the old ones.
const globalPools = globalThis as { __roofyPools?: Map<DbRole, Pool> };
const pools = (globalPools.__roofyPools ??= new Map<DbRole, Pool>());

const DATE_OID = 1082;

/** `date` columns come back as the `YYYY-MM-DD` string Postgres sent, never a JS Date at local
 * midnight (which shifts a day in a UTC+14 process). Drizzle already does this for its own
 * queries; this covers raw `pool(...).query` too. */
const poolTypes = {
  getTypeParser: ((oid: number, format?: "text") =>
    oid === DATE_OID
      ? (value: string) => value
      : types.getTypeParser(oid, format)) as typeof types.getTypeParser,
};

/** The pool for a role, created on first use. Throws a plain error if its env var is missing. */
export function pool(role: DbRole): Pool {
  const existing = pools.get(role);
  if (existing) return existing;
  const name = ROLE_ENV[role];
  const connectionString = process.env[name];
  if (!connectionString) {
    throw new Error(`${name} is not set. Add it to .env (see .env.example).`);
  }
  const created = new Pool({ connectionString, types: poolTypes, max: role === "owner" ? 2 : 10 });
  // An idle client dying (Postgres restarts, `pnpm db:down`) emits "error"; with no listener
  // Node would treat it as uncaught and exit.
  created.on("error", (error) => console.error(`${role} pool: ${error.message}`));
  pools.set(role, created);
  return created;
}

/** Ends every open pool. Tests call this in afterAll. */
export async function closePools(): Promise<void> {
  const open = [...pools.values()];
  pools.clear();
  await Promise.all(open.map((p) => p.end()));
}

// Importing this module never reads env or opens a connection: a drizzle handle is built when
// getDb or getAuthDb is first called, and rebuilt if its pool was closed since.
const handles = new Map<"app" | "auth", { pool: Pool; db: Db }>();

function handle(role: "app" | "auth"): Db {
  const current = pool(role);
  const cached = handles.get(role);
  if (cached?.pool === current) return cached.db;
  const db = drizzle(current, { schema });
  handles.set(role, { pool: current, db });
  return db;
}

/** Serves every service query, as `roofy_app`. A real drizzle instance. */
export function getDb(): Db {
  return handle("app");
}

/** Serves only Better Auth, as `roofy_auth`. A real drizzle instance. */
export function getAuthDb(): Db {
  return handle("auth");
}
