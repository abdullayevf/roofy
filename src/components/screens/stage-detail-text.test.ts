import { describe, expect, it } from "vitest";
import type { SegmentDto, StageActions } from "@/data/contracts";
import { lostDaysRows, PAUSE_CHOICES, segmentText, stageActionsNow, stageChipFor } from "./stage-detail-text";

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
