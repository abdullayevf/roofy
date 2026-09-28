import { describe, expect, it } from "vitest";
import { ledgerBalance, oldestUnpaidCreditDate, unpaidTooLong, type LedgerEntry } from "./ledger";

const advance: LedgerEntry = { date: "2026-09-14", kind: "advance", amountCents: 30_000 };
const credit: LedgerEntry = { date: "2026-09-20", kind: "payrun_credit", amountCents: 178_200 };
const payment: LedgerEntry = { date: "2026-09-25", kind: "payment", amountCents: 148_200 };

describe("ledger", () => {
  it("E15.1 Dima: −$300 → +$1,782 → −$1,482 = $0.00", () => {
    expect(ledgerBalance([advance])).toBe(-30_000);
    expect(ledgerBalance([advance, credit])).toBe(148_200);
    expect(ledgerBalance([advance, credit, payment])).toBe(0);
    expect(oldestUnpaidCreditDate([advance, credit, payment])).toBeNull();
  });
  it("finds the oldest unpaid credit first-in-first-out", () => {
    const older: LedgerEntry = { date: "2026-09-13", kind: "payrun_credit", amountCents: 10_000 };
    expect(oldestUnpaidCreditDate([credit, older, advance])).toBe("2026-09-20");
    expect(oldestUnpaidCreditDate([credit, older])).toBe("2026-09-13");
  });
  it("flags balances unpaid for longer than one pay period", () => {
    expect(unpaidTooLong([advance, credit], "2026-09-28", 7)).toBe(true);
    expect(unpaidTooLong([advance, credit], "2026-09-27", 7)).toBe(false);
    expect(unpaidTooLong([advance, credit, payment], "2026-12-01", 7)).toBe(false);
  });
});
