import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { dayKey, findGaps, utilisation, type NoWorkReason } from "@/domain/attendance";
import { labourCost, type CostContext } from "@/domain/costing";
import { addDays, dayOfWeek, eachDay } from "@/domain/dates";
import { doublePayFlags, duplicateFlags, pausedStageFlags, type FlagLog } from "@/domain/flags";
import { adjustmentDelta } from "@/domain/adjustments";
import { ledgerBalance, unpaidTooLong, type LedgerEntry } from "@/domain/ledger";
import { dailyAmount, hourlyAmount, perUnitAmount } from "@/domain/lines";
import { sum } from "@/domain/money";
import { buildPayRun, type PayLog, type PayPerson, type PayReimbursement } from "@/domain/payrun";
import { payPeriodContaining } from "@/domain/periods";
import { lumpSumLines } from "@/domain/piece";
import { budgetAlert, forecastLabour, stagePercentBp } from "@/domain/progress";
import { resolveRate } from "@/domain/rates";
import { splitWeighted } from "@/domain/split";
import { lostWorkingDays, pausedTooLong, realWorkingDays, type StageSegment } from "@/domain/segments";
import { fakeToday } from "./clock";
import type { StageRow, WorkLogRow } from "./rows";
import { SEED_TODAY, buildSeed, type Seed } from "./seed";

let seed: Seed;
beforeAll(() => {
  seed = buildSeed();
});

const hash = (s: Seed) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
const live = (logs: readonly WorkLogRow[]) => logs.filter((l) => l.deletedAt === null);
const LAST_WEEK = { start: "2026-09-21", end: "2026-09-27" };

function ctx(s: Seed): CostContext {
  return { workspaceGstRegistered: s.workspace.gstRegistered, onCostBp: s.workspace.onCostBp };
}
function crewOf(s: Seed, id: string) {
  return s.crewMembers.find((c) => c.id === id)!;
}
function stageLabour(s: Seed, stageId: string): number {
  return sum(
    live(s.workLogs)
      .filter((l) => l.stageId === stageId)
      .map((l) => labourCost(l.amountCents, crewOf(s, l.crewMemberId), ctx(s))),
  );
}
function measured(s: Seed, stageId: string): number {
  return sum(s.progressEntries.filter((p) => p.stageId === stageId).map((p) => p.quantity));
}
function stagePct(s: Seed, st: StageRow): number {
  return stagePercentBp({
    status: st.status,
    unit: st.unit,
    budgetQty: st.budgetQty,
    measuredQty: measured(s, st.id),
    manualPctBp: st.manualPctBp,
  });
}
function segmentsOf(s: Seed, stageId: string): StageSegment[] {
  return s.stageSegments
    .filter((g) => g.stageId === stageId)
    .map((g) => ({ start: g.startDate, end: g.endDate, pauseReason: g.pauseReason }));
}
function flagLog(l: WorkLogRow): FlagLog {
  return {
    id: l.id,
    crewMemberId: l.crewMemberId,
    date: l.date,
    stageId: l.stageId,
    basis: l.basis,
    source: l.source,
    entryId: l.entryId,
  };
}
function payLog(l: WorkLogRow): PayLog {
  return {
    id: l.id,
    crewMemberId: l.crewMemberId,
    date: l.date,
    projectId: l.projectId,
    stageId: l.stageId,
    basis: l.basis,
    source: l.source,
    quantity: l.quantity,
    hours: l.hours,
    rateCents: l.rateCents,
    amountCents: l.amountCents,
    missingRate: l.missingRate,
    locked: l.payRunId !== null,
  };
}
function people(s: Seed): PayPerson[] {
  return s.crewMembers.map((c) => ({
    id: c.id,
    type: c.type,
    gstRegistered: c.gstRegistered,
    floorHourlyCents: s.crewLevels.find((lv) => lv.id === c.levelId)?.floorRateCents ?? null,
  }));
}
function reimbursements(s: Seed): PayReimbursement[] {
  return s.expenses
    .filter((e) => e.paidBy === "crew")
    .map((e) => ({
      expenseId: e.id,
      crewMemberId: e.crewMemberId!,
      date: e.date,
      amountCents: sum([e.amountExGstCents, e.gstCents]),
      reimbursed: e.reimbursedInPayRunId !== null,
    }));
}
function lastWeekDraft(s: Seed) {
  return buildPayRun(LAST_WEEK, people(s), live(s.workLogs).map(payLog), reimbursements(s));
}
function ledgerOf(s: Seed, crewId: string): LedgerEntry[] {
  return s.ledgerEntries
    .filter((e) => e.crewMemberId === crewId)
    .map((e) => ({ date: e.date, kind: e.kind, amountCents: e.amountCents }));
}

