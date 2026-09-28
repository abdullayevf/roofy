import { describe, expect, it } from "vitest";
import { ledgerBalance } from "@/domain/ledger";
import { sum } from "@/domain/money";
import { buildPayRun, type PayPerson } from "@/domain/payrun";
import { receiptTotal } from "@/domain/gst";
import { getSeed } from "../store";
import { toPayLog } from "../seed-builder";
import { fake } from "./testing";

const seed = getSeed();
const { meta } = seed;
const name = (id: string | null) => seed.crewMembers.find((c) => c.id === id)?.name ?? null;

async function review(role: "manager" | "owner" | "accountant" = "manager", demo: "blocked" | null = null) {
  const { data, actor } = fake(role, { demo });
  return data.payRuns.get(actor, meta.payRuns.review);
}

describe("pay run review: last week's draft (21–27 Sep)", () => {
  it("reproduces the seeded flags, most severe first; missing rate blocks", async () => {
    const r = await review();
    expect(r.flags.map((f) => [f.kind, f.blocking, name(f.crewMemberId), f.dates])).toEqual([
      ["missing_rate", true, "Jake", ["2026-09-23"]],
      ["below_floor", false, "Tom", []],
      ["double_pay", false, "Lee", ["2026-09-23"]],
      ["gap", false, "Jake", ["2026-09-25"]],
      ["gap", false, "Ravi", ["2026-09-25"]],
      ["gap", false, "Nick", ["2026-09-24", "2026-09-25"]],
    ]);
    const missing = r.flags[0]!;
    expect([missing.basis, missing.unit, missing.stageName, missing.href]).toEqual([
      "per_unit",
      "lm",
      "Flashings, gutters & downpipes",
      `/crew/${meta.crew.jake}`,
    ]);
    expect(r.flags[1]!.floor).toEqual({
      floorRateCents: 3200,
      effectiveHourlyCents: 3000,
      shortfallCents: 3203,
    });
    expect(r.blockedBy).toEqual(["missing_rate"]);
    expect([r.status, r.canApprove, r.canReopen]).toEqual(["draft", false, false]);
  });

  it("labels Ben's late entry and Jake's +$12.00 adjustment (E8.1)", async () => {
    const r = await review();
    const labelled = r.people.flatMap((p) =>
      p.lines.filter((l) => l.label !== "normal").map((l) => [p.name, l.label, l.date, l.amountCents]),
    );
    expect(labelled).toEqual([
      ["Jake", "adjustment", "2026-09-17", 1200],
      ["Ben", "late", "2026-09-14", expect.any(Number)],
    ]);
  });

  it("Dima: $1,520.00 + GST $152.00 + $110.00 screws = $1,782.00 (E6.1, E7.1)", async () => {
    const r = await review();
    const dima = r.people.find((p) => p.name === "Dima")!;
    expect(dima.totals).toEqual({
      subtotalCents: 152000,
      gstCents: 15200,
      reimbursementsCents: 11000,
      totalCents: 178200,
    });
    expect(dima.reimbursements).toEqual([
      {
        expenseId: meta.expenses.dimaScrews,
        date: "2026-09-23",
        supplier: "Trade Fasteners",
        projectName: "Smith job — Ryde re-roof",
        amountCents: 11000,
      },
    ]);
    expect([dima.type, dima.floor]).toEqual(["contractor", null]);
  });

  it("people and totals equal buildPayRun on the seed; totals are the sum of person totals", async () => {
    const r = await review();
    const people: PayPerson[] = seed.crewMembers.map((c) => ({
      id: c.id,
      type: c.type,
      gstRegistered: c.gstRegistered,
      floorHourlyCents: seed.crewLevels.find((lv) => lv.id === c.levelId)?.floorRateCents ?? null,
    }));
    const expected = buildPayRun(
      { start: "2026-09-21", end: "2026-09-27" },
      people,
      seed.workLogs.filter((l) => l.deletedAt === null && l.date <= "2026-09-27").map(toPayLog),
      seed.expenses
        .filter((e) => e.paidBy === "crew")
        .map((e) => ({
          expenseId: e.id,
          crewMemberId: e.crewMemberId!,
          date: e.date,
          amountCents: receiptTotal(e),
          reimbursed: e.reimbursedInPayRunId !== null,
        })),
    );
    expect(r.people.map((p) => [p.crewMemberId, p.totals, p.hours])).toEqual(
      expected.map((p) => [p.crewMemberId, p.totals, p.hours]),
    );
    expect(r.totals.totalCents).toBe(sum(expected.map((p) => p.totals.totalCents)));
    expect(r.totals.totalCents).toBe(sum([r.totals.employeesCents, r.totals.contractorsCents]));
    expect(r.totals.gstCents).toBe(sum(expected.map((p) => p.totals.gstCents)));
  });

  it("Owner 2FA is on in the seed; ?demo=blocked turns it off and blocks approval too", async () => {
    const { data, actor } = fake("owner");
    const ws = await data.workspace.settings(actor);
    expect(ws.view === "manager" && ws.ownerTwoFactor).toBe(true);
    const r = await review("owner", "blocked");
    expect(r.flags.filter((f) => f.blocking).map((f) => f.kind)).toEqual(["missing_rate", "owner_2fa_off"]);
    expect(r.blockedBy).toEqual(["missing_rate", "owner_2fa_off"]);
    const blocked = fake("owner", { demo: "blocked" });
    const bws = await blocked.data.workspace.settings(blocked.actor);
    expect(bws.view === "manager" && bws.ownerTwoFactor).toBe(false);
  });

  it("this week's draft is empty at 7 a.m. Monday and doesn't repeat last week's open lines", async () => {
    const { data, actor } = fake("manager");
    const current = await data.payRuns.get(actor, meta.payRuns.current);
    expect([current.people, current.flags, current.totals.totalCents]).toEqual([[], [], 0]);
    expect((await data.payRuns.draft(actor))!.id).toBe(meta.payRuns.review);
  });
});

