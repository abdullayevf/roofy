// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "./field";

describe("Field", () => {
  it("renders a label above the input", () => {
    render(<Field label="Total" inputMode="decimal" />);
    expect(screen.getByLabelText("Total")).toBeInTheDocument();
  });

  it("links the error message to the input via aria-describedby", () => {
    render(<Field label="Total" inputMode="decimal" error="Add a total before saving." />);
    const input = screen.getByLabelText("Total");
    const message = screen.getByText("Add a total before saving.");
    expect(input).toHaveAttribute("aria-describedby", message.id);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("links a hint (not an error) the same way when there is no error", () => {
    render(<Field label="ABN" inputMode="numeric" hint="11 digits" />);
    const input = screen.getByLabelText("ABN");
    const hint = screen.getByText("11 digits");
    expect(input).toHaveAttribute("aria-describedby", hint.id);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("passes the required inputMode through to the underlying input", () => {
    render(<Field label="Hours" inputMode="numeric" />);
    expect(screen.getByLabelText("Hours")).toHaveAttribute("inputmode", "numeric");
  });
});

describe("aria-describedby only references ids that render", () => {
  it("Field with hint and error", async () => {
    const { Field: F } = await import("./field");
    const { container } = render(<F label="Total" inputMode="decimal" hint="Optional" error="Add a total." />);
    const ids = (container.querySelector("input")!.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
  });

  it("Select with hint and error", async () => {
    const { Select } = await import("./select");
    const { container } = render(
      <Select label="Type" options={[{ value: "a", label: "A" }]} hint="Optional" error="Pick one." />,
    );
    const ids = (container.querySelector("select")!.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
  });
});
