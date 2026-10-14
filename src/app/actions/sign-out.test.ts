/** Sign out: both prototype cookies go and the person lands on the sign-in page. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>([
  ["roofy_role", "owner"],
  ["roofy_demo", "abc"],
  ["roofy_theme", "dark"],
]);
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: (name: string) => void jar.delete(name) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

const { signOut } = await import("./sign-out");
const { registerDbData } = await import("@/data/db-registry");
const { createFakeAuth } = await import("@/data/fake/services/auth");

beforeEach(() => {
  jar.set("roofy_role", "owner");
  jar.set("roofy_demo", "abc");
});

describe("signOut", () => {
  it("clears the role and demo session, keeps the theme, and goes to sign in", async () => {
    await expect(signOut()).rejects.toThrow("redirect:/sign-in");
    expect(jar.has("roofy_role")).toBe(false);
    expect(jar.has("roofy_demo")).toBe(false);
    expect(jar.get("roofy_theme")).toBe("dark");
  });
});

describe("signOut in db mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    registerDbData(null);
  });
  it("ends the Better Auth session once, then goes to sign in", async () => {
    vi.stubEnv("ROOFY_DATA", "db");
    const ended = vi.fn(async () => {});
    const signedOut = async () => ({ redirect: "/sign-in" as const });
    registerDbData({ context: signedOut, onboarding: signedOut, auth: () => createFakeAuth(), signOut: ended });
    await expect(signOut()).rejects.toThrow("redirect:/sign-in");
    expect(ended).toHaveBeenCalledTimes(1);
  });
  it("prototype mode never reaches the db", async () => {
    vi.stubEnv("ROOFY_DATA", "fake");
    const ended = vi.fn(async () => {});
    const signedOut = async () => ({ redirect: "/sign-in" as const });
    registerDbData({ context: signedOut, onboarding: signedOut, auth: () => createFakeAuth(), signOut: ended });
    await expect(signOut()).rejects.toThrow("redirect:/sign-in");
    expect(ended).not.toHaveBeenCalled();
  });
});
