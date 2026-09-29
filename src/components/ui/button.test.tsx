// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GearSix } from "@phosphor-icons/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label text", () => {
    render(<Button>Save day</Button>);
    expect(screen.getByRole("button", { name: "Save day" })).toBeInTheDocument();
  });

  it("fires onClick", async () => {
    const user = userEvent.setup();
    let clicked = 0;
    render(<Button onClick={() => (clicked += 1)}>Save day</Button>);
    await user.click(screen.getByRole("button", { name: "Save day" }));
    expect(clicked).toBe(1);
  });

  it("an icon-only button exposes its label to screen readers", () => {
    render(<Button iconOnly icon={GearSix} label="Settings" />);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("throws at runtime for an icon-only button with no label (defence in depth beyond the type check)", () => {
    // @ts-expect-error -- deliberately bypassing the discriminated union to prove the runtime guard.
    expect(() => render(<Button iconOnly icon={GearSix} />)).toThrow(/label/i);
  });

  it("is disabled while loading and keeps its box width", () => {
    render(<Button loading>Save day</Button>);
    const button = screen.getByRole("button", { hidden: true });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    // The real label stays in the DOM (just visually hidden) so the button's
    // intrinsic width is unchanged between the idle and loading states.
    expect(button).toHaveTextContent("Save day");
  });

  it("keeps a verb while loading: the loading label is what a screen reader gets", () => {
    render(
      <Button loading loadingLabel="Saving day">
        Save day
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Saving day" })).toBeDisabled();
  });

  it("disabled buttons cannot be clicked", async () => {
    const user = userEvent.setup();
    let clicked = 0;
    render(
      <Button disabled onClick={() => (clicked += 1)}>
        Save day
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Save day" }));
    expect(clicked).toBe(0);
  });

  it("disabled keeps a fixed, readable treatment regardless of variant", () => {
    render(
      <Button disabled variant="primary">
        Approve pay run
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approve pay run" });
    expect(button).toHaveClass("bg-galv", "text-ink-2", "border-line");
    expect(button.className).not.toContain("bg-chalk");
    expect(button.className).not.toContain("bg-surface");
  });

  it("shows a reason line beneath a disabled button when one is given", () => {
    render(
      <Button disabled reason="Needs connection — try again once you're back online.">
        Approve pay run
      </Button>,
    );
    expect(screen.getByText("Needs connection — try again once you're back online.")).toBeInTheDocument();
  });

  it("shows no reason line when the button isn't disabled", () => {
    render(<Button reason="This should not show.">Save day</Button>);
    expect(screen.queryByText("This should not show.")).not.toBeInTheDocument();
  });
});

describe("Button as a link", () => {
  it("renders a real link when enabled", () => {
    render(<Button href="/jobs">Open jobs</Button>);
    expect(screen.getByRole("link", { name: "Open jobs" })).toHaveAttribute("href", "/jobs");
  });

  it.each([{ disabled: true }, { loading: true }])(
    "does not navigate or sit in the tab order when %o",
    (state) => {
      render(
        <Button href="/jobs" {...state}>
          Open jobs
        </Button>,
      );
      expect(document.querySelector("a")).toBeNull();
      const el = document.querySelector("[aria-disabled]")!;
      expect(el).toHaveAttribute("aria-disabled", "true");
      expect(el).not.toHaveAttribute("href");
      expect(el.getAttribute("tabindex")).not.toBe("0");
    },
  );

  it("marks a loading link busy", () => {
    render(
      <Button href="/jobs" loading>
        Open jobs
      </Button>,
    );
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});
