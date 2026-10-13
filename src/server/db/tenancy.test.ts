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

  it("give every tenant table not-null created_at and updated_at", () => {
    for (const t of tables.filter((t) => TENANT_TABLES.includes(t.name))) {
      for (const name of ["created_at", "updated_at"]) {
        expect(t.columns.find((c) => c.name === name)?.notNull, `${t.name}.${name}`).toBe(true);
      }
    }
  });

  // Decision 3: a child can only point at a parent in its own workspace. A plain
  // `.references(() => parent.id)` between tenant tables fails here.
  it("make every foreign key between tenant tables composite (workspace_id, x) -> (workspace_id, id)", () => {
    let composite = 0;
    for (const t of tables.filter((t) => TENANT_TABLES.includes(t.name))) {
      for (const fk of t.foreignKeys) {
        const ref = fk.reference();
        const parent = getTableConfig(ref.foreignTable).name;
        const local = ref.columns.map((c) => c.name);
        const foreign = ref.foreignColumns.map((c) => c.name);
        const label = `${t.name} -> ${parent} (${local.join(",")})`;
        if (!TENANT_TABLES.includes(parent)) continue;
        if (parent === "workspace") {
          expect([local, foreign], label).toEqual([["workspace_id"], ["id"]]);
          continue;
        }
        expect(local, label).toHaveLength(2);
        expect(local[0], label).toBe("workspace_id");
        expect(foreign, label).toEqual(["workspace_id", "id"]);
        composite += 1;
      }
    }
    expect(composite).toBeGreaterThanOrEqual(11);
  });

  it("back every tenant foreign key with an index or unique that starts with its columns", () => {
    const unindexed: string[] = [];
    for (const t of tables.filter((t) => TENANT_TABLES.includes(t.name))) {
      const leads = [
        ...t.indexes.map((i) => i.config.columns.map((c) => (c as { name?: string }).name ?? "").join(",")),
        ...t.uniqueConstraints.map((u) => u.columns.map((c) => c.name).join(",")),
        ...t.columns.filter((c) => c.isUnique || c.primary).map((c) => c.name),
      ];
      for (const fk of t.foreignKeys) {
        const cols = fk
          .reference()
          .columns.map((c) => c.name)
          .join(",");
        if (!leads.some((lead) => lead === cols || lead.startsWith(`${cols},`))) {
          unindexed.push(`${t.name} (${cols})`);
        }
      }
    }
    expect(unindexed).toEqual([]);
  });
});
