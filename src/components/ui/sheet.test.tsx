// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet, SheetPanel } from "./sheet";

// vaul picks the phone Drawer by default and relies on pointer/drag APIs
// jsdom doesn't implement; the task directs testing the desktop Radix
// Dialog path instead, which needs window.matchMedia mocked to report a
// >= 1024 px viewport.
function mockDesktopMatchMedia() {
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
}

function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Pause stage"
        primaryAction={<button type="button">Confirm pause</button>}
      >
        <p>Choose a reason.</p>
        <button type="button">Weather</button>
      </Sheet>
    </div>
  );
}

describe("Sheet (desktop / Radix Dialog path)", () => {
  beforeEach(() => {
    mockDesktopMatchMedia();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("traps focus inside the sheet while open", async () => {
    const user = userEvent.setup();
    render(<Demo />);

    const opener = screen.getByRole("button", { name: "Open sheet" });
    await user.click(opener);

    await waitFor(() => {
      expect(screen.getByText("Choose a reason.")).toBeInTheDocument();
    });

    // Focus should have moved into the dialog, not stayed on the trigger.
    await waitFor(() => {
      expect(opener).not.toHaveFocus();
    });
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByText("Choose a reason.").closest('[role="dialog"]')).toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  it("restores focus to the trigger when it closes", async () => {
    const user = userEvent.setup();
    render(<Demo />);

    const opener = screen.getByRole("button", { name: "Open sheet" });
    await user.click(opener);
    await waitFor(() => {
      expect(screen.getByText("Choose a reason.")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Choose a reason.")).not.toBeInTheDocument();
    });
    await waitFor(
      () => {
        expect(opener).toHaveFocus();
      },
      { timeout: 3000 },
    );
  });
});

describe("SheetPanel (the phone sheet's markup)", () => {
  it("has a Close control on phone too, and it calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <SheetPanel title="Pause stage" onClose={onClose}>
        <p>Body</p>
      </SheetPanel>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    // Not hidden below the desktop breakpoint: no `hidden` on it or its wrapper.
    expect(close.closest(".hidden")).toBeNull();
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a More below cue when the body is taller than its box, and not otherwise", () => {
    const size = (scrollHeight: number) =>
      vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(scrollHeight);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(200);
    size(500);
    const { unmount } = render(
      <SheetPanel title="Record payout">
        <p>Body</p>
      </SheetPanel>,
    );
    expect(screen.getByTestId("sheet-more-below")).toHaveTextContent("More below");
    unmount();
    size(200);
    render(
      <SheetPanel title="Record payout">
        <p>Body</p>
      </SheetPanel>,
    );
    expect(screen.queryByTestId("sheet-more-below")).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
