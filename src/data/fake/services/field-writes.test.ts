/**
 * Fake field writes (plan Task 7): crew-day, progress, no-work, stage pause/resume, expense — amounts
 * from `src/domain`, business warnings as flags (never rejections), role and job-assignment rules.
 */
import { describe, expect, it } from "vitest";
import { dailyAmount, defaultHours, hourlyAmount } from "@/domain/lines";
import { pieceRateLines } from "@/domain/piece";
import {
  DataError,
  type CrewDayEntry,
  type CrewDayInput,
  type ExpenseInput,
  type ProjectDetailManager,
  type StageDetailManager,
} from "../../contracts";
import { scanForMoney } from "../../dto";
import { getSeed } from "../store";
import { fakeSession } from "./testing";

const seed = getSeed();
const { meta } = seed;
const { crew, stages, projects } = meta;
const smithStage = (name: string) =>
  seed.stages.find((s) => s.projectId === projects.smith && s.name === name)!.id;

const daily = (crewMemberId: string, days: 100 | 50 = 100): CrewDayEntry => ({
  crewMemberId,
  basis: "daily",
  days,
  hours: 0,
  multiplier: null,
});
const hourly = (crewMemberId: string, hours: number, multiplier: number | null = null): CrewDayEntry => ({
  crewMemberId,
  basis: "hourly",
  days: null,
  hours,
  multiplier,
});
const timeOnly = (crewMemberId: string, hours = 800): CrewDayEntry => ({
  crewMemberId,
  basis: "time_only",
  days: null,
  hours,
  multiplier: null,
});
const day = (entries: CrewDayEntry[], o: Partial<CrewDayInput> = {}): CrewDayInput => ({
  date: "2026-09-28",
  projectId: projects.smith,
  stageId: stages.smithSheetInstall,
  entries,
  ...o,
});

async function refusal(p: Promise<unknown>): Promise<DataError> {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(DataError);
  return e as DataError;
}

