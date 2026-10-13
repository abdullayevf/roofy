import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DbRole = "app" | "auth" | "owner";

/** The env var that holds each role's connection URL. */
export const ROLE_ENV: Record<DbRole, string> = {
  app: "DATABASE_URL",
  auth: "AUTH_DATABASE_URL",
  owner: "MIGRATE_DATABASE_URL",
};

export type Db = NodePgDatabase<typeof schema>;

const pools = new Map<DbRole, Pool>();

/** The pool for a role, created on first use. Throws a plain error if its env var is missing. */
export function pool(role: DbRole): Pool {
  const existing = pools.get(role);
  if (existing) return existing;
  const name = ROLE_ENV[role];
  const connectionString = process.env[name];
  if (!connectionString) {
    throw new Error(`${name} is not set. Add it to .env (see .env.example).`);
  }
  const created = new Pool({ connectionString, max: role === "owner" ? 2 : 10 });
  pools.set(role, created);
  return created;
}

/** Ends every open pool. Tests call this in afterAll. */
export async function closePools(): Promise<void> {
  const open = [...pools.values()];
  pools.clear();
  await Promise.all(open.map((p) => p.end()));
}

// Importing this module never reads env or opens a connection: the drizzle handle is built on
// first property access.
function lazyDb(role: "app" | "auth"): Db {
  let instance: Db | undefined;
  const get = () => (instance ??= drizzle(pool(role), { schema }));
  return new Proxy({} as Db, {
    get(_target, prop) {
      const value = Reflect.get(get(), prop);
      return typeof value === "function" ? value.bind(get()) : value;
    },
  });
}

/** Serves every service query, as `roofy_app`. */
export const db: Db = lazyDb("app");
/** Serves only Better Auth, as `roofy_auth`. */
export const authDb: Db = lazyDb("auth");
