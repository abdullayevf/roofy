import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";
import { AUTH_TABLES, TENANT_TABLES } from "./tenancy";

const tables = Object.values(schema as Record<string, unknown>)
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table));

describe("tenancy lists", () => {
  it("name every Drizzle table exactly once", () => {
    const names = tables.map((t) => t.name).sort();
    expect([...TENANT_TABLES, ...AUTH_TABLES].sort()).toEqual(names);
    expect(new Set([...TENANT_TABLES, ...AUTH_TABLES]).size).toBe(names.length);
  });

  it("give every tenant table but workspace a not-null workspace_id and a unique (workspace_id, id)", () => {
    for (const t of tables.filter((t) => TENANT_TABLES.includes(t.name) && t.name !== "workspace")) {
      const column = t.columns.find((c) => c.name === "workspace_id");
      expect(column?.notNull, `${t.name}.workspace_id`).toBe(true);
      const keys = t.uniqueConstraints.map((u) => u.columns.map((c) => c.name).join(","));
      expect(keys, t.name).toContain("workspace_id,id");
    }
  });

  it("keep workspace_id off the auth tables and the workspace table", () => {
    for (const t of tables.filter((t) => AUTH_TABLES.includes(t.name) || t.name === "workspace")) {
      expect(
        t.columns.map((c) => c.name),
        t.name,
      ).not.toContain("workspace_id");
    }
  });
});
