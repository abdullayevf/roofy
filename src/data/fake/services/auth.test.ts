import { describe, expect, it } from "vitest";
import { isDataError } from "../../contracts";
import {
  createFakeAuth,
  DEMO_OWNER_EMAIL,
  DEMO_PASSWORD,
  INVITE_GONE,
  LINK_EXPIRED,
  RESET_LINK_SENT,
  TWO_FACTOR_CODE,
} from "./auth";

const auth = createFakeAuth();
const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (isDataError(e)) return e;
    throw e;
  }
  throw new Error("expected a refusal");
};

describe("fake auth: sign in", () => {
  it("signs the demo owner in with the demo password, to Home", async () => {
    expect(await auth.signIn({ email: DEMO_OWNER_EMAIL, password: DEMO_PASSWORD })).toEqual({ role: "owner", next: "/" });
  });
  it("matches the email without caring about case or spaces", async () => {
    expect((await auth.signIn({ email: ` ${DEMO_OWNER_EMAIL.toUpperCase()} `, password: DEMO_PASSWORD })).next).toBe("/");
  });
  it("refuses the demo owner's email with another password, in plain words, with no field named", async () => {
    const e = await refusal(auth.signIn({ email: DEMO_OWNER_EMAIL, password: "not-the-password" }));
    expect(e.code).toBe("invalid");
    expect(e.message).toBe("That email and password don't match. Check them and try again.");
    expect(e.issues).toEqual([]);
  });
  it("lets another well-formed email in with a password of 8 or more characters (prototype), and refuses a shorter one", async () => {
    expect((await auth.signIn({ email: "sam@example.com", password: "longenough" })).role).toBe("owner");
    expect((await refusal(auth.signIn({ email: "sam@example.com", password: "short" }))).message).toMatch(/don't match/);
  });
  it("names each blank or bad field", async () => {
    const e = await refusal(auth.signIn({ email: "", password: "" }));
    expect(e.issues).toEqual([
      { field: "email", message: "Enter your email address." },
      { field: "password", message: "Enter your password." },
    ]);
  });
});

describe("fake auth: sign up", () => {
  it("creates an owner and sends them to set up the business", async () => {
    expect(await auth.signUp({ email: "new@example.com", password: "longenough" })).toEqual({ role: "owner", next: "/onboarding" });
  });
  it("needs 8 characters, naming the password field", async () => {
    const e = await refusal(auth.signUp({ email: "new@example.com", password: "short" }));
    expect(e.issues).toEqual([{ field: "password", message: "Use at least 8 characters." }]);
  });
  it("refuses an email that already has an account, pointing to sign in", async () => {
    const e = await refusal(auth.signUp({ email: DEMO_OWNER_EMAIL, password: "longenough" }));
    expect(e.issues).toEqual([{ field: "email", message: "An account with that email already exists. Sign in instead." }]);
  });
});

describe("fake auth: Continue with Google", () => {
  it("goes straight on: Home to sign in, set-up to sign up", async () => {
    expect(await auth.continueWithGoogle("sign-in")).toEqual({ role: "owner", next: "/" });
    expect(await auth.continueWithGoogle("sign-up")).toEqual({ role: "owner", next: "/onboarding" });
  });
});

describe("fake auth: email, reset, two-factor and invite (Phase 3 additions)", () => {
  it("requestPasswordReset answers the same sentence for a known and an unknown email", async () => {
    const known = await auth.requestPasswordReset(DEMO_OWNER_EMAIL);
    const unknown = await auth.requestPasswordReset("nobody-here@example.com");
    expect(known).toEqual({ message: RESET_LINK_SENT });
    expect(unknown).toEqual(known);
  });
  it("requestPasswordReset refuses a badly formed email, naming the field", async () => {
    const e = await refusal(auth.requestPasswordReset("not-an-email"));
    expect([e.code, e.message, e.issues]).toEqual([
      "invalid",
      "Check your email address. It should look like name@example.com.",
      [{ field: "email", message: "Check your email address. It should look like name@example.com." }],
    ]);
  });
  it("verifyEmail goes on to set-up; a blank token is an expired link", async () => {
    expect(await auth.verifyEmail("token-1")).toEqual({ role: "owner", next: "/onboarding" });
    const e = await refusal(auth.verifyEmail(" "));
    expect([e.code, e.message]).toEqual(["invalid", LINK_EXPIRED]);
  });
  it("the prototype's spent link tokens (expired, used) are refused as expired links by verify and reset", async () => {
    for (const token of ["expired", "used", " used "]) {
      const v = await refusal(auth.verifyEmail(token));
      expect([v.code, v.message]).toEqual(["invalid", LINK_EXPIRED]);
      const r = await refusal(auth.resetPassword(token, "long-enough"));
      expect([r.code, r.message]).toEqual(["invalid", LINK_EXPIRED]);
    }
  });
  it("resetPassword takes a new password of 8 or more characters", async () => {
    await expect(auth.resetPassword("token-1", "long-enough")).resolves.toBeUndefined();
    const short = await refusal(auth.resetPassword("token-1", "short"));
    expect([short.code, short.issues]).toEqual(["invalid", [{ field: "password", message: "Use at least 8 characters." }]]);
    const gone = await refusal(auth.resetPassword("", "long-enough"));
    expect([gone.code, gone.message]).toEqual(["invalid", LINK_EXPIRED]);
  });
  it("verifyTwoFactor takes 6 digits and goes Home", async () => {
    expect(await auth.verifyTwoFactor(" 123456 ")).toEqual({ role: "owner", next: "/" });
    for (const bad of ["12345", "abcdef", "1234567"]) {
      const e = await refusal(auth.verifyTwoFactor(bad));
      expect([e.code, e.issues]).toEqual(["invalid", [{ field: "code", message: TWO_FACTOR_CODE }]]);
    }
  });
  it("acceptInvite joins and goes Home; a blank invite is a cancelled one", async () => {
    expect(await auth.acceptInvite("inv-1")).toEqual({ role: "foreman", next: "/" });
    const e = await refusal(auth.acceptInvite(""));
    expect([e.code, e.message]).toEqual(["invalid", INVITE_GONE]);
  });
  it("continueWithGoogle still goes straight on in the prototype", async () => {
    expect(await auth.continueWithGoogle("sign-up")).toEqual({ role: "owner", next: "/onboarding" });
  });
});
