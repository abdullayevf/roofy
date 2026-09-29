// @vitest-environment jsdom
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "./sheet";

// matchMedia reports "not desktop", so the phone (vaul) branch renders.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Pause stage">
        <p>Choose a reason.</p>
      </Sheet>
    </div>
  );
}

describe("Sheet (phone / vaul path)", () => {
  it("moves focus in and restores it to the opener on close", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const opener = screen.getByRole("button", { name: "Open sheet" });
    await user.click(opener);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus(), { timeout: 3000 });
  });
});
