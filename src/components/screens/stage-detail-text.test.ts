import { describe, expect, it } from "vitest";
import type { SegmentDto, StageActions } from "@/data/contracts";
import { forecastStateText, labourLineText, forecastWorkingText, lostDaysRows, materialsMeta, NOT_STARTED_TIMELINE, PAUSE_CHOICES, progressRowText, segmentsShown, segmentText, timelineRows, stageActionsNow, stageButtons, stageChipFor } from "./stage-detail-text";

const none: StageActions = { canStart: false, canPause: false, canResume: false, canMarkDone: false, canReopen: false, canSetManualPct: false };
const TODAY = "2026-09-28";

describe("PAUSE_CHOICES", () => {
  it("lists the five reasons in the order flows.md gives, in plain words", () => {
    expect(PAUSE_CHOICES.map((c) => c.label)).toEqual(["Weather", "Waiting on materials", "Waiting on client/builder", "Crew on another job", "Other"]);
    expect(PAUSE_CHOICES.map((c) => c.reason)).toEqual(["weather", "materials", "client", "other_job", "other"]);
  });
});

describe("stageActionsNow", () => {
  it("an active stage offers Pause, never Resume or Start", () => {
    const a = stageActionsNow({ ...none, canPause: true, canMarkDone: true }, "active", null);
    expect(a).toMatchObject({ start: false, pause: true, resume: false, done: true, reopen: false });
  });
  it("a Done stage never offers Pause", () => {
    const a = stageActionsNow({ ...none, canPause: true, canReopen: true }, "done", null);
    expect(a.pause).toBe(false);
    expect(a.reopen).toBe(true);
  });
  it("a pause kept on the phone swaps Pause for Resume at once", () => {
    const a = stageActionsNow({ ...none, canPause: true, canMarkDone: true }, "active", "paused");
    expect(a).toMatchObject({ pause: false, resume: true, done: true });
  });
  it("a restart kept on the phone swaps Resume for Pause", () => {
    const a = stageActionsNow({ ...none, canResume: true }, "paused", "active");
    expect(a).toMatchObject({ pause: true, resume: false });
  });
  it("someone who cannot pause (accountant) gets nothing on a phone-kept state either", () => {
    expect(stageActionsNow(none, "active", "paused")).toEqual({ start: false, pause: false, resume: false, done: false, reopen: false });
  });
});

describe("stageChipFor", () => {
  it("shows the reason in words on a paused stage", () => {
    expect(stageChipFor("paused", "weather")).toEqual({ status: "paused", reason: "Weather" });
    expect(stageChipFor("paused", "client")).toEqual({ status: "paused", reason: "Waiting on client/builder" });
  });
  it("is just the status otherwise", () => {
    expect(stageChipFor("not_started", null)).toEqual({ status: "not-started" });
    expect(stageChipFor("done", null)).toEqual({ status: "done" });
  });
});

describe("segmentText", () => {
  const working: SegmentDto = { start: "2026-09-07", end: "2026-09-10", pauseReason: null, pauseNote: null };
  it("names the last day worked, not the day after", () => {
    expect(segmentText(working, TODAY)).toEqual({ title: "Mon 7 Sep to Wed 9 Sep", detail: "Working" });
  });
  it("an open segment says from", () => {
    expect(segmentText({ ...working, end: null }, TODAY).title).toBe("From Mon 7 Sep");
  });
  it("a pause names the reason and keeps the note", () => {
    const p: SegmentDto = { start: "2026-09-10", end: "2026-09-11", pauseReason: "weather", pauseNote: "Rain" };
    expect(segmentText(p, TODAY)).toEqual({ title: "Thu 10 Sep", detail: "Paused: Weather. Rain" });
  });
});

describe("lostDaysRows", () => {
  it("lists only the reasons with days lost", () => {
    expect(lostDaysRows({ weather: 3, materials: 0, client: 1, other_job: 0, other: 0 })).toEqual([
      { label: "Weather", text: "3 days" },
      { label: "Waiting on client/builder", text: "1 day" },
    ]);
  });
  it("is empty when nothing was lost", () => {
    expect(lostDaysRows({ weather: 0, materials: 0, client: 0, other_job: 0, other: 0 })).toEqual([]);
  });
});

