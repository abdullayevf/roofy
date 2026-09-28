// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayToggle, type DayToggleProps } from "./day-toggle";

function Controlled(
  props: Omit<DayToggleProps, "value" | "onChange"> & { initial: number; onChange?: (v: number) => void },
) {
  const [value, setValue] = useState(props.initial);
  return (
    <DayToggle
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
    />
  );
}

describe("DayToggle", () => {
  it("shows 1 day and ½ day as the two options, matching the current value", () => {
    render(<Controlled initial={100} label="Tom's day" />);
    expect(screen.getByRole("radio", { name: "1 day" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "½ day" })).not.toBeChecked();
  });

  it("switches from a full day (100) to a half day (50) on tap", async () => {
    const user = userEvent.setup();
    const values: number[] = [];
    render(<Controlled initial={100} label="Tom's day" onChange={(v) => values.push(v)} />);
    await user.click(screen.getByRole("radio", { name: "½ day" }));
    expect(values).toEqual([50]);
  });

  it("switches from a half day (50) to a full day (100) on tap", async () => {
    const user = userEvent.setup();
    const values: number[] = [];
    render(<Controlled initial={50} label="Tom's day" onChange={(v) => values.push(v)} />);
    await user.click(screen.getByRole("radio", { name: "1 day" }));
    expect(values).toEqual([100]);
  });
});
