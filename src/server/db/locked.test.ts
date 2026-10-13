// withLockedWrite (plan 04-db-auth Task 6): the only place the locked-log bypass flag is set, and it
// is always set back. The database side is tests/integration/locked-log.int.test.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withLockedWrite } from "./locked";
import type { Tx } from "./with-actor";

const ROOT = resolve(__dirname, "../../..");
/** Every root the scan reads, recursively. */
const SCANNED_ROOTS = ["src", "tests", "scripts"];
const FLAG = ["app", "locked_write"].join(".");
/** This file names the flag only to look for it. */
const THIS_FILE = "src/server/db/locked.test.ts";

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("the locked-log bypass flag", () => {
  it(`appears only in locked.ts and the migration (scanned: ${SCANNED_ROOTS.join(", ")})`, () => {
    const hits = SCANNED_ROOTS.flatMap((root) => filesUnder(join(ROOT, root)))
      .filter((path) => readFileSync(path, "utf8").includes(FLAG))
      .map((path) => relative(ROOT, path))
      .filter((path) => path !== THIS_FILE)
      .sort();
    expect(hits).toEqual(["src/server/db/locked.ts", "src/server/db/migrations/0005_locked_logs.sql"]);
  });
});

/** A stand-in transaction that records each statement as SQL text plus params. */
function fakeTx(failReset = false) {
  const dialect = new PgDialect();
  const statements: { sql: string; params: unknown[] }[] = [];
  const tx = {
    execute: async (query: SQL) => {
      const { sql, params } = dialect.sqlToQuery(query);
      statements.push({ sql, params });
      if (failReset && statements.length > 1) throw new Error("current transaction is aborted");
      return { rows: [] };
    },
  };
  return { tx: tx as unknown as Tx, statements };
}

const ON = { sql: `select set_config('${FLAG}', 'on', true)`, params: [] };
const RESET = { sql: `select set_config('${FLAG}', '', true)`, params: [] };

describe("withLockedWrite", () => {
  it("sets the flag on, transaction-local, runs fn, then resets it to '' and returns fn's value", async () => {
    const { tx, statements } = fakeTx();
    let during: unknown[] = [];
    const result = await withLockedWrite(tx, async () => {
      during = [...statements];
      return 42;
    });
    expect(result).toBe(42);
    expect(during).toEqual([ON]);
    expect(statements).toEqual([ON, RESET]);
  });

  it("resets the flag when fn throws, and rethrows fn's error", async () => {
    const { tx, statements } = fakeTx();
    await expect(
      withLockedWrite(tx, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(statements).toEqual([ON, RESET]);
  });

  it("rethrows fn's error, not the reset's, when fn's error aborted the transaction", async () => {
    const { tx, statements } = fakeTx(true);
    await expect(
      withLockedWrite(tx, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(statements).toEqual([ON, RESET]);
  });

  it("throws when the reset fails after fn succeeded", async () => {
    const { tx } = fakeTx(true);
    await expect(withLockedWrite(tx, async () => 1)).rejects.toThrow("current transaction is aborted");
  });
});
