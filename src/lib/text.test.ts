import { describe, expect, it } from "vitest";
import { keepAmountsTogether } from "./text";

const NB = " ";

describe("keepAmountsTogether", () => {
  it("glues a dollar amount to the word before it", () => {
    expect(keepAmountsTogether("of $4,000.00")).toBe(`of${NB}$4,000.00`);
  });

  it("glues an amount to a trailing over/under", () => {
    expect(keepAmountsTogether("$775.00 over")).toBe(`$775.00${NB}over`);
    expect(keepAmountsTogether("$300.00 under budget")).toBe(`$300.00${NB}under budget`);
  });

  it("keeps 'forecast $4,775.00 of $4,000.00' from orphaning an amount, without chaining the whole phrase", () => {
    expect(keepAmountsTogether("$775.00 over — forecast $4,775.00 of $4,000.00")).toBe(
      `$775.00${NB}over — forecast${NB}$4,775.00 of${NB}$4,000.00`,
    );
  });

  it("treats a true-minus amount as an amount", () => {
    expect(keepAmountsTogether("Advance −$300.00 paid")).toBe(`Advance${NB}−$300.00 paid`);
  });

  it("leaves text without amounts alone", () => {
    expect(keepAmountsTogether("No log for Jake in 3 working days.")).toBe(
      "No log for Jake in 3 working days.",
    );
  });
});
