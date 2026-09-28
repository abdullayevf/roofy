import { describe, expect, it } from "vitest";
import { missingExamples } from "./check-examples";

describe("missingExamples", () => {
  it("lists spec example ids that no test mentions", () => {
    const spec = "> **E1.1** a\n> **E4.2 Equal split** b\n> **E10.1** c";
    const tests = ['it("E1.1 uses …")', 'it("E10.1 Tom …")'];
    expect(missingExamples(spec, tests)).toEqual(["E4.2"]);
  });
  it("does not treat E1.1 as covering E1.10", () => {
    expect(missingExamples("**E1.10** x", ['it("E1.1 y")'])).toEqual(["E1.10"]);
  });
  it("does not count an id that only appears in a comment", () => {
    expect(missingExamples("> **E4.2 Equal split** b", ["// E4.2 see spec"])).toEqual(["E4.2"]);
  });
});
