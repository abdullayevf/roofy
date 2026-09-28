import { describe, expect, it } from "vitest";
import { buildPayRun, type PayLog, type PayPerson } from "./payrun";

const period = { start: "2026-09-14", end: "2026-09-20" };
const people: PayPerson[] = [
  { id: "dima", type: "contractor", gstRegistered: true, floorHourlyCents: null },
  { id: "tom", type: "employee", gstRegistered: false, floorHourlyCents: 3200 },
  { id: "jake", type: "employee", gstRegistered: false, floorHourlyCents: 2200 },
  { id: "lee", type: "contractor", gstRegistered: false, floorHourlyCents: null },
];
let n = 0;
const log = (p: Partial<PayLog> & Pick<PayLog, "crewMemberId" | "basis" | "amountCents">): PayLog => ({
  id: `l${++n}`,
  date: "2026-09-15",
  projectId: "smith",
  stageId: "sheet",
  source: "grid",
  quantity: 0,
  hours: 0,
  rateCents: null,
  missingRate: false,
  locked: false,
  ...p,
});

describe("buildPayRun", () => {
  it("E6.1 + E7.1 Dima: $720 per-unit + 2 × $400 daily, GST, plus $110 reimbursement = $1,782.00", () => {
    const [dima] = buildPayRun(
      period,
      people,
      [
        log({ crewMemberId: "dima", basis: "per_unit", source: "progress", amountCents: 72_000 }),
        log({ crewMemberId: "dima", basis: "daily", amountCents: 40_000, date: "2026-09-16" }),
        log({ crewMemberId: "dima", basis: "daily", amountCents: 40_000, date: "2026-09-17" }),
      ],
      [{ expenseId: "x1", crewMemberId: "dima", date: "2026-09-16", amountCents: 11_000, reimbursed: false }],
    );
    expect(dima!.totals).toEqual({
      subtotalCents: 152_000,
      gstCents: 15_200,
      reimbursementsCents: 11_000,
      totalCents: 178_200,
    });
    expect(dima!.floor).toBeNull();
  });

  it("E6.2 Lee: 3 days × $350 with no GST", () => {
    const result = buildPayRun(
      period,
      people,
      ["2026-09-14", "2026-09-15", "2026-09-16"].map((date) =>
        log({ crewMemberId: "lee", basis: "daily", amountCents: 35_000, date }),
      ),
      [],
    );
    expect(result.find((p) => p.crewMemberId === "lee")!.totals.totalCents).toBe(105_000);
  });

  it("E10.1 Tom: per-unit pay plus grid hours → below floor by $32.03", () => {
    const [tom] = buildPayRun(
      period,
      people,
      [
        log({
          crewMemberId: "tom",
          basis: "per_unit",
          source: "progress",
          amountCents: 29_997,
          date: "2026-09-14",
        }),
        log({ crewMemberId: "tom", basis: "time_only", amountCents: 0, hours: 800, date: "2026-09-14" }),
        log({
          crewMemberId: "tom",
          basis: "per_unit",
          source: "progress",
          amountCents: 18_000,
          date: "2026-09-15",
        }),
        log({ crewMemberId: "tom", basis: "time_only", amountCents: 0, hours: 800, date: "2026-09-15" }),
      ],
      [],
    );
    expect(tom!.hours).toBe(1_600);
    expect(tom!.floor).toEqual({ effectiveHourlyCents: 3_000, below: true, shortfallCents: 3_203 });
    expect(tom!.noHours).toBe(false);
  });

  it("E8.1 labels adjustments and late entries from earlier periods; excludes locked and future logs", () => {
    const [jake] = buildPayRun(
      { start: "2026-09-21", end: "2026-09-27" },
      people,
      [
        log({
          crewMemberId: "jake",
          basis: "hourly",
          source: "adjustment",
          amountCents: 1_200,
          hours: 50,
          date: "2026-09-15",
        }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 18_000, hours: 750, date: "2026-09-16" }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 18_000, hours: 750, date: "2026-09-22" }),
        log({
          crewMemberId: "jake",
          basis: "hourly",
          amountCents: 18_000,
          hours: 750,
          date: "2026-09-14",
          locked: true,
        }),
        log({ crewMemberId: "jake", basis: "hourly", amountCents: 18_000, hours: 750, date: "2026-09-28" }),
      ],
      [],
    );
    expect(jake!.lines.map((l) => [l.log.date, l.label])).toEqual([
      ["2026-09-15", "adjustment"],
      ["2026-09-16", "late"],
      ["2026-09-22", "normal"],
    ]);
    expect(jake!.totals.subtotalCents).toBe(37_200);
  });

  it("sorts lines by date, then project, then stage", () => {
    const [jake] = buildPayRun(
      period,
      people,
      [
        log({
          crewMemberId: "jake",
          basis: "hourly",
          amountCents: 1,
          hours: 25,
          projectId: "smith",
          stageId: "b",
        }),
        log({
          crewMemberId: "jake",
          basis: "hourly",
          amountCents: 1,
          hours: 25,
          projectId: "smith",
          stageId: "a",
        }),
        log({
          crewMemberId: "jake",
          basis: "hourly",
          amountCents: 1,
          hours: 25,
          projectId: "ryde",
          stageId: "z",
        }),
      ],
      [],
    );
    expect(jake!.lines.map((l) => `${l.log.projectId}/${l.log.stageId}`)).toEqual([
      "ryde/z",
      "smith/a",
      "smith/b",
    ]);
  });

  it("warns when an employee has earnings but no hours, and when a rate is missing", () => {
    const [jake] = buildPayRun(
      period,
      people,
      [
        log({ crewMemberId: "jake", basis: "lump_sum", source: "lump_sum", amountCents: 50_000 }),
        log({ crewMemberId: "jake", basis: "per_unit", amountCents: 0, missingRate: true }),
      ],
      [],
    );
    expect(jake!.noHours).toBe(true);
    expect(jake!.floor).toBeNull();
    expect(jake!.missingRate).toBe(true);
  });

  it("omits people with nothing to pay and skips already-reimbursed or future expenses", () => {
    const result = buildPayRun(
      period,
      people,
      [],
      [
        { expenseId: "a", crewMemberId: "dima", date: "2026-09-16", amountCents: 500, reimbursed: true },
        { expenseId: "b", crewMemberId: "dima", date: "2026-09-21", amountCents: 500, reimbursed: false },
      ],
    );
    expect(result).toEqual([]);
  });
});
