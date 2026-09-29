import { afterEach, describe, expect, it } from "vitest";
import {
  SESSION_STORE_LIMIT,
  clearSessionStores,
  emptyStore,
  getSeed,
  sessionStore,
  sessionStoreIds,
  sharedStore,
} from "./store";

afterEach(() => clearSessionStores());

describe("FakeStore", () => {
  it("builds the seed once and shares it read-only (frozen) when there is no demo session", () => {
    expect(getSeed()).toBe(getSeed());
    const shared = sharedStore();
    expect(shared).toBe(sharedStore());
    expect(shared.readOnly).toBe(true);
    expect(shared.tables).toBe(getSeed());
    expect(Object.isFrozen(shared.tables.workLogs[0])).toBe(true);
    expect(() => shared.write(() => undefined)).toThrow(/read-only/);
  });

  it("gives each demo session its own clone, reused on later requests", () => {
    const a = sessionStore("a");
    const b = sessionStore("b");
    expect(a).not.toBe(b);
    expect(sessionStore("a")).toBe(a);
    expect(a.tables).not.toBe(getSeed());
    expect(a.tables.workLogs).toHaveLength(getSeed().workLogs.length);
    a.write((t) => {
      t.workspace.name = "Changed";
    });
    expect(a.tables.workspace.name).toBe("Changed");
    expect(b.tables.workspace.name).toBe("Harbour Roofing");
    expect(getSeed().workspace.name).toBe("Harbour Roofing");
  });

  it("keeps at most 50 sessions, dropping the least recently used", () => {
    for (let i = 0; i < SESSION_STORE_LIMIT; i++) sessionStore(`s${i}`);
    sessionStore("s0"); // touch: now most recent
    sessionStore("new");
    const ids = sessionStoreIds();
    expect(ids).toHaveLength(SESSION_STORE_LIMIT);
    expect(ids).toContain("s0");
    expect(ids).not.toContain("s1");
    expect(ids.at(-1)).toBe("new");
  }, 30_000); // 51 clones of the seed: slow while the rest of the suite runs in parallel

  it("rebuilds its indexes after a write", () => {
    const s = sessionStore("x");
    const before = s.indexes();
    expect(s.indexes()).toBe(before);
    const v = s.version;
    s.write(() => undefined);
    expect(s.version).toBe(v + 1);
    expect(s.indexes()).not.toBe(before);
  });

  it("?demo=empty is a new workspace: settings only, every list empty", () => {
    const t = emptyStore().tables;
    expect(t.workspace.name).toBe("Harbour Roofing");
    expect(t.members).toHaveLength(4);
    expect(t.crewLevels.length).toBeGreaterThan(0);
    expect(t.expenseCategories.length).toBeGreaterThan(0);
    expect(t.stageTemplates.length).toBe(5);
    for (const key of [
      "projects",
      "crewMembers",
      "workLogs",
      "expenses",
      "payRuns",
      "ledgerEntries",
    ] as const) {
      expect(t[key]).toEqual([]);
    }
    expect(emptyStore().readOnly).toBe(true);
  });
});
