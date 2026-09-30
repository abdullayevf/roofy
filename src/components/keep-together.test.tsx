import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { keepAmountsTogether } from "@/lib/text";
import { KeepTogether } from "./keep-together";

describe("KeepTogether", () => {
  it("keeps the text as it is, in the same order", () => {
    const { container } = render(<KeepTogether text="Clean-up is $100.00 over its labour budget." />);
    expect(container.textContent).toBe(keepAmountsTogether("Clean-up is $100.00 over its labour budget."));
  });
  it("wraps a hyphenated word in a no-break span", () => {
    const { container } = render(<KeepTogether text="Re-bed & re-point is late." />);
    expect([...container.querySelectorAll("span")].map((s) => s.textContent)).toEqual(["Re-bed", "re-point"]);
  });
  it("leaves a plain sentence without spans", () => {
    const { container } = render(<KeepTogether text="Sheet install is late." />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});
