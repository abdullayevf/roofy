// T10 carry note: actorFromHeaders is wrapped in React.cache so one request reads the session once.
import { describe, expect, it, vi } from "vitest";

const wrapped: unknown[] = [];
vi.mock("react", async (orig) => {
  const react = await orig<typeof import("react")>();
  return {
    ...react,
    cache: <F extends (...a: never[]) => unknown>(fn: F): F => {
      wrapped.push(fn);
      return fn;
    },
  };
});
vi.mock("@/server/db/client", () => ({ getAuthDb: vi.fn() }));
vi.mock("./auth", () => ({ getAuth: vi.fn() }));

describe("actorFromHeaders", () => {
  it("is wrapped in React.cache", async () => {
    const { actorFromHeaders } = await import("./actor");
    expect(wrapped).toContain(actorFromHeaders);
    expect((wrapped[0] as { name: string }).name).toBe("actorFromHeaders");
  });
});
