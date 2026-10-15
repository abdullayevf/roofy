// T10 carry note: actorFromHeaders is wrapped in React.cache so one request reads the session once.
import { describe, expect, it, vi } from "vitest";

const wrapped: unknown[] = [];
vi.mock("react", async (orig) => {
  const react = await orig<typeof import("react")>();
  return {
    ...react,
    // Faithful to React.cache inside one request: memoised on argument identity (F10).
    cache: <F extends (h: unknown) => unknown>(fn: F): F => {
      wrapped.push(fn);
      const seen = new Map<unknown, unknown>();
      return ((h: unknown) => {
        if (!seen.has(h)) seen.set(h, fn(h));
        return seen.get(h);
      }) as F;
    },
  };
});
vi.mock("@/server/db/client", () => ({ getAuthDb: vi.fn() }));
const getSession = vi.fn(async () => null);
vi.mock("./auth", () => ({ getAuth: () => ({ api: { getSession } }) }));

describe("actorFromHeaders", () => {
  it("is wrapped in React.cache", async () => {
    await import("./actor");
    expect(wrapped).toHaveLength(1);
    expect((wrapped[0] as { name: string }).name).toBe("actorFromHeaders");
  }, 30_000); // the first dynamic import of ./actor pulls in the auth module graph: over 5 s while an e2e run holds the cores
  it("reads the session once for two calls with one request's headers", async () => {
    const { actorFromHeaders } = await import("./actor");
    getSession.mockClear();
    const h = new Headers({ cookie: "a=1" });
    expect(await actorFromHeaders(h)).toEqual({ kind: "signed-out" });
    expect(await actorFromHeaders(h)).toEqual({ kind: "signed-out" });
    expect(getSession).toHaveBeenCalledTimes(1);
    await actorFromHeaders(new Headers({ cookie: "a=1" }));
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
