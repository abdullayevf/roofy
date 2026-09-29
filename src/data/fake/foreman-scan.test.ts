/**
 * Runtime foreman scan (plan Task 6, Review Focus 1): every foreman-reachable read of the fake,
 * on the seeded data and under every `?demo=` state, carries no money keys and no "$" figures —
 * results and error messages alike. Money-only reads must refuse a foreman with a money-free error.
 */
import { describe, expect, it } from "vitest";
import { DataError, isDataError, type Actor, type DataServices, type DemoState } from "../contracts";
import { expectNoMoney, scanForMoney } from "../dto";
import { DEMO_STATES, demoOutbox } from "./demo";
import { v7 as uuidv7 } from "uuid";
import type { MutationEnvelope } from "../contracts";
import { fake, fakeSession, TEST_NOW } from "./services/testing";
import { getSeed } from "./store";

const seed = getSeed();
const { meta } = seed;
const foremanMember = seed.members.find((m) => m.role === "foreman")!;
const assigned = seed.projectAssignments
  .filter((a) => a.memberId === foremanMember.id)
  .map((a) => a.projectId);
const assignedStages = seed.stages.filter((s) => assigned.includes(s.projectId));
const assignedExpenses = seed.expenses.filter((e) => assigned.includes(e.projectId));
const LAST_TWO_WEEKS = { from: "2026-09-14", to: "2026-09-27" };

type Call = [label: string, run: () => Promise<unknown>];

function foremanReads(data: DataServices, actor: Actor): Call[] {
  return [
    ["workspace.settings", () => data.workspace.settings(actor)],
    ["workspace.categories", () => data.workspace.categories(actor)],
    ["projects.list", () => data.projects.list(actor)],
    ["projects.list(all)", () => data.projects.list(actor, { status: "all" })],
    ...assigned.map((id): Call => [`projects.get ${id}`, () => data.projects.get(actor, id)]),
    ...assignedStages.map((s): Call => [`stages.get ${s.name}`, () => data.stages.get(actor, s.id)]),
    ["crew.list", () => data.crew.list(actor)],
    ["crew.list(inactive)", () => data.crew.list(actor, { includeInactive: true })],
    ["logs.crewDayDefaults", () => data.logs.crewDayDefaults(actor)],
    ...assignedStages.map((s): Call => [
      `logs.crewDayDefaults ${s.name}`,
      () => data.logs.crewDayDefaults(actor, { stageId: s.id }),
    ]),
    ["logs.sameAsYesterday", () => data.logs.sameAsYesterday(actor, "2026-09-28")],
    ...["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"].map((d): Call => [
      `logs.byDay ${d}`,
      () => data.logs.byDay(actor, d),
    ]),
    ...seed.crewMembers.map((c): Call => [
      `logs.byPerson ${c.name}`,
      () => data.logs.byPerson(actor, c.id, LAST_TWO_WEEKS),
    ]),
    ...assignedStages.map((s): Call => [`logs.byStage ${s.name}`, () => data.logs.byStage(actor, s.id)]),
    ["progress.defaults", () => data.progress.defaults(actor)],
    ...assignedStages
      .filter((s) => s.unit !== null)
      .map((s): Call => [`progress.byStage ${s.name}`, () => data.progress.byStage(actor, s.id)]),
    ["noWork.list", () => data.noWork.list(actor, LAST_TWO_WEEKS)],
    ["expenses.list", () => data.expenses.list(actor)],
    ...assignedExpenses.map((e): Call => [
      `expenses.get ${e.supplier}`,
      () => data.expenses.get(actor, e.id),
    ]),
    ["home.get", () => data.home.get(actor)],
    ["sync.snapshot", () => data.sync.snapshot(actor)],
  ];
}

/** Reads a foreman must never get: each refuses with a money-free DataError. */
function moneyOnlyReads(data: DataServices, actor: Actor): Call[] {
  const range = LAST_TWO_WEEKS;
  return [
    ["workspace.levels", () => data.workspace.levels(actor)],
    ["workspace.templates", () => data.workspace.templates(actor)],
    ["workspace.members", () => data.workspace.members(actor)],
    ["workspace.assignments", () => data.workspace.assignments(actor)],
    ["projects.proposeStages", () => data.projects.proposeStages(actor, "metal_reroof")],
    ["projects.clients", () => data.projects.clients(actor)],
    ["stages.doneProposal", () => data.stages.doneProposal(actor, meta.stages.smithSheetInstall)],
    ["crew.get", () => data.crew.get(actor, meta.crew.sam)],
    ["crew.rates", () => data.crew.rates(actor, meta.crew.sam)],
    ["payRuns.list", () => data.payRuns.list(actor)],
    ["payRuns.get", () => data.payRuns.get(actor, meta.payRuns.review)],
    ["payRuns.draft", () => data.payRuns.draft(actor)],
    ["payRuns.statement", () => data.payRuns.statement(actor, meta.payRuns.review, meta.crew.dima)],
    ["ledger.balances", () => data.ledger.balances(actor)],
    ["ledger.entries", () => data.ledger.entries(actor, meta.crew.dima)],
    ["reports.jobProfitability", () => data.reports.jobProfitability(actor, range)],
    ["reports.crew", () => data.reports.crew(actor, range)],
    ["reports.productivity", () => data.reports.productivity(actor, range)],
    ["reports.pauses", () => data.reports.pauses(actor, range)],
    ["reports.payHistory", () => data.reports.payHistory(actor, range)],
    ["reports.csv", () => data.reports.csv(actor, "crew", range)],
    ["audit.history", () => data.audit.history(actor)],
    ["exports.listing", () => data.exports.listing(actor)],
  ];
}

const STATES: (DemoState | null)[] = [null, ...DEMO_STATES];

