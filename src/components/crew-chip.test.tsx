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

  it("shows the inline half-day toggle only while ticked", async () => {
    const user = userEvent.setup();
    render(<CrewChip name="Sam" basis="Day" exception="half-day" />);
    expect(screen.queryByRole("radio", { name: "½ day" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sam/i }));
    expect(screen.getByRole("radio", { name: "½ day" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "½ day" }));
    expect(screen.getByRole("radio", { name: "½ day" })).toBeChecked();
  });

  it("shows an hours stepper as the exception for an hourly worker, holding its own value", async () => {
    const user = userEvent.setup();
    render(<CrewChip name="Tom" basis="Hourly" exception="hours" defaultPressed />);
    expect(screen.getByText("6.5 h")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Increase Tom's hours" }));
    expect(screen.getByText("6.75 h")).toBeInTheDocument();
  });

  it("shows a note line under the basis", () => {
    render(
      <CrewChip name="Jake" basis="m²" note={{ text: "Paid from progress, not this grid", tone: "info" }} />,
    );
    expect(screen.getByText("Paid from progress, not this grid")).toBeInTheDocument();
  });

  it("can start pressed via defaultPressed", () => {
    render(<CrewChip name="Jake" basis="Day" defaultPressed />);
    expect(screen.getByRole("button", { name: /jake/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("can be driven from outside: ticked state and exception value", async () => {
    const user = userEvent.setup();
    const days: number[] = [];
    render(<CrewChip name="Sam" basis="Day" exception="half-day" pressed exceptionValue={100} onExceptionChange={(v) => days.push(v)} />);
    expect(screen.getByRole("button", { name: /sam/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("radio", { name: "1 day" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "½ day" }));
    expect(days).toEqual([50]);
  });
});