describe("forecastWorkingText", () => {
  it("shows the spent so far, the progress it is at and the forecast, from the figures it is given", () => {
    expect(forecastWorkingText({ actualCents: 143250, pctBp: 3000, forecastCents: 477500 })).toBe("$1,432.50 spent at 30% done, so about $4,775.00 for the whole stage.");
  });
  it("shows a part-percent to two places so the line adds up by hand (30.49%, not 30%), a whole one without them", () => {
    expect(forecastWorkingText({ actualCents: 100000, pctBp: 3049, forecastCents: 327976 })).toBe("$1,000.00 spent at 30.49% done, so about $3,279.76 for the whole stage.");
    expect(forecastWorkingText({ actualCents: 143250, pctBp: 3000, forecastCents: 477500 })).toContain("spent at 30% done");
  });
  it("says there is no forecast yet when the stage has not got far enough to give one", () => {
    expect(forecastWorkingText({ actualCents: 0, pctBp: 0, forecastCents: null })).toBe("$0.00 spent at 0% done. No forecast until some work is done.");
  });
});

describe("progressRowText", () => {
  const row = { date: "2026-09-26", quantity: 4000, unit: "m2" as const, enteredByName: "Dean Nguyen" };
  it("names the quantity with its unit, then who entered it", () => {
    expect(progressRowText(row, TODAY)).toEqual({ primary: "Sat 26 Sep", quantity: "40 m²", meta: "Entered by Dean Nguyen" });
  });
  it("never carries a dollar sign", () => {
    expect(JSON.stringify(progressRowText(row, TODAY))).not.toContain("$");
  });
});

describe("segmentsShown (F2: the timeline follows a pause or restart kept on this phone, in the server's shape)", () => {
  const working: SegmentDto = { start: "2026-09-23", end: null, pauseReason: null, pauseNote: null };
  const pausedRow: SegmentDto = { start: "2026-09-20", end: "2026-09-24", pauseReason: "weather", pauseNote: null };
  it("with nothing kept on the phone shows the server's segments as they are", () => {
    expect(segmentsShown([working], null, TODAY)).toEqual([working]);
  });
  it("a pause ends the open worked stretch at today, with the reason", () => {
    expect(segmentsShown([working], { status: "paused", reason: "weather" }, TODAY)).toEqual([{ ...working, end: TODAY, pauseReason: "weather" }]);
  });
  it("a restart opens a worked stretch from today after the pause", () => {
    expect(segmentsShown([pausedRow], { status: "active", reason: null }, TODAY)).toEqual([
      pausedRow,
      { start: TODAY, end: null, pauseReason: null, pauseNote: null },
    ]);
  });
  it("when the server already shows the kept state, nothing changes", () => {
    expect(segmentsShown([working], { status: "active", reason: null }, TODAY)).toEqual([working]);
    expect(segmentsShown([pausedRow], { status: "paused", reason: "weather" }, TODAY)).toEqual([pausedRow]);
  });
});

describe("timelineRows (F2: a paused stage shows its worked stretch closed and a Paused line)", () => {
  it("a stretch ended by a pause reads as a closed Working line and an open Paused line", () => {
    const rows = timelineRows([{ start: "2026-09-01", end: "2026-09-05", pauseReason: "weather", pauseNote: "Rain" }], TODAY, false);
    expect(rows.map((r) => r.detail)).toEqual(["Working", "Paused: Weather. Rain"]);
    expect(rows[0]!.title).toMatch(/1 Sep to .*4 Sep/);
    expect(rows[1]!.title).toMatch(/^From .*5 Sep/);
  });
  it("a pause that was restarted ends the day before work began again", () => {
    const rows = timelineRows(
      [
        { start: "2026-09-01", end: "2026-09-05", pauseReason: "materials", pauseNote: null },
        { start: "2026-09-08", end: null, pauseReason: null, pauseNote: null },
      ],
      TODAY,
      false,
    );
    expect(rows.map((r) => r.detail)).toEqual(["Working", "Paused: Waiting on materials", "Working"]);
    expect(rows[1]!.title).toMatch(/5 Sep to .*7 Sep/);
  });
  it("a pause on the start day shows no empty worked stretch; a done stage's last stretch reads Done", () => {
    expect(timelineRows([{ start: TODAY, end: TODAY, pauseReason: "weather", pauseNote: null }], TODAY, false)).toHaveLength(1);
    expect(timelineRows([{ start: "2026-09-01", end: "2026-09-05", pauseReason: null, pauseNote: null }], TODAY, true)[0]!.detail).toBe("Done");
  });
});

