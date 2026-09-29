// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Segmented } from "./segmented";

const OPTIONS = [
  { value: "crew-day", label: "Crew day" },
  { value: "progress", label: "Progress" },
  { value: "no-work", label: "No work" },
];

describe("Segmented", () => {
  it("marks the selected segment with the tape selection treatment, never chalk", () => {
    render(<Segmented legend="Log entry type" name="t" options={OPTIONS} defaultValue="progress" />);
    const selected = screen.getByText("Progress").closest("label")!;
    expect(selected.className).toContain("bg-tape");
    expect(selected.className).toContain("text-on-tape");
    expect(selected.className).not.toContain("bg-chalk");
    expect(selected.querySelector("svg")).toBeInTheDocument();
    const other = screen.getByText("Crew day").closest("label")!;
    expect(other.className).not.toContain("bg-tape");
    expect(other.querySelector("svg")).not.toBeInTheDocument();
  });

  it("moves the selection when another segment is chosen", async () => {
    render(<Segmented legend="Log entry type" name="t" options={OPTIONS} defaultValue="progress" />);
    await userEvent.click(screen.getByLabelText("No work"));
    expect(screen.getByText("No work").closest("label")!.className).toContain("bg-tape");
    expect(screen.getByText("Progress").closest("label")!.className).not.toContain("bg-tape");
  });
});
