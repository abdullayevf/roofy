import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("jsdom test environment", () => {
  it("renders a button with Testing Library and asserts with jest-dom matchers", () => {
    render(<button type="button">Save</button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
