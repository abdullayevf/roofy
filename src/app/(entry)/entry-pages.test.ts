import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));
const redirects: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new Error(`redirect ${to}`);
  },
}));

const { registerDbData } = await import("@/data/db-registry");
const { createFakeAuth } = await import("@/data/fake/services/auth");
const SignIn = (await import("./sign-in/page")).default;
const SignUp = (await import("./sign-up/page")).default;
const Verify = (await import("./verify/page")).default;
const ResetPassword = (await import("./reset-password/page")).default;
const ForgotPassword = (await import("./forgot-password/page")).default;
const CheckEmailPage = (await import("./check-email/page")).default;

/** The `demo` prop the page hands to `AuthForm`. */
type Element = { props: { children: Array<{ props: { demo?: unknown } }> } };
const formDemo = (el: unknown) => (el as Element).props.children[1]?.props.demo;

beforeEach(() => {
  redirects.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  registerDbData(null);
});

describe("sign in and sign up pages", () => {
  it("in db mode, signed out: render the form without a redirect (no redirect loop)", async () => {
    vi.stubEnv("ROOFY_DATA", "db");
    const signedOut = async () => ({ redirect: "/sign-in" as const });
    registerDbData({ context: signedOut, onboarding: signedOut, auth: () => createFakeAuth(), signOut: async () => {} });
    for (const Page of [SignIn, SignUp]) {
      const el = await Page({ searchParams: Promise.resolve({ demo: "loading" }) });
      expect(formDemo(el)).toBeNull();
    }
    expect(redirects).toEqual([]);
  });

  it("in fake mode the ?demo= states still reach the form", async () => {
    vi.stubEnv("ROOFY_DATA", "fake");
    for (const Page of [SignIn, SignUp]) {
      expect(formDemo(await Page({ searchParams: Promise.resolve({ demo: "offline" }) }))).toBe("offline");
      expect(formDemo(await Page({ searchParams: Promise.resolve({}) }))).toBeNull();
    }
  });
});

/** The props a page hands its client part (second child of the fragment, or the root for check-email). */
const formProps = (el: unknown) => (el as { props: { children: Array<{ props: Record<string, unknown> }> } }).props.children[1]!.props;

describe("link landing pages", () => {
  beforeEach(() => {
    vi.stubEnv("ROOFY_DATA", "fake");
  });

  it("verify and reset-password hand the token (the first when repeated; null when missing) and the demo state to the form", async () => {
    for (const Page of [Verify, ResetPassword]) {
      expect(formProps(await Page({ searchParams: Promise.resolve({ token: "abc", demo: "offline" }) }))).toEqual({ token: "abc", demo: "offline" });
      expect(formProps(await Page({ searchParams: Promise.resolve({ token: ["first", "second"] }) }))).toEqual({ token: "first", demo: null });
      expect(formProps(await Page({ searchParams: Promise.resolve({}) }))).toEqual({ token: null, demo: null });
    }
  });

  it("forgot-password hands the demo state to the form; a state it does not use is ignored", async () => {
    expect(formProps(await ForgotPassword({ searchParams: Promise.resolve({ demo: "error" }) }))).toEqual({ demo: "error" });
    expect(formProps(await ForgotPassword({ searchParams: Promise.resolve({ demo: "waiting" }) }))).toEqual({ demo: null });
  });

  it("check-email shows the address it was given, trimmed and cut to 254 characters, or none", async () => {
    const props = async (email?: string | string[]) =>
      (await CheckEmailPage({ searchParams: Promise.resolve({ email }) }) as unknown as { props: { email: string | null } }).props.email;
    expect(await props("  sam@example.com ")).toBe("sam@example.com");
    expect(await props("a".repeat(300))).toHaveLength(254);
    expect(await props(["x@example.com", "y@example.com"])).toBe("x@example.com");
    expect(await props(undefined)).toBeNull();
    expect(await props("   ")).toBeNull();
  });
});
