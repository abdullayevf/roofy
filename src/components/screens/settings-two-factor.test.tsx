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
const scrollIntoView = vi.fn();
const WRONG = {
  ok: false,
  code: "invalid",
  message: "That code doesn't match.",
  issues: [{ field: "code", message: "That code doesn't match. Check your app and try again." }],
};

beforeEach(() => {
  // The pinned Save bar measures itself.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom has no layout, so no scrolling: the form asks the Code field to scroll itself into view.
  Element.prototype.scrollIntoView = scrollIntoView;
  scrollIntoView.mockClear();
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

  it("offers Copy key beside the key (spaces dropped) and an Open in authenticator app link for the phone", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    expect(screen.getByRole("link", { name: "Open in authenticator app" })).toHaveAttribute(
      "href",
      SETUP.uri,
    );
    await user.click(screen.getByRole("button", { name: "Copy key" }));
    expect(writeText).toHaveBeenCalledWith("RFY47KQ2MZTD3XWB");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
  });

  it("a code that is not 6 digits is refused where it is typed and nothing is sent", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    await user.type(screen.getByLabelText("Code"), "12ab");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("Enter the 6-digit code from your app.")).toBeVisible();
    expect(turnOnTwoFactor).not.toHaveBeenCalled();
    // One message per problem (auth i2 D25 + F20): the pinned bar adds no second red line.
    expect(screen.queryByText("Check the 6-digit code and try again.")).toBeNull();
    expect(screen.getAllByText("Enter the 6-digit code from your app.")).toHaveLength(1);
    expect(screen.getByLabelText("Code")).toHaveAttribute("aria-invalid", "true");
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
    expect(screen.queryByText("Check the 6-digit code and try again.")).toBeNull();
  });

  // auth i3 F28 + D36: on a phone the Code field sits below the fold, so a refused code must bring it into view.
  it("a wrong code from the server scrolls the Code field to the middle of the screen and focuses it", async () => {
    const user = userEvent.setup();
    turnOnTwoFactor.mockResolvedValue(WRONG);
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    const code = screen.getByLabelText("Code");
    await user.type(code, "000000");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("That code doesn't match. Check your app and try again.")).toBeVisible();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(code);
    expect(code).toHaveFocus();
  });

  it("a code that is not 6 digits scrolls the Code field into view and focuses it too", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    const code = screen.getByLabelText("Code");
    await user.type(code, "12ab");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("Enter the 6-digit code from your app.")).toBeVisible();
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(code);
    expect(code).toHaveFocus();
  });

  it("scrolls on every refusal, not only the first", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("while the Code field is still off screen after the scroll, the pinned bar says what is wrong", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    const code = screen.getByLabelText("Code");
    code.getBoundingClientRect = () => ({ top: 5000, bottom: 5048, left: 0, right: 200, width: 200, height: 48 }) as DOMRect;
    await user.type(code, "12ab");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("Check the 6-digit code and try again.")).toBeVisible();
  });

  // auth i3 N1: a field under the pinned bar or the tab bar is not on screen, however high it is on the window.
  const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 200, width: 200, height: bottom - top }) as DOMRect;
  const fixedBar = (el: Element, top: number) => {
    (el as HTMLElement).style.position = "fixed";
    el.getBoundingClientRect = () => rect(top, top + 68);
  };

  it("a Code field under the pinned bar counts as off screen, so the bar says what is wrong", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    expect(window.innerHeight).toBeGreaterThan(740);
    fixedBar(document.querySelector('[data-slot="primary-action"]')!, 700);
    const code = screen.getByLabelText("Code");
    code.getBoundingClientRect = () => rect(690, 738);
    await user.type(code, "12ab");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("Check the 6-digit code and try again.")).toBeVisible();
  });

  it("a Code field under the tab bar counts as off screen too", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    const tabs = document.body.appendChild(document.createElement("nav"));
    tabs.setAttribute("aria-label", "Primary");
    fixedBar(tabs, 712);
    const code = screen.getByLabelText("Code");
    code.getBoundingClientRect = () => rect(700, 748);
    await user.type(code, "12ab");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("Check the 6-digit code and try again.")).toBeVisible();
    tabs.remove();
  });

  it("a Code field above the pinned bar is on screen, so the bar stays quiet and the field speaks", async () => {
    const user = userEvent.setup();
    render(<TwoFactorForm demoOffline={false} setup={SETUP} />);
    fixedBar(document.querySelector('[data-slot="primary-action"]')!, 700);
    const code = screen.getByLabelText("Code");
    code.getBoundingClientRect = () => rect(300, 348);
    await user.type(code, "12ab");
    await user.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByText("Enter the 6-digit code from your app.")).toBeVisible();
    expect(screen.queryByText("Check the 6-digit code and try again.")).toBeNull();
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

describe("TwoFactorForm for an account with no password (Google sign-in, review S1 + R3)", () => {
  it("has no password field; Show QR code asks for the key with a blank password and swaps in the QR code", async () => {
    const user = userEvent.setup();
    startTwoFactor.mockResolvedValue({ ok: true, setup: SETUP });
    render(<TwoFactorForm demoOffline={false} setup={null} hasPassword={false} />);
    expect(screen.queryByLabelText("Your password")).toBeNull();
    expect(screen.getByText(/signed in with Google/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show QR code" }));
    expect(startTwoFactor).toHaveBeenCalledWith("");
    expect(await screen.findByRole("img", QR)).toBeVisible();
    expect(screen.getByLabelText("Code")).toBeVisible();
  });

  it("a service that is down says so and keeps the button", async () => {
    const user = userEvent.setup();
    startTwoFactor.mockRejectedValue(new Error("down"));
    render(<TwoFactorForm demoOffline={false} setup={null} hasPassword={false} />);
    await user.click(screen.getByRole("button", { name: "Show QR code" }));
    expect(await screen.findByText(/Couldn't|try again/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Show QR code" })).toBeEnabled();
  });

  it("offline, Show QR code is off", () => {
    render(<TwoFactorForm demoOffline setup={null} hasPassword={false} />);
    expect(screen.getByRole("button", { name: "Show QR code" })).toBeDisabled();
  });
});
