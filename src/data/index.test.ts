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
/** Like Next's `redirect()`: records where to and never returns. */
const redirects: string[] = [];
class Redirected extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new Redirected(to);
  },
}));

const {
  getData,
  getDemo,
  getWriteData,
  getAuth,
  getOnboarding,
  getOnboardingWrite,
  startNewWorkspace,
  isFakeMode,
  dataMode,
} = await import("./index");
const { registerDbData } = await import("./db-registry");
const { createFakeAuth } = await import("./fake/services/auth");
const { clearSessionStores, sessionStoreIds, sharedStore, emptyStore } = await import("./fake/store");
const { DataError } = await import("./contracts");

beforeEach(() => {
  jar.clear();
  redirects.length = 0;
  registerDbData(null);
  requestHeaders.delete("x-roofy-demo");
  vi.stubEnv("ROOFY_FAKE_NOW", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  clearSessionStores();
});

describe("ROOFY_DATA", () => {
  it("fake and db are the implementations; unset defaults to fake outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ROOFY_DATA", "fake");
    expect([isFakeMode(), dataMode()]).toEqual([true, "fake"]);
    vi.stubEnv("ROOFY_DATA", "db");
    expect([isFakeMode(), dataMode()]).toEqual([false, "db"]);
    vi.stubEnv("ROOFY_DATA", undefined);
    expect([isFakeMode(), dataMode()]).toEqual([true, "fake"]);
  });

  it("in production an unset ROOFY_DATA is not fake: it throws, naming both modes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ROOFY_DATA", undefined);
    expect(isFakeMode()).toBe(false);
    const unset =
      "ROOFY_DATA isn't set. Set ROOFY_DATA=db for the database or ROOFY_DATA=fake to run the prototype.";
    expect(() => dataMode()).toThrow(new Error(unset));
    await expect(getData()).rejects.toThrow(new Error(unset));
    vi.stubEnv("ROOFY_DATA", "");
    expect(isFakeMode()).toBe(false);
    vi.stubEnv("ROOFY_DATA", "fake");
    expect([isFakeMode(), dataMode()]).toEqual([true, "fake"]);
  });

  it("anything else throws a clear error", async () => {
    vi.stubEnv("ROOFY_DATA", "postgres");
    expect(isFakeMode()).toBe(false);
    const wrong = new Error(
      'ROOFY_DATA="postgres" isn\'t a data mode. Set ROOFY_DATA=db or ROOFY_DATA=fake.',
    );
    expect(() => dataMode()).toThrow(wrong);
    await expect(getData()).rejects.toThrow(wrong);
    expect(() => getAuth()).toThrow(wrong);
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

  it("getDemo answers getData's demo flags", async () => {
    const searchParams = { demo: "offline" };
    expect(await getDemo({ searchParams })).toEqual((await getData({ searchParams })).demo);
    expect((await getDemo({ searchParams })).offline).toBe(true);
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
    // The shell still names the workspace when every read fails.
    expect(error.workspaceName).toBe("Harbour Roofing");
    const noperm = await getData({ searchParams: { demo: "noperm" } });
    await expect(noperm.data.home.get(noperm.actor)).rejects.toMatchObject({
      code: "forbidden",
      message: "You don't have access to this. Ask your manager.",
    });
  });
});

