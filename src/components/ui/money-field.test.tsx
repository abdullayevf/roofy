// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyField } from "./money-field";

describe("MoneyField", () => {
  it("shows a $ prefix inside the field and asks for a decimal keypad", () => {
    render(<MoneyField label="Amount" />);
    expect(screen.getByLabelText("Amount")).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("formats the value with grouping and cents on blur", async () => {
    const user = userEvent.setup();
    render(<MoneyField label="Amount" />);
    const input = screen.getByLabelText("Amount");
    await user.type(input, "1482");
    await user.tab();
    expect(input).toHaveValue("1,482.00");
  });

  it("reports integer cents, accepting a typed $ and commas", async () => {
    const user = userEvent.setup();
    const seen: Array<number | null> = [];
    render(<MoneyField label="Amount" onCentsChange={(c) => seen.push(c)} />);
    await user.type(screen.getByLabelText("Amount"), "$1,482.5");
    await user.tab();
    expect(seen.at(-1)).toBe(148250);
    expect(screen.getByLabelText("Amount")).toHaveValue("1,482.50");
  });

  it("says how to fix an amount it can't read, and reports null", async () => {
    const user = userEvent.setup();
    const seen: Array<number | null> = [];
    render(<MoneyField label="Amount" onCentsChange={(c) => seen.push(c)} />);
    await user.type(screen.getByLabelText("Amount"), "12.345");
    await user.tab();
    expect(screen.getByText("Enter an amount in dollars and cents, like 1,482.00.")).toBeInTheDocument();
    expect(seen.at(-1)).toBeNull();
  });

  it("formats a starting value", () => {
    render(<MoneyField label="Amount" defaultCents={148200} />);
    expect(screen.getByLabelText("Amount")).toHaveValue("1,482.00");
  });
});