describe("crew-day grid", () => {
  it("snapshots rates and amounts from the domain: E2.1, E2.2, E3.2 and a time-only row", async () => {
    const { data, actor, store } = fakeSession("manager");
    const r = await data.logs.saveCrewDay(
      actor,
      day([hourly(crew.jake, 750), hourly(crew.jake, 200, 150), daily(crew.sam, 50), timeOnly(crew.dima)]),
    );
    expect(r.flags).toEqual([]);
    expect(r.ids).toHaveLength(4);
    const rows = r.ids.map((id) => store.tables.workLogs.find((l) => l.id === id)!);
    expect(rows.map((l) => [l.basis, l.quantity, l.hours, l.multiplier, l.rateCents, l.amountCents])).toEqual(
      [
        ["hourly", 750, 750, 100, 2400, hourlyAmount(750, 2400)],
        ["hourly", 200, 200, 150, 2400, hourlyAmount(200, 2400, 150)],
        ["daily", 50, defaultHours(50, 800), null, 32000, dailyAmount(50, 32000)],
        ["time_only", 0, 800, null, null, 0],
      ],
    );
    expect(rows.map((l) => l.amountCents)).toEqual([18000, 7200, 16000, 0]);
    expect(new Set(rows.map((l) => l.entryId)).size).toBe(1);
    expect(rows.every((l) => l.source === "grid" && l.missingRate === false)).toBe(true);
  });

  it("a follow-up read in the same session shows the new logs (job detail, logs by day)", async () => {
    const { data, actor } = fakeSession("manager");
    const before = (await data.projects.get(actor, projects.smith)) as ProjectDetailManager;
    await data.logs.saveCrewDay(actor, day([hourly(crew.jake, 800)]));
    const after = (await data.projects.get(actor, projects.smith)) as ProjectDetailManager;
    expect(after.recentLogs[0]).toMatchObject({ crewName: "Jake", date: "2026-09-28", amountCents: 19200 });
    // Jake is an employee: job cost adds 25% on-cost (pay rules §11).
    expect(after.labour.actualCents - before.labour.actualCents).toBe(24000);
    const byDay = await data.logs.byDay(actor, "2026-09-28");
    expect(byDay.rows.map((l) => l.crewName)).toEqual(["Jake"]);
  });

  it("a missing rate saves at $0.00 with the flag (pay rules §1); the draft then flags it", async () => {
    const { data, actor } = fakeSession("manager");
    const r = await data.logs.saveCrewDay(actor, day([daily(crew.ben)]));
    expect(r.flags).toEqual(["missing_rate"]);
    const log = (await data.logs.byDay(actor, "2026-09-28")).rows[0]!;
    expect(log).toMatchObject({ crewName: "Ben", rateCents: null, amountCents: 0, missingRate: true });
  });

  it("logging a Not started stage starts it from the log date", async () => {
    const { data, actor } = fakeSession("manager");
    const flashings = smithStage("Flashings, gutters & downpipes");
    const r = await data.logs.saveCrewDay(actor, day([daily(crew.lee)], { stageId: flashings }));
    expect(r.flags).toEqual(["auto_started"]);
    const st = await data.stages.get(actor, flashings);
    expect(st.status).toBe("active");
    expect(st.segments).toEqual([{ start: "2026-09-28", end: null, pauseReason: null, pauseNote: null }]);
  });

  it("business warnings are applied with flags, never rejected: paused stage, late entry, possible duplicate", async () => {
    const { data, actor } = fakeSession("manager");
    const paused = await data.logs.saveCrewDay(
      actor,
      day([daily(crew.mick)], { projectId: projects.rydeHeritage, stageId: stages.rydeCoat }),
    );
    expect(paused.flags).toEqual(["paused_stage"]);
    const late = await data.logs.saveCrewDay(actor, day([hourly(crew.jake, 800)], { date: "2026-09-16" }));
    expect(late.flags).toContain("late_entry");
    const draft = await data.payRuns.draft(actor);
    const jake = draft!.people.find((p) => p.name === "Jake")!;
    expect(jake.lines.find((l) => l.logId === late.ids[0])!.label).toBe("late");
    const dup = await data.logs.saveCrewDay(actor, day([timeOnly(crew.sam)], { date: "2026-09-25" }));
    expect(dup.flags).toEqual(["possible_duplicate"]);
  });

  it("refuses what can't be saved: a stage on another job, someone who'd left, an accountant", async () => {
    const { data, actor, as } = fakeSession("manager");
    const wrong = await refusal(
      data.logs.saveCrewDay(actor, day([daily(crew.sam)], { stageId: stages.rydeCoat })),
    );
    expect([wrong.code, wrong.message]).toEqual([
      "invalid",
      "That stage isn't on this job. Pick the stage again.",
    ]);
    const left = await refusal(data.logs.saveCrewDay(actor, day([daily(crew.pete)])));
    expect(left.message).toBe("Pete wasn't working for you on Mon 28 Sep. Take them off this entry.");
    const acct = as("accountant");
    expect((await refusal(acct.data.logs.saveCrewDay(acct.actor, day([daily(crew.sam)])))).code).toBe(
      "forbidden",
    );
  });

  it("a foreman logs on assigned jobs only, and never sees pay-only flags", async () => {
    const { data, actor } = fakeSession("foreman");
    const r = await data.logs.saveCrewDay(actor, day([daily(crew.ben)]));
    expect(r.flags).toEqual([]);
    const late = await data.logs.saveCrewDay(actor, day([daily(crew.ben)], { date: "2026-09-16" }));
    expect(late.flags).not.toContain("late_entry");
    expect(late.flags).not.toContain("missing_rate");
    const e = await refusal(
      data.logs.saveCrewDay(
        actor,
        day([daily(crew.mick)], { projectId: projects.rydeHeritage, stageId: stages.rydeRepairs }),
      ),
    );
    expect(e.code).toBe("forbidden");
    expect(scanForMoney(e.message)).toEqual([]);
  });
});

