/** Sign-in Server Functions: the cookies they set, the next page they name, the refusals they return. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => new Headers(),
}));

const { signIn, signUp, continueWithGoogle, verifyTwoFactor, acceptInvite, verifyEmail, requestPasswordReset, resetPassword } = await import("./auth");
const { DEMO_OWNER_EMAIL, DEMO_PASSWORD, createFakeAuth } = await import("@/data/fake/services/auth");
const { registerDbData } = await import("@/data/db-registry");

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
  it("sign in and sign up from an invite go back to it; a path off this site is ignored", async () => {
    expect(await signIn(DEMO_OWNER_EMAIL, DEMO_PASSWORD, "/invite/abc")).toEqual({ ok: true, next: "/invite/abc" });
    expect(await signUp("new@example.com", "longenough", "/invite/abc")).toEqual({ ok: true, next: "/invite/abc" });
    for (const bad of ["//evil.example", "https://evil.example/invite/abc", "/\\evil.example"]) {
      expect(await signIn(DEMO_OWNER_EMAIL, DEMO_PASSWORD, bad)).toEqual({ ok: true, next: "/" });
      expect(await signUp("new@example.com", "longenough", bad)).toEqual({ ok: true, next: "/onboarding" });
    }
    expect(jar.get("roofy_return") ?? "").toBe("");
  });
});

describe("auth Server Functions in db mode", () => {
  const GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth?client_id=test";
  beforeEach(() => {
    vi.stubEnv("ROOFY_DATA", "db");
    const fake = createFakeAuth();
    registerDbData({
      context: async () => ({ redirect: "/sign-in" }),
      onboarding: async () => ({ redirect: "/sign-in" }),
      auth: () => ({
        ...fake,
        continueWithGoogle: async () => ({ redirectTo: GOOGLE }),
        signUp: async () => ({ role: "owner", next: "/check-email" }),
        signIn: async (input) => ({ role: "owner", next: input.password === "two-factor-on" ? "/two-factor" : "/" }),
      }),
      signOut: async () => {},
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    registerDbData(null);
  });
  it("Continue with Google names Google's authorize URL and sets no prototype cookies", async () => {
    expect(await continueWithGoogle("sign-in")).toEqual({ ok: true, next: GOOGLE });
    expect(jar.size).toBe(0);
  });
  it("sign in names the next page and sets no prototype role or demo cookies", async () => {
    expect(await signIn(DEMO_OWNER_EMAIL, DEMO_PASSWORD)).toEqual({ ok: true, next: "/" });
    expect(jar.size).toBe(0);
  });
  it("passes the new next values through: /check-email after sign up, /two-factor when TOTP is on", async () => {
    expect(await signUp("new@example.com", "a long password")).toEqual({ ok: true, next: "/check-email" });
    expect(await signIn("a@example.com", "two-factor-on")).toEqual({ ok: true, next: "/two-factor" });
    expect(jar.size).toBe(0);
  });
  it("the code, email link and invite name the next page and set no prototype cookies", async () => {
    expect(await verifyTwoFactor("123456")).toEqual({ ok: true, next: "/" });
    expect(await verifyEmail("a-token")).toEqual({ ok: true, next: "/onboarding" });
    expect(await acceptInvite("inv-1")).toEqual({ ok: true, next: "/" });
    expect(jar.size).toBe(0);
  });
  it("a return path survives the check-email step and is followed after the email link", async () => {
    expect(await signUp("new@example.com", "a long password", "/invite/abc")).toEqual({ ok: true, next: "/check-email" });
    expect(jar.get("roofy_return")).toBe("/invite/abc");
    expect(await verifyEmail("a-token")).toEqual({ ok: true, next: "/invite/abc" });
    expect(jar.get("roofy_return")).toBe("");
    expect(await verifyEmail("a-token")).toEqual({ ok: true, next: "/onboarding" });
  });
  it("a return path survives the two-factor step and is followed after the code", async () => {
    expect(await signIn("a@example.com", "two-factor-on", "/invite/abc")).toEqual({ ok: true, next: "/two-factor" });
    expect(await verifyTwoFactor("123456")).toEqual({ ok: true, next: "/invite/abc" });
    expect(jar.get("roofy_return")).toBe("");
  });
  it("sign in without a return path drops an old one; joining the invite never goes back to the invite", async () => {
    jar.set("roofy_return", "/invite/abc");
    expect(await signIn(DEMO_OWNER_EMAIL, DEMO_PASSWORD)).toEqual({ ok: true, next: "/" });
    expect(jar.get("roofy_return")).toBe("");
    jar.set("roofy_return", "/invite/abc");
    expect(await acceptInvite("abc")).toEqual({ ok: true, next: "/" });
    expect(jar.get("roofy_return")).toBe("");
  });
  it("a return path off this site, in the call or in the cookie, is never followed", async () => {
    expect(await signUp("new@example.com", "a long password", "//evil.example")).toEqual({ ok: true, next: "/check-email" });
    expect(jar.get("roofy_return") ?? "").toBe("");
    jar.set("roofy_return", "//evil.example");
    expect(await verifyEmail("a-token")).toEqual({ ok: true, next: "/onboarding" });
  });
  it("password reset answers the one sentence, then the new password; refusals keep their field", async () => {
    const sent = await requestPasswordReset("someone@example.com");
    expect(sent).toMatchObject({ ok: true });
    expect(await resetPassword("a-token", "a long new password")).toEqual({ ok: true });
    expect(await resetPassword("a-token", "short")).toMatchObject({ ok: false, code: "invalid", issues: [{ field: "password" }] });
    expect(await verifyTwoFactor("12ab")).toMatchObject({ ok: false, code: "invalid", issues: [{ field: "code" }] });
  });
});
