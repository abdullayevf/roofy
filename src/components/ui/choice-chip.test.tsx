// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceChip, type ChoiceChipProps } from "./choice-chip";

const REASONS = [
  { value: "weather", label: "Weather" },
  { value: "materials", label: "Waiting on materials" },
];

function Controlled(
  props: Omit<ChoiceChipProps, "value" | "onChange"> & { initial?: string; onChange?: (v: string) => void },
) {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <ChoiceChip
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
    />
  );
}

describe("ChoiceChip", () => {
  it("is a radiogroup with the given legend", () => {
    render(<Controlled legend="Reason" name="reason" options={REASONS} />);
    expect(screen.getByRole("radiogroup", { name: "Reason" })).toBeInTheDocument();
  });

  it("selecting a chip checks it and unchecks the others", async () => {
    const user = userEvent.setup();
    render(<Controlled legend="Reason" name="reason" options={REASONS} />);
    await user.click(screen.getByRole("radio", { name: "Weather" }));
    expect(screen.getByRole("radio", { name: "Weather" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Waiting on materials" })).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Waiting on materials" }));
    expect(screen.getByRole("radio", { name: "Weather" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Waiting on materials" })).toBeChecked();
  });

  it("calls onChange with the selected value", async () => {
    const user = userEvent.setup();
    const values: string[] = [];
    render(<Controlled legend="Reason" name="reason" options={REASONS} onChange={(v) => values.push(v)} />);
    await user.click(screen.getByRole("radio", { name: "Weather" }));
    expect(values).toEqual(["weather"]);
  });

  it("a disabled option cannot be selected", async () => {
    const user = userEvent.setup();
    render(
      <Controlled
        legend="Reason"
        name="reason"
        options={[{ value: "weather", label: "Weather", disabled: true }]}
      />,
    );
    const chip = screen.getByRole("radio", { name: "Weather" });
    expect(chip).toBeDisabled();
    await user.click(chip);
    expect(chip).not.toBeChecked();
  });
});
