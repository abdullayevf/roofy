import { describe, expect, it } from "vitest";
import { TOO_MANY_TRIES, TWO_FACTOR_CODE, WRONG_CODE, codeProblem, verifyPageUrl } from "@/lib/auth-input";
import { INVITE_GONE, INVITE_OTHER_EMAIL } from "@/lib/auth-input";
import {
  createFakeAuth,
  DEMO_TWO_FACTOR_EMAIL,
  FAKE_DEAD_INVITES,
  FAKE_OTHER_EMAIL_INVITE,
  FAKE_LOCKED_CODE,
  FAKE_WRONG_CODE,
  DEMO_TWO_FACTOR_SETUP,
} from "./auth";

const auth = createFakeAuth();

describe("fake two-factor and invites", () => {
  it("the two-factor account is sent to /two-factor after its password; everyone else goes Home", async () => {
    expect(await auth.signIn({ email: DEMO_TWO_FACTOR_EMAIL, password: "a-long-password" })).toEqual({
      role: "owner",
      next: "/two-factor",
    });
    expect(await auth.signIn({ email: "karen@harbourroofing.example", password: "roofy-demo" })).toEqual({
      role: "owner",
      next: "/",
    });
  });

  it("codes: 6 digits pass, 000000 is wrong, 111111 is too many tries, anything else asks for 6 digits", async () => {
    expect(await auth.verifyTwoFactor("482913")).toEqual({ role: "owner", next: "/" });
    await expect(auth.verifyTwoFactor(FAKE_WRONG_CODE)).rejects.toMatchObject({
      code: "invalid",
      message: WRONG_CODE,
    });
    await expect(auth.verifyTwoFactor(FAKE_LOCKED_CODE)).rejects.toMatchObject({ message: TOO_MANY_TRIES });
    await expect(auth.verifyTwoFactor("12ab")).rejects.toMatchObject({ message: TWO_FACTOR_CODE });
  });

  it("an invite names its team and role; cancelled, expired and used ones are refused, to read and to join", async () => {
    expect(await auth.inviteDetails("good-invite")).toEqual({
      workspaceName: "Harbour Roofing",
      role: "foreman",
    });
    expect((await auth.inviteDetails("long")).workspaceName.length).toBeGreaterThan(60);
    for (const id of FAKE_DEAD_INVITES) {
      await expect(auth.inviteDetails(id)).rejects.toMatchObject({ code: "invalid", message: INVITE_GONE });
      await expect(auth.acceptInvite(id)).rejects.toMatchObject({ code: "invalid", message: INVITE_GONE });
    }
    await expect(auth.inviteDetails(" ")).rejects.toMatchObject({ message: INVITE_GONE });
  });

  it("an invite for someone else says so, to read and to join (not that it expired)", async () => {
    await expect(auth.inviteDetails(FAKE_OTHER_EMAIL_INVITE)).rejects.toMatchObject({
      code: "forbidden",
      message: INVITE_OTHER_EMAIL,
    });
    await expect(auth.acceptInvite(FAKE_OTHER_EMAIL_INVITE)).rejects.toMatchObject({
      code: "forbidden",
      message: INVITE_OTHER_EMAIL,
    });
  });
});

describe("fake two-factor set-up (settings)", () => {
  it("hands back the fixed demo key, and the QR link holds the same key", async () => {
    const setup = await auth.startTwoFactor("");
    expect(setup).toEqual(DEMO_TWO_FACTOR_SETUP);
    expect(new URL(setup.uri).searchParams.get("secret")).toBe(setup.secret.replaceAll(" ", ""));
  });

  it("confirm: 6 digits pass, 000000 is the wrong code, anything else asks for 6 digits", async () => {
    await expect(auth.confirmTwoFactor("482913")).resolves.toBeUndefined();
    await expect(auth.confirmTwoFactor(FAKE_WRONG_CODE)).rejects.toMatchObject({
      code: "invalid",
      message: WRONG_CODE,
      issues: [{ field: "code", message: WRONG_CODE }],
    });
    await expect(auth.confirmTwoFactor("12ab")).rejects.toMatchObject({
      issues: [{ field: "code", message: TWO_FACTOR_CODE }],
    });
  });
});

describe("auth input helpers", () => {
  it("codeProblem accepts exactly 6 digits, trimmed", () => {
    expect(codeProblem(" 482913 ")).toBeNull();
    for (const bad of ["", "12345", "1234567", "12345a"]) expect(codeProblem(bad)).toBe(TWO_FACTOR_CODE);
  });

  it("the emailed verification link opens the /verify page with the token, URL-encoded, however the base ends", () => {
    expect(verifyPageUrl("https://app.example.com/", "a b+c")).toBe(
      "https://app.example.com/verify?token=a%20b%2Bc",
    );
    expect(verifyPageUrl("http://localhost:3100", "t")).toBe("http://localhost:3100/verify?token=t");
  });
});
