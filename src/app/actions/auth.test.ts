/** Sign-in Server Functions: the cookies they set, the next page they name, the refusals they return. */
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => new Headers(),
}));

const { signIn, signUp, continueWithGoogle } = await import("./auth");
const { DEMO_OWNER_EMAIL, DEMO_PASSWORD } = await import("@/data/fake/services/auth");

beforeEach(() => jar.clear());

describe("auth Server Functions", () => {
  it("sign in sets the owner role and a demo session, and names Home", async () => {
    const r = await signIn(DEMO_OWNER_EMAIL, DEMO_PASSWORD);
    expect(r).toEqual({ ok: true, next: "/" });
    expect(jar.get("roofy_role")).toBe("owner");
    expect(jar.get("roofy_demo")).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("a wrong password sets nothing and says so in plain words", async () => {
    const r = await signIn(DEMO_OWNER_EMAIL, "nope-nope");
    expect(r).toMatchObject({ ok: false, code: "invalid", message: "That email and password don't match. Check them and try again." });
    expect(jar.size).toBe(0);
  });
  it("sign up names the set-up page; a blank email names the field", async () => {
    expect(await signUp("new@example.com", "longenough")).toEqual({ ok: true, next: "/onboarding" });
    const r = await signUp("", "longenough");
    expect(r).toMatchObject({ ok: false, issues: [{ field: "email", message: "Enter your email address." }] });
  });
  it("Continue with Google goes straight on; an unknown mode is refused", async () => {
    expect(await continueWithGoogle("sign-up")).toEqual({ ok: true, next: "/onboarding" });
    expect((await continueWithGoogle("sign-out" as never)).ok).toBe(false);
  });
});
