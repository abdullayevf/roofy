// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  INVITE_FAILED,
  INVITE_LOAD_FAILED,
  INVITE_GONE,
  INVITE_OTHER_EMAIL,
  TOO_MANY_TRIES,
  TWO_FACTOR_CODE,
  TWO_FACTOR_FAILED,
  WRONG_CODE,
} from "@/lib/auth-input";
import { InviteJoin } from "./invite-join";
import { OnboardingNoAccess } from "./onboarding-no-access";
import { TwoFactorStep } from "./two-factor-step";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  verifyTwoFactor: vi.fn(),
  acceptInvite: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/app/actions/auth", () => ({
  verifyTwoFactor: mocks.verifyTwoFactor,
  acceptInvite: mocks.acceptInvite,
}));
vi.mock("@/app/actions/sign-out", () => ({ signOut: mocks.signOut }));

const refused = (message: string, code: "invalid" | "unavailable" = "invalid") => ({
  ok: false as const,
  code,
  message,
  issues: [],
});
const ready = { kind: "ready", invite: { workspaceName: "Harbour Roofing", role: "foreman" } } as const;

beforeEach(() => {
  cleanup();
  // reset, not clear: a mockResolvedValueOnce a test never used must not answer the next test's call.
  vi.resetAllMocks();
});

