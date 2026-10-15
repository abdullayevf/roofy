/**
 * Two-factor set-up is the Owner's (the page is owner only and Approve needs it), so the server refuses everyone else
 * before Better Auth is asked for a key (R1) or a first code is confirmed (R2). Better Auth is a stand-in here: the
 * point is that a refused person never reaches it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const auth = {
  startTwoFactor: vi.fn(async () => ({ secret: "ABCD EFGH", uri: "otpauth://totp/Roofy:x?secret=ABCDEFGH&issuer=Roofy" })),
  confirmTwoFactor: vi.fn(async () => undefined),
};
vi.mock("@/data", async (original) => ({ ...(await original<typeof import("@/data")>()), getAuth: () => auth }));

const { startTwoFactor, turnOnTwoFactor } = await import("./settings");
const { TWO_FACTOR_OWNER_ONLY } = await import("@/lib/auth-input");

beforeEach(() => {
  jar.clear();
  auth.startTwoFactor.mockClear();
  auth.confirmTwoFactor.mockClear();
});

describe("startTwoFactor", () => {
  it("gives the Owner a key and QR code, passing the password through", async () => {
    jar.set("roofy_role", "owner");
    const r = await startTwoFactor("correct horse battery");
    expect(r.ok).toBe(true);
    expect(auth.startTwoFactor).toHaveBeenCalledWith("correct horse battery");
  });

  it.each(["manager", "foreman", "accountant"])("refuses a %s before Better Auth makes a key", async (role) => {
    jar.set("roofy_role", role);
    const r = await startTwoFactor("correct horse battery");
    expect(r).toMatchObject({ ok: false, code: "forbidden", message: TWO_FACTOR_OWNER_ONLY });
    expect(auth.startTwoFactor).not.toHaveBeenCalled();
  });
});

describe("turnOnTwoFactor", () => {
  it("confirms the Owner's first code with Better Auth, then records it", async () => {
    jar.set("roofy_role", "owner");
    const r = await turnOnTwoFactor("482913");
    expect(r).toMatchObject({ ok: true, twoFactorEnabled: true });
    expect(auth.confirmTwoFactor).toHaveBeenCalledWith("482913");
  });

  it.each(["manager", "foreman", "accountant"])(
    "refuses a %s with a valid code before Better Auth turns two-factor on for them",
    async (role) => {
      jar.set("roofy_role", role);
      const r = await turnOnTwoFactor("482913");
      expect(r).toMatchObject({ ok: false, code: "forbidden", message: TWO_FACTOR_OWNER_ONLY });
      expect(auth.confirmTwoFactor).not.toHaveBeenCalled();
    },
  );
});
