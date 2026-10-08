import { describe, expect, it } from "vitest";
import { crewWeekText, jobStageStatus, logQuantityText, stageProgressText, stageAlertNote } from "./job-detail-text";

const stage = { status: "active" as const, unit: "m2" as const, quantityDone: 4000, plannedQuantity: 40000, completedOn: null, pause: null };

describe("stageProgressText", () => {
  it("says how much is done against the plan when the stage has a unit", () => {
    expect(stageProgressText(stage, "2026-09-28")).toBe("40 m² of 400 m²");
  });
  it("says when a done stage finished", () => {
    expect(stageProgressText({ ...stage, status: "done", completedOn: "2026-09-15" }, "2026-09-28")).toBe("Done Tue 15 Sep");
  });
  it("is empty for a stage with no unit that is not done", () => {
    expect(stageProgressText({ ...stage, unit: null, plannedQuantity: null }, "2026-09-28")).toBe("");
  });
  it("names the quantity done alone when there is no plan", () => {
    expect(stageProgressText({ ...stage, plannedQuantity: null }, "2026-09-28")).toBe("40 m² done");
  });
});

describe("jobStageStatus", () => {
  it("maps stage status to a chip and carries the pause reason as words", () => {
    expect(jobStageStatus({ status: "not_started", pause: null })).toEqual({ status: "not-started" });
    expect(jobStageStatus({ status: "paused", pause: { reason: "weather", note: null, since: "2026-09-24", workingDays: 2 } })).toEqual({
      status: "paused",
      reason: "Weather",
    });
  });
});

describe("crewWeekText and logQuantityText", () => {
  it("shows days and hours for the week", () => {
    expect(crewWeekText(2, 1600)).toBe("2 days, 16 h");
    expect(crewWeekText(1, 800)).toBe("1 day, 8 h");
  });
  it("shows a log's quantity by its basis", () => {
    expect(logQuantityText({ basis: "daily", unit: null, quantity: 100, hours: 800 })).toBe("1 day");
    expect(logQuantityText({ basis: "per_unit", unit: "m2", quantity: 12000, hours: 800 })).toBe("120 m²");
    expect(logQuantityText({ basis: "hourly", unit: null, quantity: 600, hours: 600 })).toBe("6 h");
    expect(logQuantityText({ basis: "lump_sum", unit: null, quantity: 0, hours: 800 })).toBe("8 h");
  });
});

describe("stageAlertNote", () => {
  it("is plain words for over and trending", () => {
    expect(stageAlertNote({ level: "over", severity: "over", byCents: 10000 })).toBe("$100.00 over budget");
    expect(stageAlertNote({ level: "trending", severity: "watch", byCents: 77500 })).toBe("Trending $775.00 over budget");
  });
});
