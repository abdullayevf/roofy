import { describe, expect, it } from "vitest";
import type { PayFlag, PayLineDto, PayPersonGroup } from "@/data/contracts";
import { flagTarget, flagText, foldTimeOnlyLines, lineBasisText, lineLabelText, personKindLines, personTotalRows } from "./pay-review-text";

const today = "2026-09-28";
const flag = (f: Partial<PayFlag>): PayFlag => ({
  kind: "gap", blocking: false, crewMemberId: "c1", crewName: "Jake", dates: [], projectName: null, stageName: null,
  basis: null, unit: null, logIds: [], href: null, floor: null, ...f,
});
const line = (l: Partial<PayLineDto>): PayLineDto => ({
  logId: "l1", date: "2026-09-21", projectId: "p", projectName: "Smith job", stageId: "s", stageName: "Sheet install",
  basis: "hourly", unit: null, quantity: 800, hours: 800, multiplier: 100, rateCents: 2400, amountCents: 19200,
  label: "normal", missingRate: false, ...l,
});

describe("flagText", () => {
  it("words each flag as one plain sentence", () => {
    expect(flagText(flag({ kind: "missing_rate", blocking: true, basis: "per_unit", unit: "lm", dates: ["2026-09-23"], stageName: "Flashings" }), today))
      .toBe("Jake has no rate per lm for Flashings, so Wed 23 Sep pays $0.00.");
    expect(flagText(flag({ kind: "missing_rate", blocking: true, basis: "daily", dates: [] }), today)).toBe("Jake has no day rate, so it pays $0.00.");
    expect(flagText(flag({ kind: "owner_2fa_off", blocking: true, crewMemberId: null, crewName: null }), today))
      .toBe("Turn on two-factor before you approve a pay run.");
    expect(flagText(flag({ kind: "below_floor", crewName: "Tom", floor: { floorRateCents: 3200, effectiveHourlyCents: 3000, shortfallCents: 3203 } }), today))
      .toBe("Tom earns $30.00 an hour this week, under the $32.00 award floor, so Tom is $32.03 short for the week.");
    expect(flagText(flag({ kind: "double_pay", crewName: "Lee", dates: ["2026-09-23"], stageName: "Flashings" }), today))
      .toBe("Lee has time pay and output pay on Flashings on Wed 23 Sep.");
    expect(flagText(flag({ kind: "paused_stage", dates: ["2026-09-23"], stageName: "Flashings" }), today))
      .toBe("Jake is logged on Flashings on Wed 23 Sep, when the stage was paused or done.");
    expect(flagText(flag({ dates: ["2026-09-25"] }), today)).toBe("Nothing logged for Jake on Fri 25 Sep.");
    expect(flagText(flag({ dates: ["2026-09-24", "2026-09-25"] }), today)).toBe("Nothing logged for Jake on Thu 24 Sep and Fri 25 Sep.");
    expect(flagText(flag({ kind: "possible_duplicate", dates: ["2026-09-23"], stageName: "Flashings" }), today))
      .toBe("Jake may be logged twice on Flashings on Wed 23 Sep.");
    expect(flagText(flag({ kind: "no_hours" }), today)).toBe("Jake has no hours logged, so the award floor can't be checked.");
  });
});

describe("flagTarget", () => {
  it("taps through to the line, else the person, else the fix", () => {
    expect(flagTarget(flag({ logIds: ["a", "b"] }))).toBe("#line-a");
    expect(flagTarget(flag({}))).toBe("#crew-c1");
    expect(flagTarget(flag({ crewMemberId: null, href: "/settings/members" }))).toBe("/settings/members");
    expect(flagTarget(flag({ crewMemberId: null }))).toBeNull();
  });
});

