import { describe, expect, it } from "vitest";
import type { LedgerRow, RateDto } from "@/data/contracts";
import {
  balanceSentence,
  headerLine,
  ledgerEntry,
  phoneHref,
  rateRows,
  statementPeriodText,
  utilisationText,
} from "./crew-detail-text";

const rate = (over: Partial<RateDto>): RateDto => ({
  id: "r",
  basis: "daily",
  unit: null,
  amountCents: 32000,
  effectiveFrom: "2026-09-15",
  project: null,
  current: true,
  ...over,
});

describe("rateRows", () => {
  it("lists the current rate first and the older ones after it, newest first", () => {
    const rows = rateRows(
      [
        rate({ id: "a", amountCents: 28000, effectiveFrom: "2025-07-01", current: false }),
        rate({ id: "c", amountCents: 32000, effectiveFrom: "2026-09-15" }),
        rate({ id: "b", amountCents: 30000, effectiveFrom: "2026-07-01", current: false }),
      ],
      "2026-09-28",
    );
    expect(rows.map((r) => r.key)).toEqual(["c", "b", "a"]);
    expect(rows[0]).toMatchObject({ primary: "Daily rate", cents: 32000, meta: "From Tue 15 Sep, current" });
    expect(rows[1]?.meta).toBe("From Wed 1 Jul, replaced");
    expect(rows[2]?.meta).toBe("From Tue 1 Jul 2025, replaced");
  });

  it("names the unit and keeps a job's own rate with a note of which job", () => {
    const rows = rateRows(
      [
        rate({ id: "o", amountCents: 36000, effectiveFrom: "2026-09-01", project: { id: "p", name: "Ryde heritage" } }),
        rate({ id: "m", basis: "per_unit", unit: "m2", amountCents: 950 }),
        rate({ id: "h", basis: "hourly", amountCents: 4000 }),
        rate({ id: "d" }),
      ],
      "2026-09-28",
    );
    expect(rows.map((r) => r.primary)).toEqual(["Daily rate", "Daily rate, Ryde heritage only", "Hourly rate", "Rate per m²"]);
  });
});

describe("ledgerEntry", () => {
  const row = (over: Partial<LedgerRow>): LedgerRow => ({
    id: "l",
    date: "2026-09-21",
    kind: "advance",
    amountCents: 30000,
    method: null,
    note: null,
    payRunId: null,
    balanceAfterCents: -30000,
    ...over,
  });

  it("shows a pay run as money added to what they are owed", () => {
    const e = ledgerEntry(row({ kind: "payrun_credit", amountCents: 152000, balanceAfterCents: 152000 }), "2026-09-28");
    expect(e).toMatchObject({ primary: "Pay run", cents: 152000 });
    expect(e.meta).toBe("Mon 21 Sep. Owed $1,520.00 after");
  });

  it("shows an advance and a payment as money taken off, with the method and note", () => {
    const adv = ledgerEntry(row({ note: "Advance for fuel" }), "2026-09-28");
    expect(adv).toMatchObject({ primary: "Advance", cents: -30000 });
    expect(adv.meta).toBe("Mon 21 Sep, Advance for fuel. Paid ahead $300.00 after");
    const pay = ledgerEntry(row({ kind: "payment", method: "bank_transfer", balanceAfterCents: 0 }), "2026-09-28");
    expect(pay.primary).toBe("Payment by bank transfer");
    expect(pay.meta).toBe("Mon 21 Sep. Nothing owed after");
  });
});

describe("balanceSentence", () => {
  it("says who owes whom in plain words", () => {
    expect(balanceSentence("Dima", 148200, false)).toBe("You owe Dima this much.");
    expect(balanceSentence("Dima", 148200, true)).toBe("You have owed Dima this for a long time.");
    expect(balanceSentence("Dima", -30000, false)).toBe("You have paid Dima this much more than they have earned so far.");
    expect(balanceSentence("Dima", 0, false)).toBe("You and Dima are square.");
  });
});

describe("small lines", () => {
  it("writes the header line for an employee and a contractor", () => {
    expect(headerLine({ type: "employee", level: { name: "Roofer" }, abn: null, gstRegistered: false, activeTo: null }, "2026-09-28")).toBe("Employee · Roofer");
    expect(headerLine({ type: "contractor", level: null, abn: "51 824 753 556", gstRegistered: true, activeTo: null }, "2026-09-28")).toBe(
      "Contractor · ABN 51 824 753 556 · Charges GST",
    );
    expect(headerLine({ type: "contractor", level: null, abn: null, gstRegistered: false, activeTo: "2026-08-14" }, "2026-09-28")).toBe(
      "Contractor · No ABN yet · Left Fri 14 Aug",
    );
  });

  it("makes a phone number a tel link without the spaces", () => {
    expect(phoneHref("0412 334 101")).toBe("tel:0412334101");
    expect(phoneHref("+61 412 334 101")).toBe("tel:+61412334101");
  });

  it("writes a pay period", () => {
    expect(statementPeriodText({ start: "2026-09-14", end: "2026-09-20" }, "2026-09-28")).toBe("Mon 14 Sep to Sun 20 Sep");
  });

  it("writes how much the person worked lately, and nothing when they weren't available", () => {
    expect(utilisationText({ availableDays: 20, workedDays: 17, bp: 8500 })).toBe("Worked 17 of 20 days in the last 4 weeks");
    expect(utilisationText({ availableDays: 0, workedDays: 0, bp: null })).toBeNull();
  });
});
