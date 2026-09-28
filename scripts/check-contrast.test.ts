import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance, srgbChannelToLinear } from "./check-contrast";

describe("srgbChannelToLinear", () => {
  it("uses the linear branch at and below the 0.04045 threshold", () => {
    expect(srgbChannelToLinear(0.04045)).toBeCloseTo(0.04045 / 12.92, 10);
    expect(srgbChannelToLinear(0)).toBe(0);
  });

  it("uses the power-curve branch above the 0.04045 threshold", () => {
    const c = 0.04046;
    const powerBranch = Math.pow((c + 0.055) / 1.055, 2.4);
    expect(srgbChannelToLinear(c)).toBeCloseTo(powerBranch, 10);
  });

  it("the two branches diverge well away from the boundary", () => {
    const c = 0.5;
    const linearBranch = c / 12.92;
    expect(srgbChannelToLinear(c)).not.toBeCloseTo(linearBranch, 3);
    expect(srgbChannelToLinear(c)).toBeCloseTo(Math.pow((c + 0.055) / 1.055, 2.4), 10);
  });
});

describe("relativeLuminance", () => {
  it("is 1 for white and 0 for black", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 6);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
  });
});

describe("contrastRatio", () => {
  it("white on black (and black on white) is exactly 21", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21.0, 1);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21.0, 1);
  });

  it("DESIGN.md ink on galv (light) is ~11.3", () => {
    expect(contrastRatio("#2F3133", "#EDEFED")).toBeCloseTo(11.3, 1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#1F4FB5", "#EDEFED")).toBeCloseTo(contrastRatio("#EDEFED", "#1F4FB5"), 10);
  });

  it("accepts 3-digit hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21.0, 1);
  });
});
