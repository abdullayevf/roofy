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
    registerDbData({ context: signedOut, onboarding: signedOut, auth: () => createFakeAuth() });
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
