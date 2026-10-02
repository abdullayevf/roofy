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
    const seen: Array<number | null | "unreadable"> = [];
    render(<MoneyField label="Amount" onCentsChange={(c) => seen.push(c)} />);
    await user.type(screen.getByLabelText("Amount"), "$1,482.5");
    await user.tab();
    expect(seen.at(-1)).toBe(148250);
    expect(screen.getByLabelText("Amount")).toHaveValue("1,482.50");
  });

  it("says how to fix an amount it can't read, and reports it as unreadable (not blank) with the text", async () => {
    const user = userEvent.setup();
    const seen: Array<[number | null | "unreadable", string]> = [];
    render(<MoneyField label="Amount" onCentsChange={(c, text) => seen.push([c, text])} />);
    await user.type(screen.getByLabelText("Amount"), "12.345");
    await user.tab();
    expect(screen.getByText("Enter an amount in dollars and cents, like 1,482.00.")).toBeInTheDocument();
    expect(seen.at(-1)).toEqual(["unreadable", "12.345"]);
  });

  it("reports a cleared field as blank (null)", async () => {
    const user = userEvent.setup();
    const seen: Array<number | null | "unreadable"> = [];
    render(<MoneyField label="Amount" defaultCents={100} onCentsChange={(c) => seen.push(c)} />);
    await user.clear(screen.getByLabelText("Amount"));
    await user.tab();
    expect(seen.at(-1)).toBeNull();
  });

  it("opens again on text it couldn't read, with the error still showing", () => {
    render(<MoneyField label="Amount" defaultCents={0} defaultText="1.2.3" />);
    expect(screen.getByLabelText("Amount")).toHaveValue("1.2.3");
    expect(screen.getByText("Enter an amount in dollars and cents, like 1,482.00.")).toBeInTheDocument();
  });

  it("formats a starting value", () => {
    render(<MoneyField label="Amount" defaultCents={148200} />);
    expect(screen.getByLabelText("Amount")).toHaveValue("1,482.00");
  });
});

describe("MoneyField negative", () => {
  it("puts the minus before the $ (formatMoney's convention)", () => {
    const { container } = render(<MoneyField label="Adjustment" defaultCents={-148200} />);
    expect(container.textContent).toContain("−$");
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("1,482.00");
  });
});
