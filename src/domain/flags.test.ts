import { describe, expect, it } from "vitest";
import { doublePayFlags, duplicateFlags, pausedStageFlags, type FlagLog } from "./flags";

const log = (p: Partial<FlagLog> & Pick<FlagLog, "id" | "basis">): FlagLog => ({
  crewMemberId: "sam",
  date: "2026-09-16",
  stageId: "sheet",
  source: "grid",
  entryId: "e1",
  ...p,
});

describe("doublePayFlags", () => {
  it("E4.4 a grid time-only log plus a progress per-unit log is not double pay", () => {
    expect(
      doublePayFlags([
        log({ id: "t", basis: "time_only" }),
        log({ id: "p", basis: "per_unit", source: "progress", entryId: "pe1" }),
      ]),
    ).toEqual([]);
  });
  it("flags daily and per-unit pay on the same stage and date", () => {
    expect(
      doublePayFlags([
        log({ id: "d", basis: "daily" }),
        log({ id: "p", basis: "per_unit", source: "progress", entryId: "pe1" }),
        log({ id: "other-day", basis: "daily", date: "2026-09-17" }),
      ]),
    ).toEqual([{ crewMemberId: "sam", date: "2026-09-16", stageId: "sheet", logIds: ["d", "p"] }]);
  });
  it("ignores adjustments", () => {
    expect(
      doublePayFlags([
        log({ id: "d", basis: "daily" }),
        log({ id: "a", basis: "lump_sum", source: "adjustment" }),
      ]),
    ).toEqual([]);
  });
});

describe("duplicateFlags", () => {
  it("flags the same person/date/stage/basis entered by two different entries", () => {
    expect(
      duplicateFlags([
        log({ id: "m", basis: "daily", entryId: "manager-grid" }),
        log({ id: "f", basis: "daily", entryId: "foreman-grid" }),
      ]),
    ).toEqual([{ crewMemberId: "sam", date: "2026-09-16", stageId: "sheet", logIds: ["m", "f"] }]);
  });
  it("does not flag logs from the same entry or adjustments", () => {
    expect(
      duplicateFlags([
        log({ id: "a", basis: "hourly", entryId: "g" }),
        log({ id: "b", basis: "hourly", entryId: "g" }),
        log({ id: "adj", basis: "hourly", source: "adjustment", entryId: "z" }),
      ]),
    ).toEqual([]);
  });
  it("flags duplicate time-only logs from two grids (hours would double-count)", () => {
    expect(
      duplicateFlags([
        log({ id: "t1", basis: "time_only", entryId: "x" }),
        log({ id: "t2", basis: "time_only", entryId: "y" }),
      ]),
    ).toEqual([{ crewMemberId: "sam", date: "2026-09-16", stageId: "sheet", logIds: ["t1", "t2"] }]);
  });
});

describe("pausedStageFlags", () => {
  it("flags logs dated when the stage was paused, done or never started", () => {
    const segments = new Map([
      ["sheet", [{ start: "2026-09-07", end: "2026-09-10", pauseReason: "weather" as const }]],
    ]);
    expect(
      pausedStageFlags(
        [
          log({ id: "ok", basis: "daily", date: "2026-09-08" }),
          log({ id: "paused", basis: "daily", date: "2026-09-11" }),
          log({ id: "unknown-stage", basis: "daily", stageId: "gutters" }),
          log({ id: "adj", basis: "daily", date: "2026-09-11", source: "adjustment" }),
        ],
        segments,
      ),
    ).toEqual(["paused", "unknown-stage"]);
  });
});
