// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TwoFactorSetup } from "@/data/contracts";
import { TwoFactorForm } from "./settings-forms";

const refresh = vi.fn();
const startTwoFactor = vi.fn();
const turnOnTwoFactor = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/settings", () => ({
  saveLevel: async () => ({ ok: true }),
  updateSettings: async () => ({ ok: true }),
  startTwoFactor: (...args: unknown[]) => startTwoFactor(...args),
  turnOnTwoFactor: (...args: unknown[]) => turnOnTwoFactor(...args),
}));

const SETUP: TwoFactorSetup = {
  secret: "RFY4 7KQ2 MZTD 3XWB",
  uri: "otpauth://totp/Roofy:karen%40harbourroofing.example?secret=RFY47KQ2MZTD3XWB&issuer=Roofy",
};
const QR = { name: "Scan this with your authenticator app" };

beforeEach(() => {
  refresh.mockClear();
  startTwoFactor.mockReset();
  turnOnTwoFactor.mockReset();
  turnOnTwoFactor.mockResolvedValue({ ok: true, twoFactorEnabled: true });
});

describe("TwoFactorForm with the key already on the page (prototype)", () => {
  it("shows the QR code, the set-up key to type, and the code box, with no password step", () => {
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    expect(screen.getByRole("img", QR)).toBeVisible();
    expect(screen.getByText("RFY4 7KQ2 MZTD 3XWB")).toBeVisible();
    expect(screen.getByLabelText("Code")).toBeVisible();
    expect(screen.queryByLabelText("Your password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show QR code" })).toBeNull();
  });

  it("a code that is not 6 digits is refused where it is typed and nothing is sent", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    await user.type(screen.getByLabelText("Code"), "12ab");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("Enter the 6-digit code from your app.")).toBeVisible();
    expect(turnOnTwoFactor).not.toHaveBeenCalled();
  });

  it("sends the 6 digits; a wrong code from the server shows its sentence on the Code field", async () => {
    const user = userEvent.setup();
    turnOnTwoFactor.mockResolvedValue({
      ok: false,
      code: "invalid",
      message: "That code doesn't match.",
      issues: [{ field: "code", message: "That code doesn't match. Check your app and try again." }],
    });
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    await user.type(screen.getByLabelText("Code"), "000000");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("That code doesn't match. Check your app and try again.")).toBeVisible();
    expect(turnOnTwoFactor).toHaveBeenCalledWith("000000");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a right code re-reads the page so the on state takes the form's place", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    await user.type(screen.getByLabelText("Code"), "482913");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(turnOnTwoFactor).toHaveBeenCalledWith("482913");
  });
});

describe("TwoFactorForm that asks for the password first (real sign-in)", () => {
  it("shows the password step and no QR code yet", () => {
    render(<TwoFactorForm demoOffline={false} setup={null} />);
    expect(screen.getByLabelText("Your password")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show QR code" })).toBeEnabled();
    expect(screen.queryByRole("img", QR)).toBeNull();
  });

  it("a blank password is refused before anything is sent", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={null} />);
    await user.click(screen.getByRole("button", { name: "Show QR code" }));
    expect(await screen.findByText("Enter your password to see the QR code.")).toBeVisible();
    expect(startTwoFactor).not.toHaveBeenCalled();
  });

  it("a wrong password shows the server's sentence and no QR code", async () => {
    const user = userEvent.setup();
    startTwoFactor.mockResolvedValue({
      ok: false,
      code: "invalid",
      message: "That password doesn't match. Check it and try again.",
      issues: [{ field: "password", message: "That password doesn't match. Check it and try again." }],
    });
    render(<TwoFactorForm demoOffline={false} setup={null} />);
    await user.type(screen.getByLabelText("Your password"), "nope-nope");
    await user.click(screen.getByRole("button", { name: "Show QR code" }));
    expect(await screen.findByText("That password doesn't match. Check it and try again.")).toBeVisible();
    expect(startTwoFactor).toHaveBeenCalledWith("nope-nope");
    expect(screen.queryByRole("img", QR)).toBeNull();
  });

  it("a right password swaps in the QR code, the key and the code box", async () => {
    const user = userEvent.setup();
    startTwoFactor.mockResolvedValue({ ok: true, setup: SETUP });
    render(<TwoFactorForm demoOffline={false} setup={null} />);
    await user.type(screen.getByLabelText("Your password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Show QR code" }));
    expect(await screen.findByRole("img", QR)).toBeVisible();
    expect(screen.getByText("RFY4 7KQ2 MZTD 3XWB")).toBeVisible();
    expect(screen.getByLabelText("Code")).toBeVisible();
    expect(screen.queryByLabelText("Your password")).toBeNull();
  });

  it("a service that is down says so in plain words and keeps the password step", async () => {
    const user = userEvent.setup();
    startTwoFactor.mockRejectedValue(new Error("down"));
    render(<TwoFactorForm demoOffline={false} setup={null} />);
    await user.type(screen.getByLabelText("Your password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Show QR code" }));
    expect(await screen.findByText(/couldn't|could not|try again/i)).toBeVisible();
    expect(screen.queryByRole("img", QR)).toBeNull();
  });

  it("offline, Show QR code is off and says it needs a connection", () => {
    render(<TwoFactorForm demoOffline setup={null} />);
    expect(screen.getByRole("button", { name: /Show QR code/ })).toBeDisabled();
    expect(screen.getByText(/Needs connection/i)).toBeVisible();
  });
});
