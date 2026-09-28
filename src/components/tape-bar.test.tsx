// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TapeBar } from "./tape-bar";

describe("TapeBar", () => {
  it("exposes progressbar aria values", () => {
    render(<TapeBar label="Sheet install progress" percent={30} />);
    const bar = screen.getByRole("progressbar", { name: "Sheet install progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "30%");
  });

  it("prints the percent as text beside the bar", () => {
    render(<TapeBar label="Sheet install progress" percent={30} />);
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("clamps out-of-range percentages for the aria value", () => {
    render(<TapeBar label="Sheet install progress" percent={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("labels an optional forecast marker as Forecast", () => {
    render(<TapeBar label="Sheet install progress" percent={30} forecastPercent={120} />);
    expect(screen.getByText("Forecast")).toBeInTheDocument();
  });

  it("has no forecast label when no forecast is given", () => {
    render(<TapeBar label="Sheet install progress" percent={30} />);
    expect(screen.queryByText("Forecast")).not.toBeInTheDocument();
  });
});
