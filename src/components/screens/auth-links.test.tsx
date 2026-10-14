// @vitest-environment jsdom
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LINK_EXPIRED, LINK_INCOMPLETE, RESET_LINK_SENT, SIGN_IN_FAILED } from "@/lib/auth-input";
import { AuthForm } from "./auth-form";
import { CheckEmail } from "./check-email";
import { ForgotPasswordForm } from "./forgot-password-form";
import { ResetPasswordForm } from "./reset-password-form";
import { VerifyEmail } from "./verify-email";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  continueWithGoogle: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/app/actions/auth", () => ({
  signIn: mocks.signIn,
  signUp: mocks.signUp,
  continueWithGoogle: mocks.continueWithGoogle,
  requestPasswordReset: mocks.requestPasswordReset,
  resetPassword: mocks.resetPassword,
  verifyEmail: mocks.verifyEmail,
}));

const LONG_EMAIL = "maria.fernanda.van-der-westhuizen-smith@harbour-and-bay-roofing-contractors.example";
const gone = { ok: false, code: "invalid", message: LINK_EXPIRED, issues: [] };

beforeEach(() => {
  cleanup();
  for (const mock of Object.values(mocks)) mock.mockReset();
});

describe("sign-in and sign-up links and routing", () => {
  it("sign in has a Forgot password? link to /forgot-password; sign up does not", () => {
    render(<AuthForm mode="sign-in" demo={null} />);
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
    cleanup();
    render(<AuthForm mode="sign-up" demo={null} />);
    expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
  });

  it("sign up goes to check-email with the address when the service says so", async () => {
    mocks.signUp.mockResolvedValue({ ok: true, next: "/check-email" });
    render(<AuthForm mode="sign-up" demo={null} />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "a-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/check-email?email=sam%40example.com"));
  });

  it("sign up and sign in still go to the next screen the service names", async () => {
    mocks.signUp.mockResolvedValue({ ok: true, next: "/onboarding" });
    render(<AuthForm mode="sign-up" demo={null} />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "a-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/onboarding"));
  });
});