describe("seed: shape and determinism", () => {
  it("is deterministic: the same JSON hash on two builds", () => {
    expect(hash(buildSeed())).toBe(hash(seed));
  });

  it("builds in under 300 ms (best of 5, so a busy parallel test run doesn't decide it)", () => {
    const times = Array.from({ length: 5 }, () => {
      const t0 = performance.now();
      buildSeed();
      return Math.round(performance.now() - t0);
    });
    expect(Math.min(...times), `build times: ${times.join(", ")} ms`).toBeLessThan(300);
  });

  it("is anchored at the default fake clock's work date", () => {
    expect(SEED_TODAY).toBe("2026-09-28");
    expect(seed.meta.today).toBe(SEED_TODAY);
    expect(fakeToday()).toBe(seed.meta.today);
  });

  it("is Harbour Roofing: GST registered, Sydney, weekly from Monday, Mon–Fri, 8.0 h, 25% on-cost", () => {
    expect(seed.workspace).toMatchObject({
      name: "Harbour Roofing",
      gstRegistered: true,
      timezone: "Australia/Sydney",
      payPeriod: "weekly",
      payWeekStart: 1,
      workingDays: [1, 2, 3, 4, 5],
      standardDayHours: 800,
      onCostBp: 2500,
    });
    expect(seed.workspace.abn).toMatch(/^\d{2} \d{3} \d{3} \d{3}$/);
  });

  it("has 12 crew: the pay-rules five plus seven, employees and contractors, one inactive", () => {
    expect(seed.crewMembers).toHaveLength(12);
    const names = seed.crewMembers.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Sam", "Tom", "Jake", "Dima", "Lee"]));
    expect(seed.crewMembers.filter((c) => c.type === "contractor").length).toBeGreaterThanOrEqual(3);
    expect(seed.crewMembers.filter((c) => c.type === "employee").length).toBeGreaterThanOrEqual(6);
    expect(seed.crewMembers.filter((c) => c.activeTo !== null && c.activeTo < SEED_TODAY)).toHaveLength(1);
  });

  it("has the pay-rules §0 rates and floors in force today", () => {
    const rate = (name: string, basis: "hourly" | "daily" | "per_unit", unit: "m2" | "lm" | null) =>
      resolveRate(seed.rates, {
        crewMemberId: seed.crewMembers.find((c) => c.name === name)!.id,
        basis,
        unit,
        projectId: "none",
        date: SEED_TODAY,
      })?.amountCents ?? null;
    expect([rate("Sam", "daily", null), rate("Sam", "per_unit", "m2"), rate("Sam", "hourly", null)]).toEqual([
      32000, 950, 4000,
    ]);
    expect([rate("Tom", "per_unit", "m2"), rate("Tom", "daily", null)]).toEqual([900, 30000]);
    expect([rate("Jake", "hourly", null), rate("Jake", "per_unit", "lm")]).toEqual([2400, null]);
    expect([rate("Dima", "per_unit", "m2"), rate("Dima", "daily", null)]).toEqual([1200, 40000]);
    expect([rate("Lee", "per_unit", "lm"), rate("Lee", "daily", null)]).toEqual([800, 35000]);
    const floor = (name: string) =>
      seed.crewLevels.find((lv) => lv.id === seed.crewMembers.find((c) => c.name === name)!.levelId)
        ?.floorRateCents;
    expect([floor("Sam"), floor("Tom"), floor("Jake"), floor("Dima"), floor("Lee")]).toEqual([
      3200,
      3200,
      2200,
      undefined,
      undefined,
    ]);
    const dima = seed.crewMembers.find((c) => c.name === "Dima")!;
    const lee = seed.crewMembers.find((c) => c.name === "Lee")!;
    expect([dima.type, dima.gstRegistered, lee.type, lee.gstRegistered]).toEqual([
      "contractor",
      true,
      "contractor",
      false,
    ]);
  });

  it("has 5 active jobs incl. the Smith job, one on hold and one complete, plus two years of completed jobs", () => {
    const byStatus = (st: string) => seed.projects.filter((p) => p.status === st);
    expect(byStatus("active")).toHaveLength(5);
    expect(byStatus("active").map((p) => p.nickname)).toContain("Smith job — Ryde re-roof");
    expect(byStatus("on_hold")).toHaveLength(1);
    const done = [...byStatus("complete"), ...byStatus("closed")];
    expect(done.length).toBeGreaterThan(40);
    expect(done.some((p) => p.startDate! <= "2024-09-30")).toBe(true);
  });

  it("has logs spanning at least two years before today, none in the future", () => {
    const dates = live(seed.workLogs)
      .map((l) => l.date)
      .sort();
    expect(dates[0]! <= addDays(SEED_TODAY, -730)).toBe(true);
    expect(dates.at(-1)! < SEED_TODAY).toBe(true);
    expect(seed.workLogs.length).toBeGreaterThan(5000);
  });

  it("assigns the foreman to 2 of the 5 active jobs", () => {
    const foreman = seed.members.find((m) => m.role === "foreman")!;
    const ids = seed.projectAssignments.filter((a) => a.memberId === foreman.id).map((a) => a.projectId);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => seed.projects.find((p) => p.id === id)!.status === "active")).toBe(true);
    expect(seed.members.map((m) => m.role).sort()).toEqual(["accountant", "foreman", "manager", "owner"]);
  });

  it("keeps stage status and segments consistent (half-open, ordered, Done closes at completion + 1)", () => {
    for (const st of seed.stages) {
      const segs = seed.stageSegments.filter((g) => g.stageId === st.id);
      for (const [i, g] of segs.entries()) {
        if (g.endDate !== null) expect(g.endDate > g.startDate).toBe(true);
        if (i > 0) expect(g.startDate >= segs[i - 1]!.endDate!).toBe(true);
        if (i < segs.length - 1) expect(g.pauseReason).not.toBeNull();
      }
      const last = segs.at(-1);
      if (st.status === "not_started") expect(segs).toEqual([]);
      if (st.status === "active") expect(last!.endDate).toBeNull();
      if (st.status === "paused")
        expect([last!.endDate === null, last!.pauseReason === null]).toEqual([false, false]);
      if (st.status === "done") {
        expect(last!.endDate).toBe(addDays(st.completedOn!, 1));
        expect(last!.pauseReason).toBeNull();
      }
    }
  });

  it("never has a work log and a no-work marker for the same person and day (lump-sum shares aside)", () => {
    // A lump sum is dated the completion date even for someone on leave that day (pay rules §5).
    const logged = new Set(
      live(seed.workLogs)
        .filter((l) => l.basis !== "lump_sum")
        .map((l) => dayKey(l.crewMemberId, l.date)),
    );
    const marks = seed.noWork.map((n) => dayKey(n.crewMemberId, n.date));
    expect(marks.filter((k) => logged.has(k))).toEqual([]);
    expect(new Set(marks).size).toBe(marks.length);
  });

  it("keeps references intact", () => {
    const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
    const crew = ids(seed.crewMembers);
    const projects = ids(seed.projects);
    const stages = ids(seed.stages);
    for (const l of seed.workLogs) {
      expect(crew.has(l.crewMemberId) && projects.has(l.projectId) && stages.has(l.stageId)).toBe(true);
      expect(seed.stages.find((st) => st.id === l.stageId)!.projectId).toBe(l.projectId);
    }
    const all = Object.values(seed)
      .filter(Array.isArray)
      .flatMap((rows) => (rows as { id: string }[]).map((r) => r.id));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("seed: every figure reproduces through src/domain", () => {
  it("every log's amount equals the domain line function for its snapshot", () => {
    const logs = live(seed.workLogs);
    const byId = new Map(logs.map((l) => [l.id, l]));
    for (const l of logs) {
      if (l.missingRate) {
        expect([l.rateCents, l.amountCents]).toEqual([null, 0]);
        continue;
      }
      switch (l.source === "adjustment" ? "adjustment" : l.basis) {
        case "hourly":
          expect(l.amountCents).toBe(hourlyAmount(l.hours, l.rateCents!, l.multiplier ?? 100));
          break;
        case "daily":
          expect(l.amountCents).toBe(dailyAmount(l.quantity, l.rateCents!));
          break;
        case "per_unit":
          expect(l.amountCents).toBe(perUnitAmount(l.quantity, l.rateCents!));
          break;
        case "time_only":
          expect([l.amountCents, l.rateCents, l.quantity]).toEqual([0, null, 0]);
          break;
        case "lump_sum":
          expect(l.hours).toBe(0);
          break;
        case "adjustment": {
          const orig = byId.get(l.adjustsLogId!)!;
          const edited = { quantity: orig.quantity + l.quantity, hours: orig.hours + l.hours };
          const editedAmount = hourlyAmount(edited.hours, orig.rateCents!, orig.multiplier ?? 100);
          expect(adjustmentDelta(orig, { ...edited, amountCents: editedAmount })).toEqual({
            quantity: l.quantity,
            hours: l.hours,
            amountCents: l.amountCents,
          });
        }
      }
    }
  });

  it("every grid and progress rate is the resolveRate snapshot for its date and project", () => {
    for (const l of live(seed.workLogs)) {
      if (l.basis === "time_only" || l.basis === "lump_sum" || l.source === "adjustment") continue;
      const r = resolveRate(seed.rates, {
        crewMemberId: l.crewMemberId,
        basis: l.basis,
        unit: l.basis === "per_unit" ? l.unit : null,
        projectId: l.projectId,
        date: l.date,
      });
      expect(l.rateCents).toBe(r?.amountCents ?? null);
    }
  });

  it("every lump-sum stage's logs are the domain's equal split among everyone who logged on it", () => {
    const lumpStages = seed.stages.filter((st) => st.lumpSumCents !== null && st.status === "done");
    expect(lumpStages.length).toBeGreaterThan(3);
    for (const st of lumpStages) {
      const shares = seed.stageCompletionShares.filter((c) => c.stageId === st.id);
      const loggers = [
        ...new Set(
          live(seed.workLogs)
            .filter((l) => l.stageId === st.id && l.basis !== "lump_sum")
            .map((l) => l.crewMemberId),
        ),
      ];
      expect(shares.map((c) => c.crewMemberId)).toEqual(loggers);
      expect(shares.map((c) => c.shareBp)).toEqual(
        splitWeighted(
          10000,
          loggers.map(() => 1),
        ),
      );
      const logs = live(seed.workLogs).filter((l) => l.stageId === st.id && l.basis === "lump_sum");
      const expected = lumpSumLines(st.lumpSumCents!, loggers, { mode: "equal" });
      expect(logs.map((l) => [l.crewMemberId, l.amountCents, l.date])).toEqual(
        expected.map((e) => [e.crewMemberId, e.amountCents, st.completedOn]),
      );
    }
  });

  it("E12.1 Smith sheet install: 400 m², 120 m² measured → 30%, $1,432.50 → forecast $4,775.00, trending over by $775.00", () => {
    const st = seed.stages.find((x) => x.id === seed.meta.stages.smithSheetInstall)!;
    expect([st.name, st.status, st.unit, st.budgetQty, st.labourBudgetCents]).toEqual([
      "Sheet install",
      "active",
      "m2",
      40000,
      400000,
    ]);
    expect(measured(seed, st.id)).toBe(12000);
    const pct = stagePct(seed, st);
    expect(pct).toBe(3000);
    const actual = stageLabour(seed, st.id);
    expect(actual).toBe(143250);
    const forecast = forecastLabour(st.status, pct, actual);
    expect(forecast).toBe(477500);
    expect(budgetAlert(actual, forecast, st.labourBudgetCents)).toEqual({
      level: "trending",
      byCents: 77500,
    });
  });

  it("E4.1/E11.1 the 120 m² was split Sam/Dima equally: $570.00 and $720.00", () => {
    const logs = live(seed.workLogs).filter(
      (l) => l.stageId === seed.meta.stages.smithSheetInstall && l.basis === "per_unit",
    );
    expect(logs.map((l) => [crewOf(seed, l.crewMemberId).name, l.quantity, l.amountCents])).toEqual([
      ["Sam", 6000, 57000],
      ["Dima", 6000, 72000],
    ]);
  });

  it("E1.1 and E1.2 Sam's dated rates and the Ryde heritage override", () => {
    const q = (date: string, projectId: string) =>
      resolveRate(seed.rates, {
        crewMemberId: seed.meta.crew.sam,
        basis: "daily",
        unit: null,
        projectId,
        date,
      })?.amountCents;
    expect(q("2026-09-12", seed.meta.projects.smith)).toBe(30000);
    expect(q("2026-09-15", seed.meta.projects.smith)).toBe(32000);
    expect(q("2026-09-16", seed.meta.projects.rydeHeritage)).toBe(36000);
    expect(q("2026-09-16", seed.meta.projects.smith)).toBe(32000);
    const log = live(seed.workLogs).find(
      (l) => l.crewMemberId === seed.meta.crew.sam && l.date === "2026-09-16",
    )!;
    expect([log.projectId, log.rateCents]).toEqual([seed.meta.projects.rydeHeritage, 36000]);
  });

  it("E13.1 Patel sheet install: 6 real working days, 3 lost to weather", () => {
    const segs = segmentsOf(seed, seed.meta.stages.patelSheetInstall);
    expect(realWorkingDays(segs, [1, 2, 3, 4, 5], SEED_TODAY)).toBe(6);
    expect(lostWorkingDays(segs, [1, 2, 3, 4, 5], SEED_TODAY).weather).toBe(3);
  });

  it("E5.1 Harris ridge is ready for Done: Sam/Tom/Dima logged → $666.67 / $666.67 / $666.66", () => {
    const st = seed.stages.find((x) => x.id === seed.meta.stages.harrisRidge)!;
    expect([st.name, st.status, st.lumpSumCents]).toEqual(["Ridge bedding & pointing", "active", 200000]);
    const loggers = [
      ...new Set(
        live(seed.workLogs)
          .filter((l) => l.stageId === st.id)
          .map((l) => l.crewMemberId),
      ),
    ];
    expect(loggers.map((id) => crewOf(seed, id).name)).toEqual(["Sam", "Tom", "Dima"]);
    expect(lumpSumLines(200000, loggers, { mode: "equal" }).map((l) => l.amountCents)).toEqual([
      66667, 66667, 66666,
    ]);
  });
});

describe("seed: Home scenarios on active jobs", () => {
  it("stage alerts: Smith sheet install trending $775, Ryde repairs trending $300 (E12.2), Wong clean-up over $100 (E12.3)", () => {
    const active = new Set(seed.projects.filter((p) => p.status === "active").map((p) => p.id));
    const alerts = seed.stages
      .filter((st) => active.has(st.projectId))
      .flatMap((st) => {
        const pct = stagePct(seed, st);
        const actual = stageLabour(seed, st.id);
        const alert = budgetAlert(actual, forecastLabour(st.status, pct, actual), st.labourBudgetCents);
        return alert ? [[st.id, alert.level, alert.byCents]] : [];
      });
    expect(alerts.sort()).toEqual(
      [
        [seed.meta.stages.smithSheetInstall, "trending", 77500],
        [seed.meta.stages.rydeRepairs, "trending", 30000],
        [seed.meta.stages.wongCleanUp, "over", 10000],
      ].sort(),
    );
  });

  it("paused too long: only Ryde heritage coat / paint among active jobs (waiting on materials)", () => {
    const active = new Set(seed.projects.filter((p) => p.status === "active").map((p) => p.id));
    const long = seed.stages
      .filter(
        (st) =>
          active.has(st.projectId) && pausedTooLong(segmentsOf(seed, st.id), [1, 2, 3, 4, 5], SEED_TODAY),
      )
      .map((st) => st.id);
    expect(long).toEqual([seed.meta.stages.rydeCoat]);
    expect(
      seed.stageSegments.filter((g) => g.stageId === seed.meta.stages.rydeCoat).at(-1)!.pauseReason,
    ).toBe("materials");
  });

  it("no log sits on a paused or done stage, and none is a possible duplicate", () => {
    const logs = live(seed.workLogs);
    const segs = new Map(seed.stages.map((st) => [st.id, segmentsOf(seed, st.id)]));
    expect(pausedStageFlags(logs.map(flagLog), segs)).toEqual([]);
    expect(duplicateFlags(logs.map(flagLog))).toEqual([]);
  });

  it("E14.1 last week's gaps: Jake Fri (rain Thu → 60%), Ravi Fri, Nick Thu and Fri", () => {
    const logs = live(seed.workLogs);
    const input = {
      start: LAST_WEEK.start,
      endExclusive: "2026-09-26",
      workingDays: [1, 2, 3, 4, 5],
      loggedDays: new Set(logs.map((l) => dayKey(l.crewMemberId, l.date))),
      noWork: new Map<string, NoWorkReason>(
        seed.noWork.map((n) => [dayKey(n.crewMemberId, n.date), n.reason]),
      ),
    };
    const crew = seed.crewMembers.map((c) => ({
      crewMemberId: c.id,
      activeFrom: c.activeFrom,
      activeTo: c.activeTo,
    }));
    const gaps = findGaps(input, crew).map((g) => `${crewOf(seed, g.crewMemberId).name} ${g.date}`);
    expect(gaps.sort()).toEqual(["Jake 2026-09-25", "Nick 2026-09-24", "Nick 2026-09-25", "Ravi 2026-09-25"]);
    expect(
      utilisation(
        input,
        crew.find((c) => c.crewMemberId === seed.meta.crew.jake)!,
      ).bp,
    ).toBe(6000);
  });

  it("only Kev is unpaid too long; everyone else is paid up except Dima's $300.00 advance", () => {
    const flagged = seed.crewMembers.filter((c) => unpaidTooLong(ledgerOf(seed, c.id), SEED_TODAY, 7));
    expect(flagged.map((c) => c.name)).toEqual(["Kev"]);
    for (const c of seed.crewMembers) {
      if (c.name === "Kev") expect(ledgerBalance(ledgerOf(seed, c.id))).toBeGreaterThan(0);
      else
        expect([c.name, ledgerBalance(ledgerOf(seed, c.id))]).toEqual([
          c.name,
          c.name === "Dima" ? -30000 : 0,
        ]);
    }
  });
});

describe("seed: pay runs", () => {
  it("has weekly approved runs from 2 Sep 2024 to 20 Sep 2026, last week's draft and this week's draft", () => {
    const runs = [...seed.payRuns].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const approved = runs.filter((r) => r.status !== "draft");
    expect(approved[0]!.periodStart).toBe("2024-09-02");
    expect(approved.at(-1)!.periodEnd).toBe("2026-09-20");
    for (const [i, r] of approved.entries()) {
      expect(r.periodStart).toBe(addDays("2024-09-02", 7 * i));
      expect(
        payPeriodContaining(r.periodStart, {
          frequency: "weekly",
          weekStartDay: 1,
          anchor: seed.workspace.payAnchor,
        }),
      ).toEqual({
        start: r.periodStart,
        end: r.periodEnd,
      });
    }
    const drafts = runs.filter((r) => r.status === "draft");
    expect(drafts.map((r) => [r.periodStart, r.periodEnd])).toEqual([
      ["2026-09-21", "2026-09-27"],
      ["2026-09-28", "2026-10-04"],
    ]);
    expect([seed.meta.payRuns.review, seed.meta.payRuns.current]).toEqual(drafts.map((r) => r.id));
  });

  it("approved runs lock their logs; each person's frozen lines sum to their ledger credit", () => {
    const approved = new Set(seed.payRuns.filter((r) => r.status !== "draft").map((r) => r.id));
    for (const l of live(seed.workLogs)) {
      if (l.date <= "2026-09-20") {
        const expectLocked = !(l.id === seed.meta.logs.lateEntry || l.id === seed.meta.logs.adjustment);
        expect(l.payRunId !== null).toBe(expectLocked);
      } else expect(l.payRunId).toBeNull();
      if (l.payRunId) expect(approved.has(l.payRunId)).toBe(true);
    }
    const credits = seed.ledgerEntries.filter((e) => e.kind === "payrun_credit");
    for (const c of credits.slice(-40)) {
      const lines = seed.payRunLines.filter(
        (x) => x.payRunId === c.payRunId && x.crewMemberId === c.crewMemberId,
      );
      expect(sum(lines.map((x) => x.amountCents))).toBe(c.amountCents);
    }
  });

  it("E6.1 + E7.1 + E15.1 Dima in last week's draft: $1,520.00 + GST $152.00 + $110.00 = $1,782.00; balance then $1,482.00", () => {
    const dima = lastWeekDraft(seed).find((p) => p.crewMemberId === seed.meta.crew.dima)!;
    expect(dima.totals).toEqual({
      subtotalCents: 152000,
      gstCents: 15200,
      reimbursementsCents: 11000,
      totalCents: 178200,
    });
    const ledger = ledgerOf(seed, seed.meta.crew.dima);
    expect(
      ledgerBalance([
        ...ledger,
        { date: "2026-09-28", kind: "payrun_credit", amountCents: dima.totals.totalCents },
      ]),
    ).toBe(148200);
  });

  it("last week's draft flags: Jake missing lm rate (E4.3), Tom below floor by $32.03 (E10.1), one double pay (Lee), one late entry, one adjustment (E8.1)", () => {
    const draft = lastWeekDraft(seed);
    const name = (id: string) => crewOf(seed, id).name;
    expect(draft.filter((p) => p.missingRate).map((p) => name(p.crewMemberId))).toEqual(["Jake"]);
    const jakeLm = draft.find((p) => name(p.crewMemberId) === "Jake")!.lines.find((l) => l.log.missingRate)!;
    expect([jakeLm.log.quantity, jakeLm.log.amountCents]).toEqual([2000, 0]);
    const below = draft.filter((p) => p.floor?.below);
    expect(
      below.map((p) => [name(p.crewMemberId), p.floor!.effectiveHourlyCents, p.floor!.shortfallCents]),
    ).toEqual([["Tom", 3000, 3203]]);
    const lastWeekLogs = live(seed.workLogs)
      .filter((l) => l.payRunId === null)
      .map(flagLog);
    expect(doublePayFlags(lastWeekLogs).map((f) => [name(f.crewMemberId), f.date])).toEqual([
      ["Lee", "2026-09-23"],
    ]);
    const labelled = draft.flatMap((p) =>
      p.lines
        .filter((l) => l.label !== "normal")
        .map((l) => [name(p.crewMemberId), l.label, l.log.date, l.log.amountCents]),
    );
    expect(labelled).toEqual(
      expect.arrayContaining([
        ["Ben", "late", "2026-09-14", expect.any(Number)],
        ["Jake", "adjustment", "2026-09-17", 1200],
      ]),
    );
    expect(labelled).toHaveLength(2);
    expect(draft.filter((p) => p.noHours)).toEqual([]);
  });

  it("the current week's draft has nothing yet at 7 a.m. Monday", () => {
    const logs = live(seed.workLogs).filter((l) => l.date >= SEED_TODAY);
    expect(logs).toEqual([]);
  });

  it("only working days carry grid logs", () => {
    const weekend = live(seed.workLogs).filter(
      (l) => l.source === "grid" && [0, 6].includes(dayOfWeek(l.date)),
    );
    expect(weekend).toEqual([]);
    expect(eachDay("2026-09-21", "2026-09-26")).toHaveLength(5);
  });
});
