import { describe, expect, it } from "vitest";
import {
  AMOUNT_MISSING,
  AMOUNT_NEGATIVE,
  AMOUNT_UNREADABLE,
  KIND_MISSING,
  emptyPayout,
  payoutFromQuery,
  payoutInput,
  payoutProblems,
  savedToastText,
} from "./payout-input";

const TODAY = "2026-09-28";

describe("emptyPayout", () => {
  it("dates the payout today, leaves amount and Advance/Payment unset, and defaults the method to bank transfer", () => {
    expect(emptyPayout(TODAY)).toEqual({
      date: TODAY,
      amountCents: null,
      kind: "",
      method: "bank_transfer",
      note: "",
    });
  });
});

describe("payoutProblems", () => {
  const filled = { ...emptyPayout(TODAY), amountCents: 148200, kind: "payment" as const };

  it("is ready when the amount is over $0.00 and Advance or Payment is chosen", () => {
    expect(payoutProblems(filled)).toEqual({ ready: true });
  });

  it("refuses a blank amount and a $0.00 amount with the same words", () => {
    expect(payoutProblems({ ...filled, amountCents: null })).toEqual({
      ready: false,
      amount: AMOUNT_MISSING,
    });
    expect(payoutProblems({ ...filled, amountCents: 0 })).toEqual({ ready: false, amount: AMOUNT_MISSING });
    expect(AMOUNT_MISSING).toBe("Add an amount before saving.");
  });

  it("never reads unreadable text as $0.00: it is refused with its own words", () => {
    expect(payoutProblems({ ...filled, amountCents: "unreadable" })).toEqual({
      ready: false,
      amount: AMOUNT_UNREADABLE,
    });
  });

  it("a negative amount is unreadable, not missing: it asks for no minus sign and never saves", () => {
    expect(payoutProblems({ ...filled, amountCents: -148200 })).toEqual({ ready: false, amount: AMOUNT_NEGATIVE });
    expect(AMOUNT_NEGATIVE).toBe("Leave out the minus sign, like 1,482.00.");
    expect(payoutInput("c1", { ...filled, amountCents: -148200 })).toBeNull();
  });

  it("asks for Advance or Payment when neither is chosen", () => {
    expect(payoutProblems({ ...filled, kind: "" })).toEqual({ ready: false, kind: KIND_MISSING });
  });

  it("asks for a date when the date is cleared", () => {
    expect(payoutProblems({ ...filled, date: "" })).toEqual({
      ready: false,
      date: "Add the date it was paid.",
    });
  });

  it("names every missing thing at once", () => {
    expect(payoutProblems(emptyPayout(TODAY))).toEqual({
      ready: false,
      amount: AMOUNT_MISSING,
      kind: KIND_MISSING,
    });
  });
});

describe("payoutInput", () => {
  it("builds the save input in integer cents with a trimmed note (blank note is null)", () => {
    const v = {
      date: TODAY,
      amountCents: 148200,
      kind: "payment" as const,
      method: "cash" as const,
      note: "  ",
    };
    expect(payoutInput("c1", v)).toEqual({
      crewMemberId: "c1",
      date: TODAY,
      amountCents: 148200,
      kind: "payment",
      method: "cash",
      note: null,
    });
    expect(payoutInput("c1", { ...v, note: " Friday " })?.note).toBe("Friday");
  });

  it("is null while anything is missing", () => {
    expect(payoutInput("c1", emptyPayout(TODAY))).toBeNull();
  });
});

describe("payoutFromQuery", () => {
  it("is the empty form with no query", () => {
    expect(payoutFromQuery({}, TODAY)).toEqual({ values: emptyPayout(TODAY), check: false });
  });

  it("fills amount (exact cents, no float), kind, method and note, and turns on the check with check=1", () => {
    expect(
      payoutFromQuery(
        { amount: "1482.00", kind: "payment", method: "cash", note: "Friday", check: "1" },
        TODAY,
      ),
    ).toEqual({
      values: { date: TODAY, amountCents: 148200, kind: "payment", method: "cash", note: "Friday" },
      check: true,
    });
    expect(payoutFromQuery({ amount: "0.29" }, TODAY).values.amountCents).toBe(29);
  });

  it("keeps unreadable amounts unreadable and ignores unknown kinds and methods", () => {
    const { values } = payoutFromQuery({ amount: "12.3.4", kind: "loan", method: "cheque" }, TODAY);
    expect(values).toEqual({ ...emptyPayout(TODAY), amountCents: "unreadable" });
  });

  it("takes the first of repeated params", () => {
    expect(payoutFromQuery({ kind: ["advance", "payment"] }, TODAY).values.kind).toBe("advance");
  });
});

describe("savedToastText", () => {
  it("names what was saved", () => {
    expect(savedToastText("payment")).toBe("Payment saved.");
    expect(savedToastText("advance")).toBe("Advance saved.");
    expect(savedToastText(undefined)).toBeNull();
    expect(savedToastText("other")).toBeNull();
  });
});
