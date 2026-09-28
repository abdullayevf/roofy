import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const set = vi.fn((name: string, value: string) => void jar.set(name, value));
const requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set,
  }),
  headers: async () => requestHeaders,
}));

const session = await import("./session");

beforeEach(() => {
  jar.clear();
  set.mockClear();
  requestHeaders.delete(session.DEMO_HEADER);
});

describe("session cookies", () => {
  it("defaults to the manager with no demo session (the shared seed store)", async () => {
    expect(await session.readSession()).toEqual({ role: "manager", demoSessionId: null });
  });

  it("reads a valid role and demo session id; ignores junk", async () => {
    const id = session.newDemoSessionId();
    jar.set("roofy_role", "foreman").set("roofy_demo", id);
    expect(await session.readSession()).toEqual({ role: "foreman", demoSessionId: id });
    jar.set("roofy_role", "admin").set("roofy_demo", "../../etc");
    expect(await session.readSession()).toEqual({ role: "manager", demoSessionId: null });
  });

  it("ensureDemoSession creates the cookie once, then reuses it", async () => {
    const id = await session.ensureDemoSession();
    expect(session.isDemoSessionId(id)).toBe(true);
    expect(set).toHaveBeenCalledWith(
      "roofy_demo",
      id,
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(await session.ensureDemoSession()).toBe(id);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("parses roles strictly", () => {
    expect(session.ROLES.map(session.parseRole)).toEqual(["owner", "manager", "foreman", "accountant"]);
    expect(session.parseRole("Owner")).toBeNull();
    expect(session.parseRole(undefined)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/jobs", "/jobs"],
    ["/jobs/abc?demo=offline#top", "/jobs/abc?demo=offline#top"],
    ["/a/../b", "/b"],
    [null, "/"],
    ["", "/"],
    ["jobs", "/"],
    ["https://evil.example/", "/"],
    ["//evil.example/x", "/"],
    ["/\\evil.example", "/"],
    ["/\u0000x", "/"],
    ["/ok\nSet-Cookie: x", "/"],
  ])("%s → %s", (input, expected) => {
    expect(session.safeNextPath(input)).toBe(expected);
  });
});

describe("the ?demo= value", () => {
  it("comes from a page's searchParams (a Promise in Next 16), a record or URLSearchParams", async () => {
    expect(await session.readDemoParam(Promise.resolve({ demo: "offline" }))).toBe("offline");
    expect(await session.readDemoParam({ demo: ["waiting", "x"] })).toEqual(["waiting", "x"]);
    expect(await session.readDemoParam(new URLSearchParams("demo=error"))).toBe("error");
    expect(await session.readDemoParam({})).toBeNull();
  });

  it("falls back to the proxy's header when no searchParams are given (layouts)", async () => {
    expect(await session.readDemoParam()).toBeNull();
    requestHeaders.set(session.DEMO_HEADER, "offline");
    expect(await session.readDemoParam()).toBe("offline");
  });
});