describe("progress entries", () => {
  it("E4.1: 120 m² Sam + Dima equal → $570.00 / $720.00; the stage moves from 30% to 60%", async () => {
    const { data, actor, store } = fakeSession("manager");
    const r = await data.progress.record(actor, {
      stageId: stages.smithSheetInstall,
      date: "2026-09-28",
      quantity: 12000,
      crewMemberIds: [crew.sam, crew.dima],
      shares: { mode: "equal" },
      photoFileId: null,
      note: null,
    });
    expect(r.flags).toEqual([]);
    const logs = r.ids.slice(1).map((id) => store.tables.workLogs.find((l) => l.id === id)!);
    const expected = pieceRateLines(
      12000,
      "m2",
      [
        { crewMemberId: crew.sam, rateCents: 950 },
        { crewMemberId: crew.dima, rateCents: 1200 },
      ],
      { mode: "equal" },
    );
    expect(logs.map((l) => [l.quantity, l.hours, l.amountCents])).toEqual(
      expected.map((l) => [l.quantity, 0, l.amountCents]),
    );
    expect(logs.map((l) => l.amountCents)).toEqual([57000, 72000]);
    const st = (await data.stages.get(actor, stages.smithSheetInstall)) as StageDetailManager;
    expect([st.quantityDone, st.pctBp]).toEqual([24000, 6000]);
    expect(st.progress[0]!.split.map((s) => [s.name, s.shareBp, s.quantity])).toEqual([
      ["Sam", 5000, 6000],
      ["Dima", 5000, 6000],
    ]);
  });

  it("E4.3: 80 lm Lee 75% / Jake 25% → Lee $480.00; Jake $0.00 with a missing rate", async () => {
    const { data, actor, store } = fakeSession("manager");
    const r = await data.progress.record(actor, {
      stageId: stages.patelFlashings,
      date: "2026-09-28",
      quantity: 8000,
      crewMemberIds: [crew.lee, crew.jake],
      shares: { mode: "custom", bp: [7500, 2500] },
      photoFileId: null,
      note: "Box gutter done",
    });
    expect(r.flags).toEqual(["missing_rate"]);
    const logs = r.ids.slice(1).map((id) => store.tables.workLogs.find((l) => l.id === id)!);
    expect(logs.map((l) => [l.quantity, l.amountCents, l.missingRate])).toEqual([
      [6000, 48000, false],
      [2000, 0, true],
    ]);
  });

  it("a stage with no unit takes no progress", async () => {
    const { data, actor } = fakeSession("manager");
    const e = await refusal(
      data.progress.record(actor, {
        stageId: stages.harrisRidge,
        date: "2026-09-28",
        quantity: 100,
        crewMemberIds: [crew.sam],
        shares: { mode: "equal" },
        photoFileId: null,
        note: null,
      }),
    );
    expect(e.message).toMatch(/^This stage has no unit/);
  });
});

describe("no-work markers", () => {
  const rain = { crewMemberIds: [crew.jake], date: "2026-09-28", reason: "rain" as const, note: null };

  it("one marker per person and day: a second one replaces the reason", async () => {
    const { data, actor } = fakeSession("foreman");
    await data.noWork.record(actor, rain);
    await data.noWork.record(actor, { ...rain, reason: "sick", note: "Flu" });
    const rows = await data.noWork.list(actor, { from: "2026-09-28", to: "2026-09-28" });
    expect(rows.map((n) => [n.name, n.reason, n.note])).toEqual([["Jake", "sick", "Flu"]]);
    await data.noWork.remove(actor, rows[0]!.id);
    expect(await data.noWork.list(actor, { from: "2026-09-28", to: "2026-09-28" })).toEqual([]);
  });

  it("someone already logged that day can't be marked (flows 'No-work marker')", async () => {
    const { data, actor } = fakeSession("manager");
    await data.logs.saveCrewDay(actor, day([hourly(crew.jake, 800)]));
    const e = await refusal(data.noWork.record(actor, rain));
    expect([e.code, e.message]).toEqual([
      "conflict",
      "Jake already has a log today — remove it first to mark no work.",
    ]);
  });
});

