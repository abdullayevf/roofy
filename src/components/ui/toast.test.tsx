// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast, liftClearOfPrimary } from "./toast";

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

  it("closes when a text field takes focus, so it never covers the field being typed in", async () => {
    const user = userEvent.setup();
    function WithField() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <input aria-label="Name" />
          <input aria-label="Agree" type="checkbox" />
          <Toast open={open} onOpenChange={setOpen} message="Invite sent." />
        </>
      );
    }
    render(<WithField />);
    await user.click(screen.getByLabelText("Agree"));
    expect(screen.getByText("Invite sent.")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Name"));
    await waitFor(() => expect(screen.queryByText("Invite sent.")).not.toBeInTheDocument());
  });
});

describe("a toast never covers the page's primary button (auth i2 D27 + F16)", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  function setup(button: DOMRect | null, toast: DOMRect) {
    document.body.innerHTML =
      '<style>#holder { position: fixed; bottom: 100px; }</style><ol id="holder"><li>Priya Shah removed.</li></ol>';
    const holder = document.getElementById("holder")!;
    holder.querySelector("li")!.getBoundingClientRect = () => toast;
    if (button) {
      const b = document.createElement("button");
      b.dataset.variant = "primary";
      b.getBoundingClientRect = () => button;
      document.body.append(b);
    }
    return holder;
  }

  it("lifts the holder until the toast ends above the button it sat on", () => {
    const holder = setup(rect(16, 680, 358, 52), rect(16, 690, 358, 46));
    liftClearOfPrimary(holder);
    // The toast's bottom (736) goes to the button's top (680) less an 8 px gap: up by 64 px.
    expect(holder.style.getPropertyValue("bottom")).toBe("164px");
  });

  it("leaves a toast that is already clear of the button where it is", () => {
    const holder = setup(rect(16, 500, 358, 52), rect(16, 690, 358, 46));
    liftClearOfPrimary(holder);
    expect(holder.style.getPropertyValue("bottom")).toBe("");
  });

  it("leaves a toast beside the button where it is (no horizontal overlap)", () => {
    const holder = setup(rect(300, 680, 100, 52), rect(16, 690, 200, 46));
    liftClearOfPrimary(holder);
    expect(holder.style.getPropertyValue("bottom")).toBe("");
  });

  it("does nothing on a page with no primary button", () => {
    const holder = setup(null, rect(16, 690, 358, 46));
    liftClearOfPrimary(holder);
    expect(holder.style.getPropertyValue("bottom")).toBe("");
  });
});
