import { describe, expect, it } from "vitest";
import { CONTRACTOR_FOOTER, statementBalance, statementFooter, statementPayoutText } from "./statement-text";

describe("crew statement text (pay rules §16)", () => {
  it("contractors get the footer, word for word; employees get none", () => {
    expect(CONTRACTOR_FOOTER).toBe("Statement only — not a tax invoice. Please send your invoice as usual.");
    expect(statementFooter({ contractorFooter: true })).toBe(CONTRACTOR_FOOTER);
    expect(statementFooter({ contractorFooter: false })).toBeNull();
  });

  it("a payout says what it was and how it was paid", () => {
    expect(statementPayoutText({ kind: "advance", method: "cash" })).toBe("Advance in cash");
    expect(statementPayoutText({ kind: "payment", method: "bank_transfer" })).toBe("Payment by bank transfer");
    expect(statementPayoutText({ kind: "payment", method: null })).toBe("Payment");
  });

  it("the balance after reads in words, with no sign to decode", () => {
    expect(statementBalance(12_345)).toEqual({ label: "Still owed to you", cents: 12_345 });
    expect(statementBalance(-30_000)).toEqual({ label: "Paid ahead", cents: 30_000 });
    expect(statementBalance(0)).toEqual({ label: "Nothing owed", cents: 0 });
  });
});
