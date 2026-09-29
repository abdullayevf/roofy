// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast } from "./toast";

function Demo() {
  const [open, setOpen] = useState(true);
  return <Toast open={open} onOpenChange={setOpen} message="Day saved" />;
}

describe("Toast (live Radix path)", () => {
  it("renders as a list item in Radix's list viewport with the props Radix injects", () => {
    render(<Demo />);
    const item = screen.getByText("Day saved").closest("li");
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("data-state", "open");
    expect(item).toHaveAttribute("tabindex", "0");
    expect(item!.parentElement!.tagName).toBe("OL");
  });

  it("closes on Escape (Radix handlers reach the element)", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const item = screen.getByText("Day saved").closest("li")!;
    item.focus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Day saved")).not.toBeInTheDocument());
  });
});