describe("Two-factor step", () => {
  it("has a Check code button and asks for 6 digits before it asks the service", async () => {
    render(<TwoFactorStep demo={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect(screen.getByText(TWO_FACTOR_CODE)).toBeTruthy();
    expect(mocks.verifyTwoFactor).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Code"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect(screen.getByText(TWO_FACTOR_CODE)).toBeTruthy();
    expect(mocks.verifyTwoFactor).not.toHaveBeenCalled();
  });

  it("sends the trimmed code and goes where the service says", async () => {
    mocks.verifyTwoFactor.mockResolvedValue({ ok: true, next: "/" });
    render(<TwoFactorStep demo={null} />);
    await userEvent.type(screen.getByLabelText("Code"), " 482913 ");
    await userEvent.click(screen.getByRole("button", { name: "Check code" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(mocks.verifyTwoFactor).toHaveBeenCalledWith("482913");
  });

  it("a wrong code marks the box; too many tries and an outage are one alert each", async () => {
    mocks.verifyTwoFactor.mockResolvedValueOnce(refused(WRONG_CODE));
    render(<TwoFactorStep demo={null} />);
    await userEvent.type(screen.getByLabelText("Code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect(await screen.findByText(WRONG_CODE)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    // The message and the end of "Checking code" are two renders; a click while the button is still busy asks nothing.
    await waitFor(() => expect((screen.getByRole("button", { name: "Check code" }) as HTMLButtonElement).disabled).toBe(false));
    mocks.verifyTwoFactor.mockResolvedValueOnce(refused("boom", "unavailable"));
    await userEvent.click(screen.getByRole("button", { name: "Check code" }));
    await waitFor(() => expect(mocks.verifyTwoFactor).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(TWO_FACTOR_FAILED));
    // The alert and the end of "Checking code" are two renders; wait for the button rather than assume they land together.
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("too many tries clears the box and turns the button off for the wait (auth i1 D18)", async () => {
    mocks.verifyTwoFactor.mockResolvedValueOnce(refused(TOO_MANY_TRIES));
    render(<TwoFactorStep demo={null} />);
    await userEvent.type(screen.getByLabelText("Code"), "111111");
    await userEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect((await screen.findByRole("alert")).textContent).toContain(TOO_MANY_TRIES);
    const button = (await screen.findByRole("button", { name: /Try again in 60 s/ })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe("");
    expect(mocks.verifyTwoFactor).toHaveBeenCalledTimes(1);
  });

  it("has its own heading, and Back to sign in sits on the left", () => {
    render(<TwoFactorStep demo={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Enter your code" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to sign in" }).parentElement?.className ?? "",
    ).not.toContain("text-center");
  });

  it("offline shows Needs connection alone and does not ask; the error demo refuses without asking", async () => {
    const { unmount } = render(<TwoFactorStep demo="offline" />);
    expect(screen.getByText(/Needs connection/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Check code" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/Needs connection/)).toHaveLength(1);
    unmount();
    render(<TwoFactorStep demo="error" />);
    // The error shows on arrival, with the button reading Try again.
    expect(screen.getByRole("alert").textContent).toContain(TWO_FACTOR_FAILED);
    // The typed code is still in the box, so Try again never sits over an empty one (auth i2 D26 + F19).
    expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe("482913");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert").textContent).toContain(TWO_FACTOR_FAILED);
    expect(mocks.verifyTwoFactor).not.toHaveBeenCalled();
  });
});

describe("Join team", () => {
  it("names the team and the role, with a Join team button", () => {
    render(<InviteJoin id="abc" view={ready} demo={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Join Harbour Roofing" })).toBeTruthy();
    expect(screen.getByText(/as a foreman/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join team" })).toBeTruthy();
  });

  it("joins with the invite id and goes where the service says", async () => {
    mocks.acceptInvite.mockResolvedValue({ ok: true, next: "/" });
    render(<InviteJoin id="abc" view={ready} demo={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Join team" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(mocks.acceptInvite).toHaveBeenCalledWith("abc");
  });

  it("an invite that went stale while the page was open becomes the expired message with a way to sign in", async () => {
    mocks.acceptInvite.mockResolvedValue(refused(INVITE_GONE));
    render(<InviteJoin id="abc" view={ready} demo={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Join team" }));
    expect((await screen.findByRole("alert")).textContent).toContain(INVITE_GONE);
    expect(screen.queryByRole("button", { name: "Join team" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  });

  it("signed out, the invite offers Sign in and Create an account, both coming back to the invite", () => {
    render(<InviteJoin id="abc" view={{ kind: "sign-in", message: "Sign in first." }} demo={null} />);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?next=%2Finvite%2Fabc");
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe(
      "/sign-up?next=%2Finvite%2Fabc",
    );
  });

  it("an invite for another email says so and signs in again coming back to the invite; an expired one just signs in", () => {
    render(<InviteJoin id="abc" view={{ kind: "gone", message: INVITE_OTHER_EMAIL }} demo={null} />);
    expect(screen.getByRole("alert").textContent).toContain("different email");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?next=%2Finvite%2Fabc");
    expect(screen.queryByRole("link", { name: "Create an account" })).toBeNull();
    cleanup();
    render(<InviteJoin id="abc" view={{ kind: "gone", message: INVITE_GONE }} demo={null} />);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  });

  it("a cancelled invite shows its sentence and no Join team button", () => {
    render(<InviteJoin id="abc" view={{ kind: "gone", message: INVITE_GONE }} demo={null} />);
    expect(screen.getByRole("alert").textContent).toContain(INVITE_GONE);
    expect(screen.getByRole("heading", { level: 1, name: "This invite can't be used" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Join team" })).toBeNull();
  });

  it("an invite that would not load says so with Try again (auth i1 D3)", () => {
    render(<InviteJoin id="abc" view={{ kind: "failed" }} demo="error" />);
    expect(screen.getByRole("alert").textContent).toBe(INVITE_LOAD_FAILED);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Join team" })).toBeNull();
  });

  it("an outage is the sorry sentence; offline blocks the button", async () => {
    mocks.acceptInvite.mockResolvedValue(refused("boom", "unavailable"));
    const { unmount } = render(<InviteJoin id="abc" view={ready} demo={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Join team" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(INVITE_FAILED));
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    unmount();
    render(<InviteJoin id="abc" view={ready} demo="offline" />);
    expect((screen.getByRole("button", { name: "Join team" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Needs connection/)).toBeTruthy();
  });
});

describe("Owner still setting up", () => {
  it("says so in one sentence and offers one way out: Sign out", () => {
    render(<OnboardingNoAccess />);
    expect(
      screen.getByRole("heading", { level: 1, name: "The owner is still setting this up" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Sign out"]);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
