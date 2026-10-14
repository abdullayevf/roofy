/** An expired session in db mode: the wrappers must let Next's redirect through, not turn it into a form error. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { registerDbData } = await import("@/data/db-registry");
const { createFakeAuth } = await import("@/data/fake/services/auth");
const { act } = await import("./run");
const { chooseTrade, saveBusiness } = await import("./onboarding");

/** Where a thrown Next redirect goes (its digest is `NEXT_REDIRECT;<type>;<url>;<status>;`), or null. */
async function redirectTarget(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const digest = (e as { digest?: unknown }).digest;
    return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")
      ? (digest.split(";")[2] ?? null)
      : null;
  }
}

beforeEach(() => {
  vi.stubEnv("ROOFY_DATA", "db");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const expired = async () => ({ redirect: "/sign-in" as const });
  registerDbData({ context: expired, onboarding: expired, auth: () => createFakeAuth() });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  registerDbData(null);
});

describe("an expired session's redirect propagates out of the action wrappers", () => {
  it("act() rethrows the redirect to /sign-in", async () => {
    const work = vi.fn(async () => ({}));
    expect(await redirectTarget(act([], [], work, []))).toBe("/sign-in");
    expect(work).not.toHaveBeenCalled();
  });

  it("the set-up wizard's run() rethrows the redirect to /sign-in", async () => {
    expect(await redirectTarget(chooseTrade())).toBe("/sign-in");
    expect(await redirectTarget(saveBusiness({ name: "Lee Roofing", abn: "", gstRegistered: true }))).toBe(
      "/sign-in",
    );
  });
});
