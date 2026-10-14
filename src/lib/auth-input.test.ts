import { describe, expect, it } from "vitest";
import { authProblems, emailProblem, newPasswordProblem, passwordProblem } from "./auth-input";

describe("emailProblem", () => {
  it("asks for a blank email", () => expect(emailProblem("  ")).toBe("Enter your email address."));
  it("refuses an address without an @ and a domain", () => {
    expect(emailProblem("karen")).toBe("Check your email address. It should look like name@example.com.");
    expect(emailProblem("karen@harbour")).toBe("Check your email address. It should look like name@example.com.");
    expect(emailProblem("ka ren@harbour.example")).toMatch(/^Check your email address/);
  });
  it("accepts a normal address, trimming spaces", () => expect(emailProblem(" karen@harbourroofing.example ")).toBeNull());
  it("refuses an address over 254 characters", () =>
    expect(emailProblem(`${"a".repeat(250)}@b.example`)).toBe("That email address is too long."));
});

describe("passwordProblem", () => {
  it("asks for a blank password in both modes", () => {
    expect(passwordProblem("", "sign-in")).toBe("Enter your password.");
    expect(passwordProblem("", "sign-up")).toBe("Enter your password.");
  });
  it("sign-in accepts any password; sign-up needs 8 characters", () => {
    expect(passwordProblem("abc", "sign-in")).toBeNull();
    expect(passwordProblem("abc", "sign-up")).toBe("Use at least 8 characters.");
    expect(passwordProblem("abcdefgh", "sign-up")).toBeNull();
  });
  it("refuses more than 128 characters", () => expect(passwordProblem("a".repeat(129), "sign-up")).toBe("Use 128 characters or fewer."));
});

describe("authProblems", () => {
  it("lists a problem per field and nothing when both are fine", () => {
    expect(authProblems("sign-in", { email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
    expect(authProblems("sign-in", { email: "a@b.example", password: "x" })).toEqual({});
  });
});

describe("newPasswordProblem", () => {
  it("asks for a new password when blank, then holds it to the sign-up rules", () => {
    expect(newPasswordProblem("")).toBe("Enter a new password.");
    expect(newPasswordProblem("short")).toBe("Use at least 8 characters.");
    expect(newPasswordProblem("a".repeat(129))).toBe("Use 128 characters or fewer.");
    expect(newPasswordProblem("long-enough")).toBeNull();
  });
});
