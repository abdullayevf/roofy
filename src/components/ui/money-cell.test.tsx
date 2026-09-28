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

  it("applies the over tone class when trending over budget", () => {
    render(<MoneyCell cents={-30000} tone="over" />);
    expect(screen.getByText("−$300.00").closest("span")).toHaveClass("text-over");
  });
});