describe("Check your email", () => {
  it("names the address the link went to, and offers a different email or sign in", () => {
    render(<CheckEmail email="sam@example.com" />);
    expect(screen.getByRole("heading", { level: 1, name: "Check your email" })).toBeTruthy();
    expect(screen.getByTestId("check-email-address").textContent).toBe("sam@example.com");
    expect(screen.getByRole("link", { name: "Use a different email" }).getAttribute("href")).toBe("/sign-up");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  });

  it("the sentences sit in the heading block, right under the title like an intro (auth i2 D31)", () => {
    render(<CheckEmail email="sam@example.com" />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Check your email" });
    expect(h1.nextElementSibling?.textContent).toContain("We sent a link to");
    expect(h1.nextElementSibling?.className).toContain("entry-intro");
    expect(h1.parentElement?.contains(screen.getByTestId("check-email-address"))).toBe(true);
    expect(screen.getByRole("link", { name: "Use a different email" }).getAttribute("data-variant")).toBe("secondary");
  });

  it("without an address, says a link was sent and still offers the way out", () => {
    render(<CheckEmail email={null} />);
    expect(screen.getByText("We sent you a link. Open it to finish setting up.")).toBeTruthy();
  });

  it("a long address wraps instead of widening the page", () => {
    render(<CheckEmail email={LONG_EMAIL} />);
    const address = screen.getByTestId("check-email-address");
    expect(address.textContent).toBe(LONG_EMAIL);
    expect(address.className).toContain("break-words");
    expect(address.className).not.toContain("break-all");
    // Break chances only after @ and dots, so the address wraps at a sensible spot (auth i1 F15).
    expect(address.querySelectorAll("wbr").length).toBe(LONG_EMAIL.split(/(?<=[@.])/).length - 1);
  });

  it("has no Send again: the sign-up has no resend to call (a recorded deviation)", () => {
    render(<CheckEmail email="sam@example.com" />);
    expect(screen.queryByRole("button", { name: /Send again/ })).toBeNull();
  });
});

describe("Forgot password", () => {
  it("has a Send link button and a way back to sign in", () => {
    render(<ForgotPasswordForm demo={null} />);
    expect(screen.getByRole("button", { name: "Send link" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  });

  it("refuses a blank or malformed email without asking the service", async () => {
    render(<ForgotPasswordForm demo={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect(screen.getByText("Enter your email address.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Email"), "karen@harbourroofing");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect(screen.getByText(/Check your email address/)).toBeTruthy();
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("says the same thing whether or not the email has an account, and never repeats the email", async () => {
    mocks.requestPasswordReset.mockResolvedValue({ ok: true, message: RESET_LINK_SENT });
    const seen: string[] = [];
    for (const address of ["karen@harbourroofing.example", "nobody@nowhere.example"]) {
      render(<ForgotPasswordForm demo={null} />);
      await userEvent.type(screen.getByLabelText("Email"), address);
      await userEvent.click(screen.getByRole("button", { name: "Send link" }));
      const status = await screen.findByRole("status");
      expect(status.textContent).not.toContain(address);
      seen.push(status.textContent ?? "");
      cleanup();
    }
    expect(seen[0]).toBe(RESET_LINK_SENT);
    expect(seen[1]).toBe(seen[0]);
  });

  it("a service that is down gets the plain sorry sentence and the button stays", async () => {
    mocks.requestPasswordReset.mockResolvedValue({
      ok: false,
      code: "unavailable",
      message: SIGN_IN_FAILED,
      issues: [],
    });
    render(<ForgotPasswordForm demo={null} />);
    await userEvent.type(screen.getByLabelText("Email"), "karen@harbourroofing.example");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't send the link. Try again.");
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("the answer replaces the heading and instruction, and offers Send again after a wait and a different email", async () => {
    mocks.requestPasswordReset.mockResolvedValue({ ok: true, message: RESET_LINK_SENT });
    render(<ForgotPasswordForm demo={null} />);
    await userEvent.type(screen.getByLabelText("Email"), "karen@harbourroofing.example");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect(await screen.findByText(RESET_LINK_SENT)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Check your email" })).toBeTruthy();
    expect(screen.queryByText(/Enter your email and/)).toBeNull();
    const again = screen.getByRole("button", { name: /Send again/ }) as HTMLButtonElement;
    expect(again.disabled).toBe(true);
    expect(again.textContent).toContain("30 s");
    await userEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByRole("button", { name: "Send link" })).toBeTruthy();
  });

  it("offline shows Needs connection and blocks the button; the error demo shows the sorry sentence", async () => {
    render(<ForgotPasswordForm demo="offline" />);
    expect(screen.getByText(/Needs connection/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send link" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/Needs connection/)).toHaveLength(1);
    cleanup();
    render(<ForgotPasswordForm demo="error" />);
    // The error shows on arrival, with the button reading Try again.
    expect(screen.getByRole("alert").textContent).toBe("Couldn't send the link. Try again.");
    // The typed email is still in the box, so Try again never sits over an empty one (auth i2 D26 + F19).
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("karen@harbourroofing.example");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("Reset password", () => {
  it("has a Set password button and refuses a blank or short password without asking the service", async () => {
    render(<ResetPasswordForm token="t-1" demo={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByText("Enter a new password.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("sends the token with the new password, then says to sign in", async () => {
    mocks.resetPassword.mockResolvedValue({ ok: true });
    render(<ResetPasswordForm token="t-1" demo={null} />);
    await userEvent.type(screen.getByLabelText("New password"), "a-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Your password is set. Sign in with it now.",
    );
    expect(mocks.resetPassword).toHaveBeenCalledWith("t-1", "a-long-password");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  });

  it("an expired or used link says so once and points at a new one", async () => {
    mocks.resetPassword.mockResolvedValue(gone);
    render(<ResetPasswordForm token="used" demo={null} />);
    await userEvent.type(screen.getByLabelText("New password"), "a-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect((await screen.findByRole("alert")).textContent).toBe(LINK_EXPIRED);
    expect(screen.getByRole("link", { name: "Ask for a new link" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
  });

  it("with no token in the link, says it is incomplete (not expired) and shows no form", () => {
    render(<ResetPasswordForm token={null} demo={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Link incomplete" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(LINK_INCOMPLETE);
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("link", { name: "Ask for a new link" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
  });

  it("a service that is down gets the sorry sentence; offline blocks the button", async () => {
    mocks.resetPassword.mockResolvedValue({
      ok: false,
      code: "unavailable",
      message: SIGN_IN_FAILED,
      issues: [],
    });
    render(<ResetPasswordForm token="t-1" demo={null} />);
    await userEvent.type(screen.getByLabelText("New password"), "a-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't set your password. Try again.");
    cleanup();
    render(<ResetPasswordForm token="t-1" demo="offline" />);
    expect(screen.getByText(/Needs connection/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Set password" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Verify email", () => {
  it("checks the link once, even when React runs the effect twice, then goes where the service says", async () => {
    mocks.verifyEmail.mockResolvedValue({ ok: true, next: "/onboarding" });
    render(
      <StrictMode>
        <VerifyEmail token="t-1" demo={null} />
      </StrictMode>,
    );
    expect(screen.getByRole("status").textContent).toContain("Checking your link");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/onboarding"));
    expect(mocks.verifyEmail).toHaveBeenCalledTimes(1);
    expect(mocks.verifyEmail).toHaveBeenCalledWith("t-1");
  });

  it("an expired or used link says so and offers Sign in", async () => {
    mocks.verifyEmail.mockResolvedValue(gone);
    render(<VerifyEmail token="used" demo={null} />);
    expect((await screen.findByRole("alert")).textContent).toBe(LINK_EXPIRED);
    expect(screen.getByRole("heading", { level: 1, name: "Link expired" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ask for a new link" }).getAttribute("href")).toBe("/sign-in");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("with no token, says the link is incomplete without asking the service", () => {
    render(<VerifyEmail token={null} demo={null} />);
    expect(screen.getByRole("alert").textContent).toBe(LINK_INCOMPLETE);
    // A page-level note is body size in ink with an icon; red meta is for a field's own error (auth i2 D24).
    const note = screen.getByRole("alert");
    expect(note.className).toContain("text-body");
    expect(note.className).toContain("text-ink");
    expect(note.className).not.toContain("text-over");
    expect(note.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Link incomplete" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ask for a new link" })).toBeTruthy();
    expect(mocks.verifyEmail).not.toHaveBeenCalled();
  });

  it("a service that is down gets the sorry sentence and Try again, which asks again", async () => {
    mocks.verifyEmail.mockResolvedValueOnce({
      ok: false,
      code: "unavailable",
      message: SIGN_IN_FAILED,
      issues: [],
    });
    mocks.verifyEmail.mockResolvedValueOnce({ ok: true, next: "/" });
    render(<VerifyEmail token="t-1" demo={null} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't check your link. Try again.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  });

  it("the demo states: loading stays busy, offline says Needs connection, error shows the sorry sentence; none ask the service", () => {
    render(<VerifyEmail token="t-1" demo="loading" />);
    expect(screen.getByRole("status").textContent).toContain("Checking your link");
    cleanup();
    render(<VerifyEmail token="t-1" demo="offline" />);
    expect(screen.getByText(/Needs connection/)).toBeTruthy();
    cleanup();
    render(<VerifyEmail token="t-1" demo="error" />);
    expect(screen.getByRole("alert").textContent).toBe("Couldn't check your link. Try again.");
    expect(mocks.verifyEmail).not.toHaveBeenCalled();
  });
});
