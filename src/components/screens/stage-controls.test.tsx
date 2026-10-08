// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SegmentDto, StageActions } from "@/data/contracts";
import { StageActionBar, StageLive, StageStatusLine, StageTimeline, type StageLiveProps } from "./stage-controls";

type StageControlsProps = Omit<StageLiveProps, "children" | "className" | "view"> & { segments?: SegmentDto[] };
/** The screen's live parts as stage detail puts them together: status line, timeline and the pinned bar. */
function StageControls({ segments = [], ...props }: StageControlsProps) {
  return (
    <StageLive {...props} view="manager" className="">
      <StageStatusLine />
      <StageTimeline segments={segments} />
      <StageActionBar />
    </StageLive>
  );
}

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
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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

describe("Stage detail's live parts (F1, F2, F4)", () => {
  const variant = (name: string) => screen.getByRole(name === "Mark stage done" ? "link" : "button", { name }).getAttribute("data-variant");

  it("a pause closes the open Working stretch at today and adds a Paused: Weather line at once (F2)", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: "retry" });
    render(<StageControls {...base} segments={[{ start: "2026-09-23", end: null, pauseReason: null, pauseNote: null }]} />);
    expect(screen.getByText(/^From .*23 Sep/)).toBeInTheDocument();
    await pauseForWeather(user);
    expect(screen.queryByText(/^From .*23 Sep/)).toBeNull();
    expect(screen.getByText(/23 Sep to /)).toBeInTheDocument();
    expect(screen.getAllByText("Paused: Weather"), "the chip and the timeline line").toHaveLength(2);
  });

  it("paused: Resume is the one primary and Mark stage done is secondary (F1)", () => {
    render(<StageControls {...base} status="paused" pauseReason="weather" />);
    expect(variant("Resume stage")).toBe("primary");
    expect(variant("Mark stage done")).toBe("secondary");
  });

  it("active: Mark stage done is primary and Pause is secondary", () => {
    render(<StageControls {...base} />);
    expect(variant("Mark stage done")).toBe("primary");
    expect(variant("Pause stage")).toBe("secondary");
  });

  it("offline: Mark stage done is disabled on stage detail and the bar says it needs a connection (F4)", () => {
    render(<StageControls {...base} demoOffline />);
    expect(screen.getByRole("link", { name: "Mark stage done" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/^Needs connection/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause stage" })).toBeEnabled();
  });

  it("a stage with no stretches says it is not started yet (D11)", () => {
    render(<StageControls {...base} status="not_started" actions={{ ...actions, canStart: true, canPause: false, canResume: false, canMarkDone: false }} />);
    expect(screen.getByText("Not started yet. Starts when the first day is logged.")).toBeInTheDocument();
  });
});
