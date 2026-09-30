import { describe, expect, it } from "vitest";
import {
  editHref,
  parseEntryPicks,
  parseLocalDate,
  equalShares,
  groupOutbox,
  hundredthsText,
  outboxLine,
  parseHundredths,
  progressAfter,
  shareTotalError,
  sharesFromText,
} from "./field-input";
import type { OutboxItem } from "@/data/contracts";

describe("typed quantities and percentages", () => {
  it("reads whole and decimal numbers as hundredths", () => {
    expect(parseHundredths("120")).toBe(12000);
    expect(parseHundredths(" 12.5 ")).toBe(1250);
    expect(parseHundredths("0.05")).toBe(5);
    expect(parseHundredths("7.")).toBe(700);
    expect(parseHundredths(".5")).toBe(50);
  });

  it("refuses anything that is not a plain number with at most two decimals", () => {
    for (const bad of ["", " ", "abc", "1.234", "-5", "1,5", "1e3", "."]) expect(parseHundredths(bad)).toBeNull();
  });

  it("writes hundredths back the way a person would type them", () => {
    expect(hundredthsText(12000)).toBe("120");
    expect(hundredthsText(3334)).toBe("33.34");
    expect(hundredthsText(5)).toBe("0.05");
    expect(hundredthsText(1250)).toBe("12.5");
  });
});

describe("splitting progress", () => {
  it("splits 100% equally, the extra basis point going to the first person", () => {
    expect(equalShares(2)).toEqual([5000, 5000]);
    expect(equalShares(3)).toEqual([3334, 3333, 3333]);
  });

  it("turns typed percentages into basis points and says what the total is", () => {
    expect(sharesFromText(["60", "40"])).toEqual({ bp: [6000, 4000], total: 10000 });
    expect(sharesFromText(["60", "32"])).toEqual({ bp: [6000, 3200], total: 9200 });
    expect(sharesFromText(["60", ""])).toEqual({ bp: [6000, 0], total: 6000 });
  });

  it("words the error under the share field", () => {
    expect(shareTotalError(9200)).toBe("Shares must add up to 100%. Currently 92%.");
    expect(shareTotalError(10050)).toBe("Shares must add up to 100%. Currently 100.5%.");
    expect(shareTotalError(10000)).toBeNull();
  });

  it("moves the stage's tape from 30% to 60% for 120 m² of 400 m²", () => {
    expect(progressAfter({ done: 12000, planned: 40000 }, 12000)).toEqual({ done: 24000, percent: 60 });
    expect(progressAfter({ done: 12000, planned: null }, 12000)).toEqual({ done: 24000, percent: null });
    expect(progressAfter({ done: 39000, planned: 40000 }, 5000)).toEqual({ done: 44000, percent: 100 });
  });
});

const item = (over: Partial<OutboxItem> & Pick<OutboxItem, "entry" | "state">): OutboxItem => ({
  date: "2026-09-28", projectName: "Smith job", stageName: "Sheet install", crewNames: ["Sam", "Dima"], rejection: null, ...over,
});
const crewDay = { id: "1", type: "crew_day" as const, createdAt: "", input: { date: "2026-09-28", projectId: "p", stageId: "s", entries: [{ crewMemberId: "c1", basis: "daily" as const, days: 100, hours: 800, multiplier: null }] } };
const progress = { id: "2", type: "progress" as const, createdAt: "", input: { stageId: "s", date: "2026-09-28", quantity: 4000, crewMemberIds: ["c1", "c2"], shares: { mode: "equal" as const }, photoFileId: null, note: null } };
const noWork = { id: "3", type: "no_work" as const, createdAt: "", input: { crewMemberIds: ["c3"], date: "2026-09-28", reason: "rain" as const, note: null } };

describe("outbox", () => {
  it("groups by state in the order a person acts: Needs attention, Sending, Waiting, Sent; empty groups are left out", () => {
    const items = [
      item({ entry: crewDay, state: "sent" }),
      item({ entry: progress, state: "waiting" }),
      item({ entry: noWork, state: "needs_attention" }),
      item({ entry: crewDay, state: "waiting" }),
    ];
    const groups = groupOutbox(items);
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([["Needs attention", 1], ["Waiting", 2], ["Sent", 1]]);
    expect(groupOutbox([])).toEqual([]);
  });

  it("describes each entry in one plain line", () => {
    expect(outboxLine(item({ entry: crewDay, state: "waiting" }))).toEqual({ kind: "Crew day", detail: "Smith job, Sheet install: Sam, Dima" });
    expect(outboxLine(item({ entry: progress, state: "waiting" }))).toEqual({ kind: "Progress", detail: "Smith job, Sheet install: Sam, Dima" });
    expect(outboxLine(item({ entry: noWork, state: "waiting", projectName: null, stageName: null, crewNames: ["Jake"] }))).toEqual({ kind: "No work", detail: "Rain: Jake" });
  });

  it("opens the original screen filled in with everything that was entered", () => {
    expect(editHref(crewDay)).toBe("/log?date=2026-09-28&project=p&stage=s&crew=c1&ex=c1%3A100");
    const yesterday = {
      ...crewDay,
      input: {
        ...crewDay.input,
        date: "2026-09-27",
        entries: [
          { crewMemberId: "c1", basis: "daily" as const, days: 50, hours: 400, multiplier: null },
          { crewMemberId: "c2", basis: "hourly" as const, days: null, hours: 950, multiplier: 150 },
          { crewMemberId: "c3", basis: "time_only" as const, days: null, hours: 800, multiplier: null },
        ],
      },
    };
    expect(editHref(yesterday)).toBe(
      "/log?date=2026-09-27&project=p&stage=s&crew=c1%2Cc2%2Cc3&ex=c1%3A50%2Cc2%3A950%3A150%2Cc3%3A800",
    );
    expect(editHref(progress)).toBe("/log/progress?date=2026-09-28&stage=s&qty=4000&crew=c1%2Cc2");
    expect(editHref({ ...progress, input: { ...progress.input, shares: { mode: "custom", bp: [6000, 4000] } } })).toBe(
      "/log/progress?date=2026-09-28&stage=s&qty=4000&crew=c1%2Cc2&shares=6000%2C4000",
    );
    expect(editHref(noWork)).toBe("/log/no-work?date=2026-09-28&crew=c3&reason=rain");
    expect(editHref({ ...noWork, input: { ...noWork.input, date: "2026-09-27", note: "Site flooded" } })).toBe(
      "/log/no-work?date=2026-09-27&crew=c3&reason=rain&note=Site+flooded",
    );
  });
});

describe("reading an edit address", () => {
  it("accepts a real calendar date and nothing else", () => {
    expect(parseLocalDate("2026-09-27")).toBe("2026-09-27");
    for (const bad of ["", undefined, "2026-9-27", "2026-02-30", "2026-13-01", "yesterday", "2026-09-27x", "27/09/2026"])
      expect(parseLocalDate(bad)).toBeNull();
  });

  it("reads each person's days or hours, and overtime, from the address", () => {
    expect(parseEntryPicks("c1:50,c2:950:150,c3:800")).toEqual({
      values: { c1: 50, c2: 950, c3: 800 },
      multipliers: { c2: 150 },
    });
    expect(parseEntryPicks(undefined)).toEqual({ values: {}, multipliers: {} });
  });

  it("ignores anything that is not a whole number or a known overtime rate", () => {
    expect(parseEntryPicks("c1:abc,c2:-5,c3:800:175,:100,c4:2.5,c5:0")).toEqual({ values: { c3: 800 }, multipliers: {} });
  });
});
