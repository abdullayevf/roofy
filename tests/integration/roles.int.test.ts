import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { ensureRole, TEST_LOCK_KEY } from "@/server/db/admin";
import { closePools, pool } from "@/server/db/client";
import { requireEnv } from "@/server/db/env";

// The real roles' passwords are cluster-wide, so these tests use a throwaway role.
const PROBE = "roofy_t1_probe";
const PASSWORD = "p'a\\b\"c$$d";

afterAll(async () => {
  await pool("owner").query(`drop role if exists ${PROBE}`);
  await closePools();
});

describe("ensureRole", () => {
  it("can run twice, and the role then logs in with a quote-and-backslash password", async () => {
    const url = new URL(requireEnv("TEST_MIGRATE_DATABASE_URL"));
    const owner = new Client({ connectionString: url.toString() });
    await owner.connect();
    try {
      await ensureRole(owner, PROBE, PASSWORD);
      await ensureRole(owner, PROBE, PASSWORD);
    } finally {
      await owner.end();
    }
    const probe = new Client({
      host: url.hostname,
      port: Number(url.port),
      database: "roofy_test",
      user: PROBE,
      password: PASSWORD,
    });
    await probe.connect();
    try {
      const { rows } = await probe.query<{ user: string }>("select current_user as user");
      expect(rows[0]?.user).toBe(PROBE);
    } finally {
      await probe.end();
    }
  });
});

describe("test database lock", () => {
  it("is held by the global setup for the whole run, so a second run waits", async () => {
    const client = await pool("owner").connect();
    let got: boolean | undefined;
    try {
      const { rows } = await client.query<{ got: boolean }>(
        "select pg_try_advisory_lock(hashtext($1)) as got",
        [TEST_LOCK_KEY],
      );
      got = rows[0]?.got;
      if (got) await client.query("select pg_advisory_unlock(hashtext($1))", [TEST_LOCK_KEY]);
    } finally {
      client.release();
    }
    expect(got).toBe(false);
  });
});
