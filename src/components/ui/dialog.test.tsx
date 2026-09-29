// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";

function Demo({ tone }: { tone?: "danger" }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Delete day"
        description="This cannot be undone."
        confirmLabel="Delete day"
        cancelLabel="Keep day"
        tone={tone}
      />
    </div>
  );
}

describe("Dialog", () => {
  it("moves focus inside, traps Tab, and restores focus to the opener on Escape", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const opener = screen.getByRole("button", { name: "Open dialog" });
    await user.click(opener);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("a danger dialog focuses the safe (cancel) action first", async () => {
    const user = userEvent.setup();
    render(<Demo tone="danger" />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep day" })).toHaveFocus());
  });
});
