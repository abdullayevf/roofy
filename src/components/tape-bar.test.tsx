// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TapeBar, markerPosition } from "./tape-bar";

describe("TapeBar", () => {
  it("exposes progressbar aria values", () => {
    render(<TapeBar label="Sheet install progress" percent={30} />);
    const bar = screen.getByRole("progressbar", { name: "Sheet install progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "30% done");
  });

  it('prints the percent with its caption beside the bar', () => {
    render(<TapeBar label="Sheet install progress" percent={30} />);
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
  });

  it("clamps out-of-range percentages for the aria value", () => {
    render(<TapeBar label="Sheet install progress" percent={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows the forecast label at the marker when both are given", () => {
    render(
      <TapeBar
        label="Sheet install progress"
        percent={30}
        forecastPercent={119}
        forecastLabel="Forecast $4,775.00"
      />,
    );
    expect(screen.getByText("Forecast $4,775.00")).toBeInTheDocument();
  });

  it("trending over is amber with a warning icon; actually over is red with its own icon", () => {
    const { rerender } = render(<TapeBar label="Sheet install progress" percent={30} note="$775.00 over" />);
    expect(screen.getByText("$775.00 over").closest("p")).toHaveClass("text-watch");
    expect(screen.getByText("$775.00 over").closest("p")?.querySelector("svg")).toBeInTheDocument();
    rerender(<TapeBar label="Sheet install progress" percent={100} tone="over" note="$300.00 over budget" />);
    expect(screen.getByText("$300.00 over budget").closest("p")).toHaveClass("text-over");
  });

  it("has no note, marker or label when none is given (the foreman case: no money, no marker)", () => {
    const { container } = render(<TapeBar label="Sheet install progress" percent={30} />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("has no forecast label when no forecast is given (the foreman case: no money, no marker)", () => {
    render(<TapeBar label="Sheet install progress" percent={30} />);
    expect(screen.queryByText(/Forecast/)).not.toBeInTheDocument();
  });

  it("shows no label text when a forecastPercent is given without a forecastLabel", () => {
    render(<TapeBar label="Sheet install progress" percent={30} forecastPercent={119} />);
    expect(screen.queryByText(/Forecast/)).not.toBeInTheDocument();
  });

  it("keeps the caption out of the marker, so text never sits on the marker fill", () => {
    render(
      <TapeBar label="Sheet install progress" percent={30} forecastPercent={80} forecastLabel="Forecast" />,
    );
    const marker = screen.getByTestId("tape-marker");
    expect(marker).not.toContainElement(screen.getByText("Forecast"));
    expect(marker).toBeEmptyDOMElement();
  });

  it("puts the marker at the forecast point while it is within the track", () => {
    render(<TapeBar label="Sheet install progress" percent={30} forecastPercent={80} />);
    expect(screen.getByTestId("tape-marker")).toHaveStyle({ left: "80%" });
    expect(screen.queryByTestId("tape-overrun")).not.toBeInTheDocument();
  });

  it("draws an overrun past the end cap instead of pinning the marker at 100%", () => {
    render(<TapeBar label="Sheet install progress" percent={30} forecastPercent={119} />);
    const overrun = screen.getByTestId("tape-overrun");
    expect(overrun).toHaveStyle({ left: "100%" });
    expect(parseFloat(overrun.style.width)).toBeGreaterThan(0);
    expect(screen.getByTestId("tape-marker").style.left).toMatch(/^calc\(100% \+ /);
  });
});

describe("markerPosition", () => {
  it("is the forecast itself up to 100%", () => {
    expect(markerPosition(0)).toEqual({ percent: 0, overrunPx: 0 });
    expect(markerPosition(64)).toEqual({ percent: 64, overrunPx: 0 });
    expect(markerPosition(100)).toEqual({ percent: 100, overrunPx: 0 });
  });

  it("grows past the end cap with the overrun, up to a fixed maximum", () => {
    const small = markerPosition(105).overrunPx;
    const bigger = markerPosition(119).overrunPx;
    const capped = markerPosition(300).overrunPx;
    expect(small).toBeGreaterThan(0);
    expect(bigger).toBeGreaterThan(small);
    expect(capped).toBeGreaterThanOrEqual(bigger);
    expect(markerPosition(125).overrunPx).toBe(capped);
    expect(markerPosition(119).percent).toBe(100);
  });
});