describe("stageButtons (F1, D8, D19: one primary, the same for foreman and manager)", () => {
  const now = { start: false, pause: false, resume: false, done: false, reopen: false };
  const shape = (n: typeof now) => stageButtons(n).map((b) => `${b.kind}:${b.variant}`);
  it("paused: Resume is the one primary and Mark done is secondary, primary last (nearest the thumb)", () => {
    expect(shape({ ...now, resume: true, done: true })).toEqual(["done:secondary", "resume:primary"]);
  });
  it("active: Mark done is primary and Pause secondary", () => {
    expect(shape({ ...now, pause: true, done: true })).toEqual(["pause:secondary", "done:primary"]);
  });
  it("foreman active: Pause stays secondary, as for the manager", () => {
    expect(shape({ ...now, pause: true })).toEqual(["pause:secondary"]);
  });
  it("not started: Start is primary; done: Reopen is secondary; never two primaries", () => {
    expect(shape({ ...now, start: true })).toEqual(["start:primary"]);
    expect(shape({ ...now, reopen: true })).toEqual(["reopen:secondary"]);
    expect(stageButtons({ start: true, pause: true, resume: true, done: true, reopen: true }).filter((b) => b.variant === "primary")).toHaveLength(1);
  });
});

describe("timeline and materials words", () => {
  it("a stage with no stretches yet says so in one sentence (D11)", () => {
    expect(NOT_STARTED_TIMELINE).toBe("Not started yet. Starts when the first day is logged.");
  });
  it("the last stretch of a done stage reads Done, not Working (D18)", () => {
    const seg: SegmentDto = { start: "2026-09-01", end: "2026-09-05", pauseReason: null, pauseNote: null };
    expect(segmentText(seg, TODAY, true).detail).toBe("Done");
    expect(segmentText(seg, TODAY).detail).toBe("Working");
  });
  it("materials meta names the budget, or says none is set rather than $0.00 (D7, F8)", () => {
    expect(materialsMeta(250000)).toBe("Budget $2,500.00");
    expect(materialsMeta(0)).toBe("No budget set");
  });
});

describe("labourLineText (forecast breakdown lines)", () => {
  const base = { crewName: "Sam", date: "2026-09-25", basis: "per_unit" as const, unit: "m2" as const, quantity: 6000, hours: 0, rateCents: 950, amountCents: 57_000, labourCostCents: 71_250, adjustsLogId: null };
  it("E11.1 Sam's per-unit line: who, the day, quantity at the rate, and the on-cost on top", () => {
    expect(labourLineText(base, TODAY)).toEqual({ primary: "Sam, Fri 25 Sep", meta: "60 m² at $9.50 = $570.00, plus on-cost" });
  });
  it("E11.1 Dima's contractor line costs what he is paid", () => {
    expect(labourLineText({ ...base, crewName: "Dima", rateCents: 1200, amountCents: 72_000, labourCostCents: 72_000 }, TODAY).meta).toBe("60 m² at $12.00 = $720.00");
  });
  it("hours, days, lump sums, adjustments and a missing rate each say how the pay was worked out", () => {
    expect(labourLineText({ ...base, basis: "hourly", unit: null, quantity: 800, rateCents: 4500, amountCents: 36_000, labourCostCents: 36_000 }, TODAY).meta).toBe("8 h at $45.00 an hour = $360.00");
    expect(labourLineText({ ...base, basis: "daily", unit: null, quantity: 100, rateCents: 40_000, amountCents: 40_000, labourCostCents: 40_000 }, TODAY).meta).toBe("1 day at $400.00 a day = $400.00");
    expect(labourLineText({ ...base, basis: "lump_sum", amountCents: 50_000, labourCostCents: 50_000 }, TODAY).meta).toBe("Share of the lump sum, $500.00");
    expect(labourLineText({ ...base, adjustsLogId: "x", amountCents: 1_200, labourCostCents: 1_200 }, TODAY).meta).toBe("Pay adjustment, $12.00");
    expect(labourLineText({ ...base, rateCents: null, amountCents: 0, labourCostCents: 0 }, TODAY).meta).toBe("60 m², no rate set yet");
  });
});

describe("forecastStateText", () => {
  it("open stage at 30%: the division that gives the forecast", () => {
    expect(forecastStateText({ status: "active", actualCents: 143_250, pctBp: 3000, forecastCents: 477_500 })).toBe("$1,432.50 ÷ 30% done = $4,775.00");
  });
  it("done stage: the forecast is what it cost", () => {
    expect(forecastStateText({ status: "done", actualCents: 163_000, pctBp: 10_000, forecastCents: 163_000 })).toBe("Done, so the forecast is what it cost: $1,630.00");
  });
  it("under 10% done: no forecast yet", () => {
    expect(forecastStateText({ status: "paused", actualCents: 81_000, pctBp: 0, forecastCents: null })).toBe("No forecast yet. It starts once the stage is 10% done.");
  });
});
