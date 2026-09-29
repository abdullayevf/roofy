// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoneyCell } from "./money-cell";

describe("MoneyCell", () => {
  it("renders formatMoney output for a positive amount", () => {
    render(<MoneyCell cents={143250} />);
    expect(screen.getByText("$1,432.50")).toBeInTheDocument();
  });

  it("renders a true minus for a negative amount", () => {
    render(<MoneyCell cents={-30000} />);
    expect(screen.getByText("−$300.00")).toBeInTheDocument();
  });

  it("pairs a tone with an icon and a plain word, never colour alone", () => {
    render(<MoneyCell cents={477500} tone="watch" status="$775.00 over budget" />);
    const line = screen.getByText("$775.00 over budget").parentElement;
    expect(line).toHaveClass("text-watch");
    expect(line?.querySelector("svg")).toBeInTheDocument();
  });

  it("shows no status line without a tone", () => {
    const { container } = render(<MoneyCell cents={143250} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});