describe("stage pause and resume", () => {
  it("pause closes the open segment with reason and note; resume opens a new one", async () => {
    const { data, actor } = fakeSession("foreman");
    const id = stages.smithSheetInstall;
    await data.stages.pause(actor, {
      stageId: id,
      date: "2026-09-29",
      reason: "weather",
      note: "Forecast clearing Thursday",
    });
    let st = await data.stages.get(actor, id);
    expect(st.status).toBe("paused");
    expect(st.segments.at(-1)).toEqual({
      start: "2026-09-23",
      end: "2026-09-29",
      pauseReason: "weather",
      pauseNote: "Forecast clearing Thursday",
    });
    await data.stages.resume(actor, { stageId: id, date: "2026-10-01" });
    st = await data.stages.get(actor, id);
    expect(st.status).toBe("active");
    expect(st.segments.at(-1)).toEqual({
      start: "2026-10-01",
      end: null,
      pauseReason: null,
      pauseNote: null,
    });
  });

  it("pausing a paused stage changes nothing; a Done stage can't be paused; dates must follow the segment", async () => {
    const { data, actor } = fakeSession("manager");
    expect(
      await data.stages.pause(actor, {
        stageId: stages.rydeCoat,
        date: "2026-09-28",
        reason: "other",
        note: null,
      }),
    ).toEqual({ ids: [], flags: [] });
    const done = await refusal(
      data.stages.pause(actor, {
        stageId: stages.patelSheetInstall,
        date: "2026-09-28",
        reason: "weather",
        note: null,
      }),
    );
    expect([done.code, done.message]).toEqual([
      "conflict",
      "This stage was marked Done, so it can't be paused.",
    ]);
    const early = await refusal(
      data.stages.pause(actor, {
        stageId: stages.smithSheetInstall,
        date: "2026-09-23",
        reason: "weather",
        note: null,
      }),
    );
    expect(early.message).toBe(
      "This stage started on Wed 23 Sep. Pick the first day not worked, after that.",
    );
    const back = await refusal(data.stages.resume(actor, { stageId: stages.rydeCoat, date: "2026-09-10" }));
    expect(back.message).toBe("This stage was paused from Mon 14 Sep. Pick that day or later.");
  });

  it("a foreman can't pause a stage on a job he isn't assigned to", async () => {
    const { data, actor } = fakeSession("foreman");
    const e = await refusal(
      data.stages.pause(actor, {
        stageId: stages.rydeRepairs,
        date: "2026-09-29",
        reason: "weather",
        note: null,
      }),
    );
    expect(e.code).toBe("forbidden");
  });
});

describe("expenses", () => {
  const screws: ExpenseInput = {
    date: "2026-09-28",
    supplier: "Bunnings",
    totalCents: 11000,
    gstCents: null,
    projectId: projects.smith,
    stageId: stages.smithSheetInstall,
    categoryId: seed.expenseCategories.find((x) => x.name === "Materials")!.id,
    paidBy: "crew",
    crewMemberId: crew.dima,
    receiptFileId: null,
  };

  it("GST defaults to total ÷ 11; paid by crew → reimbursed in the next draft (pay rules §7)", async () => {
    const { data, actor } = fakeSession("manager");
    const r = await data.expenses.create(actor, screws);
    const d = await data.expenses.get(actor, r.ids[0]!);
    if (d.view !== "manager") throw new Error("manager view");
    expect([d.expense.amountExGstCents, d.expense.gstCents, d.expense.totalCents]).toEqual([
      10000, 1000, 11000,
    ]);
    expect(d.expense.reimbursement).toEqual({ payRunId: meta.payRuns.current, status: "in_draft" });
    const run = await data.payRuns.get(actor, meta.payRuns.current);
    expect(run.people.find((p) => p.name === "Dima")!.reimbursements[0]!.amountCents).toBe(11000);
  });

  it("'No GST' stores the whole total ex GST; an edit re-defaults GST and is audited", async () => {
    const { data, actor } = fakeSession("manager");
    const r = await data.expenses.create(actor, {
      ...screws,
      gstCents: 0,
      paidBy: "cash",
      crewMemberId: null,
    });
    const id = r.ids[0]!;
    let d = await data.expenses.get(actor, id);
    if (d.view !== "manager") throw new Error("manager view");
    expect([d.expense.amountExGstCents, d.expense.gstCents]).toEqual([11000, 0]);
    await data.expenses.update(actor, id, { totalCents: 22000, gstCents: null });
    d = await data.expenses.get(actor, id);
    if (d.view !== "manager") throw new Error("manager view");
    expect([d.expense.amountExGstCents, d.expense.gstCents]).toEqual([20000, 2000]);
    const history = await data.audit.history(actor, { table: "expense", rowId: id });
    expect(history.map((h) => h.action)).toEqual(["update", "insert"]);
  });

  it("a foreman adds one on an assigned job; the result carries no amounts", async () => {
    const { data, actor } = fakeSession("foreman");
    const r = await data.expenses.create(actor, screws);
    expect(scanForMoney(r)).toEqual([]);
    const other = await refusal(
      data.expenses.create(actor, { ...screws, projectId: projects.rydeHeritage, stageId: null }),
    );
    expect(other.code).toBe("forbidden");
    expect((await refusal(data.expenses.update(actor, r.ids[0]!, { totalCents: 1 }))).code).toBe("forbidden");
  });
});
