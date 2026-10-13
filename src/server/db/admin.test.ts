import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeClient = {
  options: unknown;
  queries: { sql: string; params?: unknown[] }[];
  ended: boolean;
};

// Replaces pg's Client so these tests see every statement, without a database. Quoting comes
// from the real Client (escapeLiteral and escapeIdentifier need no connection).
const state = vi.hoisted(() => ({
  clients: [] as FakeClient[],
  currentDb: "roofy_test",
  failOn: "",
}));
vi.mock("pg", async () => {
  const actual = await vi.importActual<typeof import("pg")>("pg");
  const real = new actual.Client();
  return {
    Client: class {
      queries: FakeClient["queries"] = [];
      ended = false;
      constructor(public options: unknown) {
        state.clients.push(this as unknown as FakeClient);
      }
      on() {
        return this;
      }
      async connect() {}
      async end() {
        this.ended = true;
      }
      async query(sql: string, params?: unknown[]) {
        this.queries.push({ sql, params });
        if (state.failOn && sql.includes(state.failOn)) throw new Error("boom");
        return { rows: /current_database/.test(sql) ? [{ db: state.currentDb }] : [] };
      }
      escapeLiteral(value: string) {
        return real.escapeLiteral(value);
      }
      escapeIdentifier(value: string) {
        return real.escapeIdentifier(value);
      }
    },
  };
});
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));
vi.mock("drizzle-orm/node-postgres/migrator", () => ({ migrate: vi.fn() }));

import { Client } from "pg";
import { acquireTestLock, describeConnectError, ensureRole, ensureRoles, resetTestDatabase } from "./admin";

const TEST_URL = "postgres://roofy:pw@127.0.0.1:5440/roofy_test";

beforeEach(() => {
  state.clients.length = 0;
  state.currentDb = "roofy_test";
  state.failOn = "";
});

describe("resetTestDatabase", () => {
  it.each([
    ["roofy_dev", "postgres://u:p@127.0.0.1:5440/roofy_dev"],
    ["other_test", "postgres://u:p@127.0.0.1:5440/other_test"],
    ["", "postgres://u:p@127.0.0.1:5440"],
  ])("refuses the URL naming %j before connecting", async (_name, url) => {
    await expect(resetTestDatabase(url)).rejects.toThrow(/only roofy_test can be reset/);
    expect(state.clients).toHaveLength(0);
  });

  it("refuses when the connection lands on another database, before any drop", async () => {
    state.currentDb = "roofy_dev";
    await expect(resetTestDatabase(TEST_URL)).rejects.toThrow(/connected to "roofy_dev"/);
    const sql = state.clients[0]?.queries.map((q) => q.sql).join("\n");
    expect(sql).not.toMatch(/drop|create schema/i);
    expect(state.clients[0]?.ended).toBe(true);
  });

  it("confirms the database first, then drops and recreates public", async () => {
    await resetTestDatabase(TEST_URL);
    const sql = state.clients[0]?.queries.map((q) => q.sql) ?? [];
    expect(sql[0]).toMatch(/current_database/);
    expect(sql.slice(1, 5)).toEqual([
      "drop schema if exists drizzle cascade",
      "drop schema if exists public cascade",
      "create schema public",
      "grant usage on schema public to public",
    ]);
    expect(state.clients[0]?.ended).toBe(true);
  });
});

describe("ensureRole", () => {
  it("creates the role if missing, then sets login and the quoted password", async () => {
    const client = new Client();
    await ensureRole(client, "roofy_probe", "a'b\\c");
    const sql = (state.clients[0]?.queries ?? []).map((q) => q.sql);
    expect(sql[0]).toContain('create role "roofy_probe" nologin');
    expect(sql[0]).toContain("duplicate_object");
    expect(sql[1]).toBe(
      "alter role \"roofy_probe\" login nosuperuser nocreatedb nocreaterole nobypassrls password  E'a''b\\\\c'",
    );
  });

  it("issues the same statements on a second run, so it is safe to repeat", async () => {
    const client = new Client();
    await ensureRole(client, "roofy_probe", "pw");
    await ensureRole(client, "roofy_probe", "pw");
    const sql = (state.clients[0]?.queries ?? []).map((q) => q.sql);
    expect(sql).toHaveLength(4);
    expect(sql.slice(0, 2)).toEqual(sql.slice(2));
  });

  it.each(["roofy_app; drop table x", 'a"b', "Roofy", "", "x$$y"])(
    "rejects the role name %j",
    async (name) => {
      await expect(ensureRole(new Client(), name, "pw")).rejects.toThrow(/not a plain role name/);
      expect(state.clients[0]?.queries).toHaveLength(0);
    },
  );
});

describe("ensureRoles", () => {
  it("sets up roofy_app and roofy_auth with their own passwords", async () => {
    await ensureRoles(TEST_URL, { app: "one", auth: "two" });
    const sql = (state.clients[0]?.queries ?? []).map((q) => q.sql).filter((s) => /^alter/.test(s));
    expect(sql).toHaveLength(2);
    expect(sql[0]).toContain('"roofy_app"');
    expect(sql[0]).toContain("'one'");
    expect(sql[1]).toContain('"roofy_auth"');
    expect(sql[1]).toContain("'two'");
    expect(state.clients[0]?.ended).toBe(true);
  });
});

describe("acquireTestLock", () => {
  it("holds an advisory lock until released, then unlocks and disconnects", async () => {
    const release = await acquireTestLock(TEST_URL);
    const client = state.clients[0];
    expect(client?.queries[0]?.sql).toMatch(/pg_advisory_lock\(hashtext\(\$1\)\)/);
    expect(client?.ended).toBe(false);
    await release();
    expect(client?.queries[1]?.sql).toMatch(/pg_advisory_unlock\(hashtext\(\$1\)\)/);
    expect(client?.queries[1]?.params).toEqual(client?.queries[0]?.params);
    expect(client?.ended).toBe(true);
  });

  it("disconnects and rethrows when the lock query fails", async () => {
    state.failOn = "pg_advisory_lock";
    await expect(acquireTestLock(TEST_URL)).rejects.toThrow("boom");
    expect(state.clients[0]?.ended).toBe(true);
  });
});

describe("describeConnectError", () => {
  it("keeps the db:up hint, with the URL's host and port, for a refused connection", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(describeConnectError(refused, "postgres://u:p@db.local:6000/roofy_test")).toBe(
      "Test database not reachable on db.local:6000. Run pnpm db:up.",
    );
  });

  it("keeps the db:up hint for a timeout", () => {
    expect(describeConnectError(new Error("timeout expired"), TEST_URL)).toBe(
      "Test database not reachable on 127.0.0.1:5440. Run pnpm db:up.",
    );
  });

  it("shows the real error for a wrong password or missing database", () => {
    expect(describeConnectError(new Error('database "roofy_test" does not exist'), TEST_URL)).toBe(
      'Test database check failed: database "roofy_test" does not exist',
    );
  });
});
