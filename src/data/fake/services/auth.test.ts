import { describe, expect, it } from "vitest";
import { isDataError } from "../../contracts";
import { createFakeAuth, DEMO_OWNER_EMAIL, DEMO_PASSWORD } from "./auth";

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
