// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

describe("Input before and after hydration (F1)", () => {
  it("is drawn read-only on the server, so typing before React attaches is never silently lost", () => {
    expect(renderToString(<Input aria-label="Email" defaultValue="" />)).toMatch(/readOnly=""|readonly=""/i);
  });

  it("takes typing once React owns the page", () => {
    render(<Input aria-label="Email" defaultValue="" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("readonly");
  });

  it("keeps a caller's own read-only", () => {
    render(<Input aria-label="Total" readOnly value="12" />);
    expect(screen.getByLabelText("Total")).toHaveAttribute("readonly");
  });
});
