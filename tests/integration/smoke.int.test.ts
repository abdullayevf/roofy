import { afterAll, describe, expect, it } from "vitest";
import { closePools, pool } from "@/server/db/client";

describe("integration harness", () => {
  afterAll(async () => {
    await closePools();
  });

  it("connects to the roofy_test database on Postgres 17 or later", async () => {
    const { rows } = await pool("owner").query<{ db: string; version: number }>(
      "select current_database() as db, current_setting('server_version_num')::int as version",
    );
    expect(rows[0]?.db).toBe("roofy_test");
    expect(rows[0]?.version).toBeGreaterThanOrEqual(170000);
  });

  it("lets the app and auth roles log in, without superuser or RLS bypass", async () => {
    for (const [role, user] of [
      ["app", "roofy_app"],
      ["auth", "roofy_auth"],
    ] as const) {
      const { rows } = await pool(role).query<{ user: string; db: string }>(
        "select current_user as user, current_database() as db",
      );
      expect(rows[0]).toEqual({ user, db: "roofy_test" });
    }
    const { rows: flags } = await pool("owner").query<{ rolname: string }>(
      "select rolname from pg_roles where rolname in ('roofy_app','roofy_auth') and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)",
    );
    expect(flags).toEqual([]);
  });
});
