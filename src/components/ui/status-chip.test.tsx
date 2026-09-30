// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusChip, type Status } from "./status-chip";

const ALL_STATUSES: Status[] = [
  "active",
  "paused",
  "done",
  "not-started",
  "quoted",
  "on-hold",
  "complete",
  "closed",
  "waiting",
  "sending",
  "sent",
  "needs-attention",
];

describe("StatusChip", () => {
  it.each(ALL_STATUSES)("renders an icon alongside the word for status %s", (status) => {
    render(<StatusChip status={status} />);
    // The word lives in an inner span; its parent is the chip, which also holds the icon svg.
    const chip = screen.getByText(new RegExp(".+")).parentElement;
    expect(chip?.querySelector("svg")).toBeInTheDocument();
    expect(chip?.textContent).not.toBe("");
  });

  it("plain: icon and word with no border or fill, still with the status colour", () => {
    render(<StatusChip status="waiting" plain />);
    const chip = screen.getByText("Waiting").parentElement!;
    expect(chip.querySelector("svg")).toBeInTheDocument();
    expect(chip.className).not.toMatch(/border|bg-surface|rounded/);
    expect(chip.className).toMatch(/text-ink-2/);
  });

  it("shows a pause reason alongside the Paused word", () => {
    render(<StatusChip status="paused" reason="Weather" />);
    expect(screen.getByText("Paused: Weather")).toBeInTheDocument();
  });

  it("the icon is decorative (aria-hidden) since the word already carries the meaning", () => {
    render(<StatusChip status="active" />);
    expect(screen.getByText("Active").parentElement?.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
