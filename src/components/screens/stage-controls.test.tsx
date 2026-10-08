// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StageActions } from "@/data/contracts";
import { StageControls, type StageControlsProps } from "./stage-controls";

const refresh = vi.fn();
const submit = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/stages", () => ({ startStage: async () => ({ ok: true }), reopenStage: async () => ({ ok: true }) }));
vi.mock("@/offline/submit", () => ({ submit: (...args: unknown[]) => submit(...args) }));

const actions: StageActions = { canStart: false, canPause: true, canResume: true, canMarkDone: true, canReopen: false, canSetManualPct: false };
const base: StageControlsProps = { stageId: "s1", jobId: "p1", status: "active", pauseReason: null, longPauseDays: null, actions, today: "2026-09-28" };
const status = (c: HTMLElement) => c.querySelector("[data-stage-controls]")!.getAttribute("data-status");

// The sheet picks its desktop dialog (not the phone drawer, which needs drag APIs jsdom lacks) from matchMedia.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 1024px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  refresh.mockClear();
  submit.mockReset();
});

async function pauseForWeather(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Pause stage" }));
  await user.click(await screen.findByRole("button", { name: "Weather" }));
}

describe("StageControls keeps the phone's answer only until the server speaks", () => {
  it("a pause that could not send yet shows Paused and the waiting note", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "retry" });
    const { container } = render(<StageControls {...base} />);
    await pauseForWeather(user);
    expect(status(container)).toBe("paused");
    expect(await screen.findByText("Saved on this device. It will send when you have signal.")).toBeInTheDocument();
  });

  it("once the server shows the new status, the waiting note goes", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "retry" });
    const { container, rerender } = render(<StageControls {...base} />);
    await pauseForWeather(user);
    await screen.findByText("Saved on this device. It will send when you have signal.");
    rerender(<StageControls {...base} status="paused" pauseReason="weather" />);
    expect(status(container)).toBe("paused");
    expect(screen.queryByText("Saved on this device. It will send when you have signal.")).not.toBeInTheDocument();
  });

  it("if someone else later restarts the stage, it shows Active again, not the old pause", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "applied" });
    const { container, rerender } = render(<StageControls {...base} />);
    await pauseForWeather(user);
    rerender(<StageControls {...base} status="paused" pauseReason="weather" />);
    rerender(<StageControls {...base} status="active" />);
    expect(status(container)).toBe("active");
    expect(screen.getByRole("button", { name: "Pause stage" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume stage" })).not.toBeInTheDocument();
  });

  it("an answer from the server clears the waiting note from an earlier try", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValueOnce({ status: "retry" }).mockResolvedValueOnce({ status: "applied" });
    render(<StageControls {...base} />);
    await pauseForWeather(user);
    await screen.findByText("Saved on this device. It will send when you have signal.");
    await user.click(screen.getByRole("button", { name: "Resume stage" }));
    expect(screen.queryByText("Saved on this device. It will send when you have signal.")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
