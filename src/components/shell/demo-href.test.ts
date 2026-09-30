import { describe, expect, it } from "vitest";
import { outboxHref } from "./demo-href";

describe("outboxHref", () => {
  it("keeps a known demo state on the way to the outbox", () => {
    expect(outboxHref("waiting")).toBe("/outbox?demo=waiting");
    expect(outboxHref("mixed")).toBe("/outbox?demo=mixed");
  });

  it("drops anything that is not a demo state", () => {
    for (const bad of [null, undefined, "", "nope", "//evil.example", "waiting&x=1"]) expect(outboxHref(bad)).toBe("/outbox");
  });
});