describe("lineBasisText", () => {
  it("says what the line pays for", () => {
    expect(lineBasisText(line({}))).toBe("8 h at $24.00 an hour");
    expect(lineBasisText(line({ multiplier: 150 }))).toBe("8 h at $24.00 an hour × 1.5");
    expect(lineBasisText(line({ basis: "daily", quantity: 100, rateCents: 36000 }))).toBe("1 day (8 h) at $360.00 a day");
    expect(lineBasisText(line({ basis: "per_unit", unit: "m2", quantity: 6000, hours: 0, rateCents: 950 }))).toBe("60 m² at $9.50 per m²");
    expect(lineBasisText(line({ basis: "per_unit", unit: "each", quantity: 300, hours: 0, rateCents: 500 }))).toBe("3 at $5.00 each");
    expect(lineBasisText(line({ basis: "per_unit", unit: "lm", quantity: 2000, hours: 0, rateCents: null, missingRate: true }))).toBe("20 lm, no rate");
    expect(lineBasisText(line({ basis: "lump_sum", quantity: 0, hours: 0, rateCents: null }))).toBe("Share of a lump sum");
    expect(lineBasisText(line({ basis: "time_only", quantity: 0, rateCents: null, amountCents: 0 }))).toBe("8 h logged, paid by output");
  });
});

describe("lineLabelText", () => {
  it("names late entries and adjustments; the row shows the date once", () => {
    expect(lineLabelText(line({}))).toBeNull();
    expect(lineLabelText(line({ label: "late", date: "2026-09-14" }))).toBe("Late entry");
    expect(lineLabelText(line({ label: "adjustment", date: "2026-09-17" }))).toBe("Adjustment");
  });
});

const person = (p: Partial<PayPersonGroup>): PayPersonGroup => ({
  crewMemberId: "c1", name: "Dima", type: "contractor", abn: "21 435 133 679", gstRegistered: true, lines: [], reimbursements: [],
  totals: { subtotalCents: 152000, gstCents: 15200, reimbursementsCents: 11000, totalCents: 178200 }, hours: 4000, floor: null, missingRate: false, ...p,
});

describe("person groups", () => {
  it("says who they are and how they are paid", () => {
    expect(personKindLines(person({}))).toEqual(["Contractor, ABN 21 435 133 679", "Registered for GST"]);
    expect(personKindLines(person({ gstRegistered: false }))).toEqual(["Contractor, ABN 21 435 133 679", "Not registered for GST"]);
    expect(personKindLines(person({ type: "employee", abn: null, gstRegistered: false }))).toEqual(["Employee"]);
  });
  it("adds up a contractor with GST and reimbursements (E6.1, E7.1)", () => {
    expect(personTotalRows(person({}))).toEqual([
      { label: "Subtotal", cents: 152000 }, { label: "GST", cents: 15200 }, { label: "Reimbursements", cents: 11000 }, { label: "Total", cents: 178200 },
    ]);
  });
  it("shows only pay and total for an employee with nothing to reimburse", () => {
    const t = { subtotalCents: 129000, gstCents: 0, reimbursementsCents: 0, totalCents: 129000 };
    expect(personTotalRows(person({ type: "employee", gstRegistered: false, totals: t }))).toEqual([{ label: "Pay", cents: 129000 }]);
  });
  it("drops the GST row for a contractor not registered for GST, and Total when it equals Pay", () => {
    const t = { subtotalCents: 90000, gstCents: 0, reimbursementsCents: 0, totalCents: 90000 };
    expect(personTotalRows(person({ gstRegistered: false, totals: t }))).toEqual([{ label: "Pay", cents: 90000 }]);
    expect(personTotalRows(person({ gstRegistered: false, totals: { ...t, reimbursementsCents: 5000, totalCents: 95000 } }))).toEqual([
      { label: "Subtotal", cents: 90000 }, { label: "Reimbursements", cents: 5000 }, { label: "Total", cents: 95000 },
    ]);
    // A statement doesn't carry GST registration: no GST, no row.
    expect(personTotalRows({ type: "contractor", totals: t })).toEqual([{ label: "Pay", cents: 90000 }]);
  });
});

describe("foldTimeOnlyLines", () => {
  it("folds $0.00 hours-logged lines into the same day's output line, and keeps one with nothing to fold into", () => {
    const out = line({ logId: "o", basis: "per_unit", unit: "lm", quantity: 4000, hours: 0, rateCents: 900, amountCents: 36000 });
    const t = line({ logId: "t", basis: "time_only", quantity: 0, rateCents: null, amountCents: 0 });
    const lone = line({ logId: "z", date: "2026-09-22", basis: "time_only", quantity: 0, rateCents: null, amountCents: 0 });
    expect(foldTimeOnlyLines([out, t, lone])).toEqual([
      { line: out, loggedHours: 800, foldedIds: ["t"] },
      { line: lone, loggedHours: null, foldedIds: [] },
    ]);
  });
});
