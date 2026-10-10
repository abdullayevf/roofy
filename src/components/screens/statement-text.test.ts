import { describe, expect, it } from "vitest";
import { CONTRACTOR_FOOTER, statementBalance, statementPaidLabel, statementEarlier, statementFooter, statementPayoutText } from "./statement-text";

describe("crew statement text (pay rules §16)", () => {
  it("contractors get the footer, word for word; employees get none", () => {
    expect(CONTRACTOR_FOOTER).toBe("This is a statement. It is not a tax invoice. Please send your invoice as usual.");
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
    expect(statementEarlier(180_000)).toEqual({ label: "Owed from earlier", cents: 180_000 });
    expect(statementEarlier(0)).toEqual({ label: "Owed from earlier", cents: 0 });
    expect(statementEarlier(-30_000)).toEqual({ label: "Paid ahead earlier", cents: 30_000 });
    expect(statementBalance(0)).toEqual({ label: "Nothing owed", cents: 0 });
  });
  it("N6: payouts after the period say so, with the last date", () => {
    const period = { start: "2026-09-14", end: "2026-09-20" };
    expect(statementPaidLabel(period, [{ date: "2026-09-18" }], "2026-09-28")).toBe("Paid to you");
    expect(statementPaidLabel(period, [{ date: "2026-09-18" }, { date: "2026-09-21" }], "2026-09-28")).toBe("Paid to you up to Mon\u00a021\u00a0Sep");
  });
});