describe("foreman scan: no money in any foreman-reachable read", () => {
  it.each(STATES.map((s) => [s ?? "seed"]))("?demo=%s", async (label) => {
    const demo = label === "seed" ? null : (label as DemoState);
    const { data, actor } = fake("foreman", { demo });
    let resolved = 0;
    for (const [name, run] of foremanReads(data, actor)) {
      try {
        const result = await run();
        expectNoMoney(result, `${name} (demo ${label})`);
        resolved++;
      } catch (e) {
        if (!isDataError(e)) throw e;
        expect(scanForMoney(e.message), `${name} error`).toEqual([]);
      }
    }
    if (demo === "error" || demo === "noperm") expect(resolved).toBe(0);
    else expect(resolved).toBeGreaterThan(demo === "empty" ? 10 : 60);
    expectNoMoney(demoOutbox(demo, seed, TEST_NOW), `demo outbox (${label})`);
  });

  it("the scanner would catch a leak: the manager's reads carry money", async () => {
    const { data, actor } = fake("manager");
    expect(scanForMoney(await data.projects.get(actor, meta.projects.smith)).length).toBeGreaterThan(0);
    expect(scanForMoney(await data.home.get(actor)).length).toBeGreaterThan(0);
  });

  it("money-only reads refuse a foreman with a money-free message", async () => {
    const { data, actor } = fake("foreman");
    for (const [name, run] of moneyOnlyReads(data, actor)) {
      const error = await run().then(
        () => null,
        (e: unknown) => e,
      );
      expect(error, name).toBeInstanceOf(DataError);
      expect((error as DataError).code, name).toBe("forbidden");
      expect(scanForMoney((error as DataError).message)).toEqual([]);
    }
  });
});

describe("foreman scan: field entries (push results and EntryResults)", () => {
  const smith = meta.projects.smith;
  const sheet = meta.stages.smithSheetInstall;
  const envelope = (type: MutationEnvelope["type"], payload: unknown) =>
    ({ id: uuidv7(), type, schemaVersion: 1, appVersion: "0.1.0", createdAt: TEST_NOW.toISOString(), payload }) as MutationEnvelope;
  const materials = seed.expenseCategories.find((x) => x.name === "Materials")!.id;
  // Every type, on assigned and unassigned jobs, valid and invalid, with pay-only warnings (Ben has no daily rate; 16 Sep is approved).
  const batch = (): MutationEnvelope[] => [
    envelope("crew_day", {
      date: "2026-09-16",
      projectId: smith,
      stageId: sheet,
      entries: [{ crewMemberId: meta.crew.ben, basis: "daily", days: 100, hours: 0, multiplier: null }],
    }),
    envelope("crew_day", {
      date: "2026-09-28",
      projectId: meta.projects.rydeHeritage,
      stageId: meta.stages.rydeRepairs,
      entries: [{ crewMemberId: meta.crew.mick, basis: "daily", days: 100, hours: 0, multiplier: null }],
    }),
    envelope("progress", {
      stageId: meta.stages.patelFlashings,
      date: "2026-09-28",
      quantity: 8000,
      crewMemberIds: [meta.crew.lee, meta.crew.jake],
      shares: { mode: "custom", bp: [7500, 2500] },
      photoFileId: null,
      note: null,
    }),
    envelope("progress", { stageId: sheet, date: "2026-09-28", quantity: 0, crewMemberIds: [], shares: { mode: "equal" }, photoFileId: null, note: null }),
    envelope("no_work", { crewMemberIds: [meta.crew.nick], date: "2026-09-28", reason: "rain", note: null }),
    envelope("stage_pause", { stageId: sheet, date: "2026-09-29", reason: "weather", note: null }),
    envelope("stage_resume", { stageId: sheet, date: "2026-10-01" }),
    envelope("stage_pause", { stageId: meta.stages.patelSheetInstall, date: "2026-09-29", reason: "weather", note: null }),
    envelope("expense", {
      date: "2026-09-16",
      supplier: "Bunnings",
      totalCents: 11000,
      gstCents: null,
      projectId: smith,
      stageId: null,
      categoryId: materials,
      paidBy: "crew",
      crewMemberId: meta.crew.dima,
      receiptFileId: null,
    }),
    envelope("expense", {
      date: "2026-09-28",
      supplier: "Bunnings",
      totalCents: 0,
      gstCents: null,
      projectId: smith,
      stageId: null,
      categoryId: materials,
      paidBy: "cash",
      crewMemberId: null,
      receiptFileId: null,
    }),
  ];

  it("every push result a foreman gets (applied, rejected, repeated) is money-free", async () => {
    const { data, actor } = fakeSession("foreman");
    const mutations = batch();
    const first = await data.sync.push(actor, { mutations });
    const repeat = await data.sync.push(actor, { mutations });
    expect(first.results.map((r) => r.status)).toEqual([
      "applied",
      "rejected",
      "applied",
      "rejected",
      "applied",
      "applied",
      "applied",
      "rejected",
      "applied",
      "rejected",
    ]);
    expect(repeat.results.filter((r) => r.status === "applied")).toEqual(
      first.results.filter((r) => r.status === "applied"),
    );
    expectNoMoney(first, "push (foreman)");
    expectNoMoney(repeat, "push repeat (foreman)");
    for (const r of first.results) if (r.status === "applied") expect(r.result.flags).not.toContain("missing_rate");
  });

  it("the manager's results for the same entries do carry the pay flags (the strip is real)", async () => {
    const { data, actor } = fakeSession("manager");
    const res = await data.sync.push(actor, { mutations: batch() });
    const flags = res.results.flatMap((r) => (r.status === "applied" ? r.result.flags : []));
    expect(flags).toContain("missing_rate");
    expect(flags).toContain("late_entry");
  });
});
