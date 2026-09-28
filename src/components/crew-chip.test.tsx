// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrewChip } from "./crew-chip";

describe("CrewChip", () => {
  it("starts unpressed and toggles aria-pressed on tap", async () => {
    const user = userEvent.setup();
    render(<CrewChip name="Sam" basis="Day" />);
    const chip = screen.getByRole("button", { name: /sam/i });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onPressedChange with the new value", async () => {
    const user = userEvent.setup();
    const values: boolean[] = [];
    render(<CrewChip name="Tom" basis="Hourly" onPressedChange={(p) => values.push(p)} />);
    await user.click(screen.getByRole("button", { name: /tom/i }));
    expect(values).toEqual([true]);
  });

  it("shows the usual basis label, never a rate or amount", () => {
    render(<CrewChip name="Dima" basis="m²" />);
    expect(screen.getByText("m²")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("can start pressed via defaultPressed", () => {
    render(<CrewChip name="Jake" basis="Day" defaultPressed />);
    expect(screen.getByRole("button", { name: /jake/i })).toHaveAttribute("aria-pressed", "true");
  });
});
