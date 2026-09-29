// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper, type StepperProps } from "./stepper";

function Controlled(props: Omit<StepperProps, "value" | "onChange"> & { initial: number }) {
  const [value, setValue] = useState(props.initial);
  return <Stepper {...props} value={value} onChange={setValue} />;
}

describe("Stepper", () => {
  it("steps by 0.25 h (25 hundredths) and displays via format.ts", async () => {
    const user = userEvent.setup();
    render(<Controlled initial={700} label="Sam's hours" />);
    expect(screen.getByText("7 h")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase Sam's hours" }));
    expect(screen.getByText("7.25 h")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Decrease Sam's hours" }));
    await user.click(screen.getByRole("button", { name: "Decrease Sam's hours" }));
    expect(screen.getByText("6.75 h")).toBeInTheDocument();
  });

  it("respects a minimum bound", async () => {
    const user = userEvent.setup();
    render(<Controlled initial={0} min={0} label="Jake's hours" />);
    const minus = screen.getByRole("button", { name: "Decrease Jake's hours" });
    expect(minus).toHaveAttribute("aria-disabled", "true");
    await user.click(minus);
    expect(screen.getByText("0 h")).toBeInTheDocument();
  });

  it("respects a maximum bound", () => {
    render(<Controlled initial={2400} max={2400} label="Lee's hours" />);
    expect(screen.getByRole("button", { name: "Increase Lee's hours" })).toHaveAttribute("aria-disabled", "true");
  });

  it("the value is in an aria-live region so screen readers hear each change", () => {
    render(<Controlled initial={700} label="Sam's hours" />);
    expect(screen.getByText("7 h")).toHaveAttribute("aria-live", "polite");
  });
});

describe("Stepper focus at a bound", () => {
  it("keeps focus on the button after it reaches the bound", async () => {
    const user = userEvent.setup();
    render(<Controlled initial={50} min={25} label="Sam's hours" />);
    const dec = screen.getByRole("button", { name: "Decrease Sam's hours" });
    await user.click(dec);
    expect(screen.getByText("0.25 h")).toBeInTheDocument();
    expect(dec).toHaveFocus();
    expect(dec).toHaveAttribute("aria-disabled", "true");
    await user.click(dec);
    expect(screen.getByText("0.25 h")).toBeInTheDocument();
  });
});
