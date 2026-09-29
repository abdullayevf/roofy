import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) => void jar.set(name, { value, options }),
  }),
}));

const { setTheme } = await import("./theme");

beforeEach(() => jar.clear());

describe("setTheme", () => {
  it("stores light, dark and system in roofy_theme for a year, site-wide", async () => {
    for (const t of ["light", "dark", "system"] as const) {
      await setTheme(t);
      const c = jar.get("roofy_theme");
      expect(c?.value).toBe(t);
      expect(c?.options).toMatchObject({ path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    }
  });
  it("treats anything else as system", async () => {
    await setTheme("purple" as never);
    expect(jar.get("roofy_theme")?.value).toBe("system");
  });
});
