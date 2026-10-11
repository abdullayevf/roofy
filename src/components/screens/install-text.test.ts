import { describe, expect, it } from "vitest";
import { INSTALL_STEPS, installOrder } from "./install-text";

describe("install steps", () => {
  it("puts the detected platform first and the other two after it", () => {
    expect(installOrder("android")).toEqual({ first: "android", others: ["ios", "desktop"] });
    expect(installOrder("desktop")).toEqual({ first: "desktop", others: ["ios", "android"] });
  });
  it("every platform has steps that are one sentence each, with no jargon", () => {
    for (const { steps } of Object.values(INSTALL_STEPS)) {
      expect(steps.length).toBeGreaterThanOrEqual(3);
      for (const s of steps) expect(s).not.toMatch(/\b(PWA|sync|entity|mutation|submit)\b/i);
    }
  });
});
