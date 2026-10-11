/** Sign out: both prototype cookies go and the person lands on the sign-in page. */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
