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
  it("hours mode steps by 0.25 h (25 hundredths) and displays via format.ts", async () => {
    const user = userEvent.setup();
    render(<Controlled mode="hours" initial={700} label="Sam's hours" />);
    expect(screen.getByText("7 h")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase Sam's hours" }));
    expect(screen.getByText("7.25 h")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Decrease Sam's hours" }));
    await user.click(screen.getByRole("button", { name: "Decrease Sam's hours" }));
    expect(screen.getByText("6.75 h")).toBeInTheDocument();
  });

  it("hours mode respects a minimum bound", async () => {
    const user = userEvent.setup();
    render(<Controlled mode="hours" initial={0} min={0} label="Jake's hours" />);
    const minus = screen.getByRole("button", { name: "Decrease Jake's hours" });
    expect(minus).toBeDisabled();
    await user.click(minus);
    expect(screen.getByText("0 h")).toBeInTheDocument();
  });

  it("hours mode respects a maximum bound", () => {
    render(<Controlled mode="hours" initial={2400} max={2400} label="Lee's hours" />);
    expect(screen.getByRole("button", { name: "Increase Lee's hours" })).toBeDisabled();
  });

  it("days mode toggles between a full day (100) and a half day (50)", async () => {
    const user = userEvent.setup();
    render(<Controlled mode="days" initial={100} label="Tom's day" />);
    expect(screen.getByText("1 day")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Decrease Tom's day" }));
    expect(screen.getByText("½ day")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease Tom's day" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Increase Tom's day" }));
    expect(screen.getByText("1 day")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase Tom's day" })).toBeDisabled();
  });

  it("the value is in an aria-live region so screen readers hear each change", () => {
    render(<Controlled mode="hours" initial={700} label="Sam's hours" />);
    expect(screen.getByText("7 h")).toHaveAttribute("aria-live", "polite");
  });
});
