import { PgDatabase } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakePool = {
  options: {
    connectionString: string;
    max: number;
    types: { getTypeParser: (oid: number) => (value: string) => unknown };
  };
  handlers: Map<string, (error: Error) => void>;
  ended: boolean;
};

// Replaces pg's Pool so these tests can see when a pool is created, without a database.
const state = vi.hoisted(() => ({ pools: [] as FakePool[] }));
vi.mock("pg", () => ({
  types: { getTypeParser: () => (value: string) => `parsed ${value}` },
  Pool: class {
    handlers = new Map<string, (error: Error) => void>();
    ended = false;
    constructor(public options: unknown) {
      state.pools.push(this as unknown as FakePool);
    }
    on(event: string, handler: (error: Error) => void) {
      this.handlers.set(event, handler);
      return this;
    }
    async end() {
      this.ended = true;
    }
  },
}));

import { closePools, getAuthDb, getDb, pool } from "./client";

beforeEach(() => {
  state.pools.length = 0;
  vi.stubEnv("DATABASE_URL", "postgres://app@127.0.0.1:5440/roofy_test");
  vi.stubEnv("AUTH_DATABASE_URL", "postgres://auth@127.0.0.1:5440/roofy_test");
  vi.stubEnv("MIGRATE_DATABASE_URL", "postgres://owner@127.0.0.1:5440/roofy_test");
});

afterEach(async () => {
  await closePools();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("pool", () => {
  it.each([
    ["app", "DATABASE_URL"],
    ["auth", "AUTH_DATABASE_URL"],
    ["owner", "MIGRATE_DATABASE_URL"],
  ] as const)("names %s's missing variable %s in the error", (role, name) => {
    vi.stubEnv(name, "");
    expect(() => pool(role)).toThrow(`${name} is not set`);
    expect(state.pools).toHaveLength(0);
  });

  it("opens no pool when the module is imported", async () => {
    vi.resetModules();
    state.pools.length = 0;
    await import("./client");
    expect(state.pools).toHaveLength(0);
  });

  it("creates a pool on first use and reuses it", () => {
    const first = pool("app");
    expect(pool("app")).toBe(first);
    expect(state.pools).toHaveLength(1);
    expect(state.pools[0]?.options).toMatchObject({
      connectionString: "postgres://app@127.0.0.1:5440/roofy_test",
      max: 10,
    });
    // date (OID 1082) stays the raw YYYY-MM-DD string; every other type keeps pg's parser.
    const parser = state.pools[0]!.options.types.getTypeParser;
    expect(parser(1082)("2026-09-28")).toBe("2026-09-28");
    expect(parser(1114)("2026-09-28 10:00")).toBe("parsed 2026-09-28 10:00");
    pool("owner");
    expect(state.pools[1]?.options.max).toBe(2);
  });

  it("logs an idle-client error instead of letting it crash the process", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    pool("auth");
    const handler = state.pools[0]?.handlers.get("error");
    expect(handler).toBeTypeOf("function");
    expect(() => handler?.(new Error("terminating connection"))).not.toThrow();
    expect(log).toHaveBeenCalledWith("auth pool: terminating connection");
  });

  it("keeps its pools across a module reload, as in Next dev hot reload", async () => {
    const first = pool("app");
    vi.resetModules();
    const reloaded = await import("./client");
    expect(reloaded.pool("app")).toBe(first);
    expect(state.pools).toHaveLength(1);
  });

  it("opens a fresh pool after closePools", async () => {
    const first = pool("app");
    await closePools();
    expect(state.pools[0]?.ended).toBe(true);
    expect(pool("app")).not.toBe(first);
  });
});

describe("getDb and getAuthDb", () => {
  it("return real drizzle instances, one per role, built on first call", () => {
    expect(state.pools).toHaveLength(0);
    const app = getDb();
    const auth = getAuthDb();
    expect(app).toBeInstanceOf(PgDatabase);
    expect(auth).toBeInstanceOf(PgDatabase);
    expect(app).not.toBe(auth);
    expect(getDb()).toBe(app);
    expect(state.pools.map((p) => p.options.connectionString)).toEqual([
      "postgres://app@127.0.0.1:5440/roofy_test",
      "postgres://auth@127.0.0.1:5440/roofy_test",
    ]);
  });

  it("throws the plain missing-variable error", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => getDb()).toThrow("DATABASE_URL is not set");
  });

  it("rebuilds the handle after closePools instead of keeping a closed pool", async () => {
    const before = getDb();
    await closePools();
    expect(getDb()).not.toBe(before);
  });
});