describe("approved pay runs", () => {
  it("the last approved run (14–20 Sep) is rebuilt from its frozen lines and equals its ledger credits", async () => {
    const { data, actor } = fake("manager");
    const r = await data.payRuns.get(actor, meta.payRuns.lastApproved);
    expect([r.status, r.flags, r.canApprove, r.canReopen, r.approvedByName]).toEqual([
      "approved",
      [],
      false,
      true,
      "Dan Holt",
    ]);
    for (const p of r.people) {
      const credit = seed.ledgerEntries.find(
        (e) =>
          e.payRunId === meta.payRuns.lastApproved &&
          e.crewMemberId === p.crewMemberId &&
          e.kind === "payrun_credit",
      )!;
      expect(p.totals.totalCents).toBe(credit.amountCents);
      expect(p.totals.subtotalCents).toBe(sum(p.lines.map((l) => l.amountCents)));
    }
  });

  it("lists every run newest first with totals and flag counts", async () => {
    const { data, actor } = fake("accountant");
    const list = await data.payRuns.list(actor);
    expect(list[0]).toMatchObject({ id: meta.payRuns.current, status: "draft", totalCents: 0 });
    expect(list[1]).toMatchObject({ id: meta.payRuns.review, status: "draft", flagCount: 6, blocking: true });
    expect(list[2]).toMatchObject({ id: meta.payRuns.lastApproved, status: "approved" });
    expect(list.at(-1)!.period.start).toBe("2024-09-02");
  });
});

describe("statements and the ledger", () => {
  it("Dima's draft statement: $1,782.00, payouts in the period, balance then $1,482.00 (E15.1)", async () => {
    const { data, actor } = fake("manager");
    const s = await data.payRuns.statement(actor, meta.payRuns.review, meta.crew.dima);
    expect(s.totals.totalCents).toBe(178200);
    // Payouts recorded in the period: the advance, and Wednesday's payment for the 14–20 Sep run.
    expect(s.payouts.map((x) => [x.date, x.kind, x.method])).toEqual([
      ["2026-09-21", "advance", "cash"],
      ["2026-09-23", "payment", "bank_transfer"],
    ]);
    expect(s.payouts[0]!.amountCents).toBe(30000);
    expect(s.balanceAfterCents).toBe(148200);
    expect([s.contractorFooter, s.person.abn, s.business.name]).toEqual([
      true,
      "21 435 133 679",
      "Harbour Roofing",
    ]);
  });

  it("the public link opens the statement; unknown tokens don't", async () => {
    const { data } = fake("manager");
    const { token, payRunId, crewMemberId } = meta.statementTokens[0]!;
    const s = await data.statements.open(token);
    expect([s.payRunId, s.person.id]).toEqual([payRunId, crewMemberId]);
    await expect(data.statements.open("0".repeat(64))).rejects.toMatchObject({ code: "not_found" });
    const late = fake("manager", { now: new Date("2027-01-01T00:00:00Z") });
    await expect(late.data.statements.open(token)).rejects.toMatchObject({ code: "not_found" });
  });

  it("balances: Kev unpaid too long, Dima −$300.00; entries carry the running balance", async () => {
    const { data, actor } = fake("manager");
    const balances = await data.ledger.balances(actor);
    expect(balances.filter((b) => b.unpaidTooLong).map((b) => b.name)).toEqual(["Kev"]);
    expect(balances.find((b) => b.name === "Dima")!.balanceCents).toBe(-30000);
    const entries = await data.ledger.entries(actor, meta.crew.kev);
    const ledger = seed.ledgerEntries.filter((e) => e.crewMemberId === meta.crew.kev);
    expect(entries[0]!.balanceAfterCents).toBe(ledgerBalance(ledger));
    expect(entries).toHaveLength(ledger.length);
  });

  it("a foreman can't reach pay runs, statements, balances or the ledger", async () => {
    const { data, actor } = fake("foreman");
    for (const call of [
      () => data.payRuns.list(actor),
      () => data.payRuns.get(actor, meta.payRuns.review),
      () => data.payRuns.draft(actor),
      () => data.payRuns.statement(actor, meta.payRuns.review, meta.crew.dima),
      () => data.ledger.balances(actor),
      () => data.ledger.entries(actor, meta.crew.dima),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "forbidden" });
    }
  });
});