describe("ROOFY_DATA=db", () => {
  const actor = { userId: "u-1", workspaceId: "w-1", role: "owner" as const, name: "Ann Lee" };
  const data = { marker: "db services" } as unknown as import("./contracts").DataServices;
  const service = { marker: "db onboarding" } as unknown as import("./contracts").OnboardingService;
  const auth = createFakeAuth();
  const seen: Headers[] = [];
  let context: Awaited<ReturnType<import("./db-registry").DbDataProvider["context"]>>;
  let onboarding: Awaited<ReturnType<import("./db-registry").DbDataProvider["onboarding"]>>;

  beforeEach(() => {
    vi.stubEnv("ROOFY_DATA", "db");
    seen.length = 0;
    context = { actor, data, today: "2026-10-14", workspaceName: "Lee Roofing" };
    onboarding = { actor, service };
    registerDbData({
      context: async (h) => (seen.push(h), context),
      auth: () => auth,
      onboarding: async (h) => (seen.push(h), onboarding),
    });
  });

  it("getData answers the provider's actor, services, today and workspace name for this request's headers", async () => {
    expect(await getData()).toEqual({
      mode: "db",
      data,
      actor,
      today: "2026-10-14",
      workspaceName: "Lee Roofing",
      demo: { state: null, loading: false, offline: false, outbox: [] },
    });
    expect(seen).toEqual([requestHeaders]);
  });

  it("demo flags are all off and ?demo= (param or proxy header) is ignored", async () => {
    requestHeaders.set("x-roofy-demo", "waiting");
    for (const demo of ["loading", "offline", "error", "noperm", "empty"]) {
      const ctx = await getData({ searchParams: { demo } });
      expect([ctx.demo, ctx.data]).toEqual([
        { state: null, loading: false, offline: false, outbox: [] },
        data,
      ]);
    }
    expect((await getOnboarding({ searchParams: { demo: "error" } })).demo).toEqual({
      state: null,
      loading: false,
      offline: false,
      outbox: [],
    });
  });

  it("signed out → redirect('/sign-in'); no workspace → redirect('/onboarding'), for reads and writes", async () => {
    context = { redirect: "/sign-in" };
    await expect(getData()).rejects.toThrow(new Redirected("/sign-in"));
    await expect(getWriteData()).rejects.toThrow(new Redirected("/sign-in"));
    context = { redirect: "/onboarding" };
    await expect(getData()).rejects.toThrow(new Redirected("/onboarding"));
    expect(redirects).toEqual(["/sign-in", "/sign-in", "/onboarding"]);
  });

  it("getWriteData answers the same actor and services, without demo state", async () => {
    expect(await getWriteData()).toEqual({ mode: "db", data, actor, today: "2026-10-14" });
  });

  it("getOnboarding: signed out → /sign-in, already in a workspace → /, otherwise the provider's wizard", async () => {
    onboarding = { redirect: "/sign-in" };
    await expect(getOnboarding()).rejects.toThrow(new Redirected("/sign-in"));
    onboarding = { redirect: "/" };
    await expect(getOnboardingWrite()).rejects.toThrow(new Redirected("/"));
    expect(redirects).toEqual(["/sign-in", "/"]);
    onboarding = { actor, service };
    expect(await getOnboarding()).toMatchObject({ onboarding: service, actor });
    expect((await getOnboardingWrite()).onboarding).toBe(service);
  });

  it("prototype cookies (roofy_role, roofy_demo) are ignored: the provider's actor, no cookie or demo store touched", async () => {
    const demoId = crypto.randomUUID();
    jar.set("roofy_role", "foreman");
    jar.set("roofy_demo", demoId);
    const before = [...jar.entries()];
    expect((await getData()).actor).toBe(actor);
    expect((await getWriteData()).actor).toBe(actor);
    expect((await getOnboarding()).actor).toBe(actor);
    expect((await getOnboardingWrite()).actor).toBe(actor);
    expect([...jar.entries()]).toEqual(before);
    expect(sessionStoreIds()).toEqual([]);
  });

  it("getDemo reads no session: signed out still answers all-off flags, no redirect", async () => {
    context = { redirect: "/sign-in" };
    onboarding = { redirect: "/sign-in" };
    expect(await getDemo({ searchParams: { demo: "loading" } })).toEqual({
      state: null,
      loading: false,
      offline: false,
      outbox: [],
    });
    expect([redirects, seen]).toEqual([[], []]);
  });

  it("getAuth is the provider's auth service; sign-up makes no demo workspace", async () => {
    expect(getAuth()).toBe(auth);
    await startNewWorkspace();
    expect([sessionStoreIds(), jar.size]).toEqual([[], 0]);
  });

  it("with no provider registered, every entry point says so", async () => {
    registerDbData(null);
    const missing = new Error("The database data layer is not registered");
    await expect(getData()).rejects.toThrow(missing);
    expect(() => getAuth()).toThrow(missing);
    await expect(getOnboarding()).rejects.toThrow(missing);
  });
});
