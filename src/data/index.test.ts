import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => requestHeaders,
}));

const { getData, isFakeMode, dataMode } = await import("./index");
const { clearSessionStores, sessionStoreIds, sharedStore, emptyStore } = await import("./fake/store");
const { DataError } = await import("./contracts");

beforeEach(() => {
  jar.clear();
  requestHeaders.delete("x-roofy-demo");
  vi.stubEnv("ROOFY_FAKE_NOW", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  clearSessionStores();
});

describe("ROOFY_DATA", () => {
  it("fake is the only implementation; unset defaults to fake outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ROOFY_DATA", "fake");
    expect([isFakeMode(), dataMode()]).toEqual([true, "fake"]);
    vi.stubEnv("ROOFY_DATA", undefined);
    expect([isFakeMode(), dataMode()]).toEqual([true, "fake"]);
  });

  it("in production an unset ROOFY_DATA is not fake: it throws until Phase 3", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ROOFY_DATA", undefined);
    expect(isFakeMode()).toBe(false);
    expect(() => dataMode()).toThrow(/ROOFY_DATA isn't set.*real data layer arrives in Phase 3/);
    await expect(getData()).rejects.toThrow(/Phase 3/);
    vi.stubEnv("ROOFY_DATA", "");
    expect(isFakeMode()).toBe(false);
    vi.stubEnv("ROOFY_DATA", "fake");
    expect([isFakeMode(), dataMode()]).toEqual([true, "fake"]);
  });

  it("anything else throws a clear error", async () => {
    vi.stubEnv("ROOFY_DATA", "postgres");
    expect(isFakeMode()).toBe(false);
    expect(() => dataMode()).toThrow(/real data layer arrives in Phase 3/);
    await expect(getData()).rejects.toThrow(/ROOFY_DATA="postgres"/);
  });
});

describe("getData", () => {
  it("without cookies: the manager (Dan Holt) on the shared seed, Mon 28 Sep 2026", async () => {
    const ctx = await getData();
    expect(ctx.actor).toMatchObject({ role: "manager", name: "Dan Holt" });
    expect(ctx.today).toBe("2026-09-28");
    expect(ctx.demo).toEqual({ state: null, loading: false, offline: false, outbox: [] });
    const home = await ctx.data.home.get(ctx.actor);
    expect(home.view).toBe("manager");
    expect(sessionStoreIds()).toEqual([]);
  });

  it("uses the seed's people for each role", async () => {
    const names: Record<string, string> = {};
    for (const role of ["owner", "manager", "foreman", "accountant"]) {
      jar.set("roofy_role", role);
      names[role] = (await getData()).actor.name;
    }
    expect(names).toEqual({
      owner: "Karen Holt",
      manager: "Dan Holt",
      foreman: "Craig Dunn",
      accountant: "Priya Shah",
    });
  });

  it("with a demo-session cookie: that session's own store, kept between requests", async () => {
    const id = crypto.randomUUID();
    jar.set("roofy_demo", id);
    await getData();
    await getData();
    expect(sessionStoreIds()).toEqual([id]);
    expect(sharedStore().readOnly).toBe(true);
  });

  it("reads ?demo= from searchParams (Promise) or, in layouts, the proxy header", async () => {
    const offline = await getData({ searchParams: Promise.resolve({ demo: "offline" }) });
    expect(offline.demo).toMatchObject({ state: "offline", offline: true });
    const loading = await getData({ searchParams: { demo: "loading" } });
    expect(loading.demo.loading).toBe(true);
    requestHeaders.set("x-roofy-demo", "waiting");
    expect((await getData()).demo.outbox).toHaveLength(3);
    const ignored = await getData({ searchParams: { demo: "bogus" } });
    expect(ignored.demo.state).toBeNull();
  });

  it("?demo=empty reads a new workspace; ?demo=error and noperm reject every read", async () => {
    const empty = await getData({ searchParams: { demo: "empty" } });
    expect((await empty.data.projects.list(empty.actor)).rows).toEqual([]);
    expect(emptyStore().tables.workspace.name).toBe("Harbour Roofing");
    const error = await getData({ searchParams: { demo: "error" } });
    await expect(error.data.home.get(error.actor)).rejects.toMatchObject({ code: "unavailable" });
    await expect(error.data.projects.list(error.actor)).rejects.toBeInstanceOf(DataError);
    const noperm = await getData({ searchParams: { demo: "noperm" } });
    await expect(noperm.data.home.get(noperm.actor)).rejects.toMatchObject({
      code: "forbidden",
      message: "You don't have access to this. Ask your manager.",
    });
  });
});
