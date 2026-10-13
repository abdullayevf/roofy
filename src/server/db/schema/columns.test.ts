import { describe, expect, it } from "vitest";
import * as schema from "./index";
import { allOf } from "./columns";

type Colour = "red" | "green" | "blue";

describe("allOf", () => {
  it("returns the exact list it is given", () => {
    expect(allOf<Colour>()(["red", "green", "blue"])).toEqual(["red", "green", "blue"]);
  });

  it("fails the build when a value of the union is missing or extra", () => {
    // @ts-expect-error "blue" is missing, so the list does not cover Colour.
    allOf<Colour>()(["red", "green"]);
    // @ts-expect-error "pink" is not a Colour.
    allOf<Colour>()(["red", "green", "blue", "pink"]);
    expect(true).toBe(true);
  });

  it("every pgEnum lists each of its values once", () => {
    const enums = Object.values(schema as Record<string, unknown>).filter(
      (v): v is { enumValues: string[] } => typeof v === "function" && "enumValues" in v,
    );
    expect(enums.length).toBeGreaterThanOrEqual(11);
    for (const e of enums) expect(new Set(e.enumValues).size).toBe(e.enumValues.length);
  });
});
