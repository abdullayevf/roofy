// withLockedWrite (plan 04-db-auth Task 6): the only place the locked-log bypass flag is set, and it
// is always set back. The database side is tests/integration/locked-log.int.test.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withLockedWrite } from "./locked";
import type { Tx } from "./with-actor";

const ROOT = resolve(__dirname, "../../..");
/** Every root the scan reads, recursively. */
const SCANNED_ROOTS = ["src", "tests", "scripts"];
/** Only text files are read; screenshots under tests/visual are skipped. */
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".sh",
  ".py",
  ".md",
]);
const FLAG = ["app", "locked_write"].join(".");
/** Postgres setting names ignore case, and the short token catches `app . locked_write` and quoting too. */
const FLAG_TOKEN = new RegExp(["locked", "write"].join("_"), "i");
/** This file names the flag only to look for it. */
const THIS_FILE = "src/server/db/locked.test.ts";

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return TEXT_EXTENSIONS.has(extname(path)) ? [path] : [];
  });
}

const flagHits = (roots: string[]) =>
  roots
    .flatMap((root) => filesUnder(join(ROOT, root)))
    .filter((path) => FLAG_TOKEN.test(readFileSync(path, "utf8")))
    .map((path) => relative(ROOT, path))
    .filter((path) => path !== THIS_FILE)
    .sort();

describe("the locked-log bypass flag", () => {
  it(`appears only in locked.ts and the migration (scanned: ${SCANNED_ROOTS.join(", ")})`, () => {
    expect(flagHits(SCANNED_ROOTS)).toEqual([
      "src/server/db/locked.ts",
      "src/server/db/migrations/0005_locked_logs.sql",
    ]);
  });

  it("matches the flag in any case, and reads only text files", () => {
    expect(FLAG_TOKEN.test("select set_config('APP.Locked_Write', 'on', true)")).toBe(true);
    expect(FLAG_TOKEN.test(`set "app" . "LOCKED_WRITE" = 'on'`)).toBe(true);
    const scanned = filesUnder(join(ROOT, "tests"));
    expect(scanned.length).toBeGreaterThan(0);
    expect(scanned.filter((path) => !TEXT_EXTENSIONS.has(extname(path)))).toEqual([]);
    expect(scanned.some((path) => path.endsWith(".png"))).toBe(false);
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

  it("nested calls set the flag once and reset it only when the outermost call ends", async () => {
    const { tx, statements } = fakeTx();
    const seen: unknown[][] = [];
    const result = await withLockedWrite(tx, async () => {
      const inner = await withLockedWrite(tx, async () => {
        seen.push([...statements]);
        return "inner";
      });
      seen.push([...statements]);
      return `${inner} outer`;
    });
    expect(result).toBe("inner outer");
    expect(seen).toEqual([[ON], [ON]]);
    expect(statements).toEqual([ON, RESET]);
  });

  it("a nested call that throws leaves the flag on for the outer call, which then resets it", async () => {
    const { tx, statements } = fakeTx();
    let afterInner: unknown[] = [];
    await withLockedWrite(tx, async () => {
      await expect(
        withLockedWrite(tx, async () => {
          throw new Error("inner");
        }),
      ).rejects.toThrow("inner");
      afterInner = [...statements];
    });
    expect(afterInner).toEqual([ON]);
    expect(statements).toEqual([ON, RESET]);
  });

  it("after the outermost call ends, a new call on the same transaction sets the flag again", async () => {
    const { tx, statements } = fakeTx();
    await withLockedWrite(tx, async () => 1);
    await withLockedWrite(tx, async () => 2);
    expect(statements).toEqual([ON, RESET, ON, RESET]);
  });

  it("throws when the reset fails after fn succeeded", async () => {
    const { tx } = fakeTx(true);
    await expect(withLockedWrite(tx, async () => 1)).rejects.toThrow("current transaction is aborted");
  });
});
