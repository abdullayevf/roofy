import { describe, expect, it } from "vitest";
import type { AttentionItem } from "@/data/contracts";
import { attentionSentence, daysSinceText, jobAlertText, stageLine } from "./home-text";

const base = { id: "a", severity: "watch" as const, href: "/x" };
const TODAY = "2026-09-28";

describe("attentionSentence", () => {
  it("over budget names the job, the stage and the amount", () => {
    const item: AttentionItem = {
      ...base, severity: "over", kind: "over_budget", projectId: "p", projectName: "Smith job",
      stageId: "s", stageName: "Sheet install", byCents: 77500,
    };
    expect(attentionSentence(item, TODAY)).toBe("Smith job is $775.00 over on sheet install.");
  });

  it("trending over says trending", () => {
    const item: AttentionItem = {
      ...base, kind: "trending_over", projectId: "p", projectName: "Smith job",
      stageId: "s", stageName: "Sheet install", byCents: 77500,
    };
    expect(attentionSentence(item, TODAY)).toBe("Smith job is trending $775.00 over on sheet install.");
  });

  it("a long pause gives the reason and the working days", () => {
    const item: AttentionItem = {
      ...base, kind: "paused_too_long", projectId: "p", projectName: "Kelly job", stageId: "s",
      stageName: "Flashings", reason: "materials", since: "2026-09-14", workingDays: 10,
    };
    expect(attentionSentence(item, TODAY)).toBe("Flashings on Kelly job has been paused 10 working days (materials).");
  });

  it("logging gaps: one person, then several", () => {
    const one: AttentionItem = {
      ...base, kind: "logging_gaps", period: { start: "2026-09-21", end: "2026-09-27" },
      gaps: [{ crewMemberId: "c", name: "Sam", dates: ["2026-09-22", "2026-09-23"] }],
    };
    expect(attentionSentence(one, TODAY)).toBe("Sam has 2 days with no log last week.");
    const many: AttentionItem = {
      ...one, gaps: [
        { crewMemberId: "c", name: "Sam", dates: ["2026-09-22"] },
        { crewMemberId: "d", name: "Dima", dates: ["2026-09-22"] },
        { crewMemberId: "e", name: "Lee", dates: ["2026-09-24"] },
      ],
    } as AttentionItem;
    expect(attentionSentence(many, TODAY)).toBe("Sam and 2 others have days with no log last week.");
  });

  it("unpaid too long, below floor, outbox", () => {
    expect(
      attentionSentence({ ...base, kind: "unpaid_too_long", crewMemberId: "c", name: "Lee", balanceCents: 100000, since: "2026-09-14" }, TODAY),
    ).toBe("Lee has been owed $1,000.00 since Mon 14 Sep.");
    expect(
      attentionSentence({ ...base, kind: "below_floor", crewMemberId: "c", name: "Tom", payRunId: "r", shortfallCents: 4250 }, TODAY),
    ).toBe("Tom is $42.50 under the award minimum in this pay run.");
    expect(attentionSentence({ ...base, kind: "outbox_attention", count: 1 }, TODAY)).toBe("1 entry on this phone needs attention.");
    expect(attentionSentence({ ...base, kind: "outbox_attention", count: 3 }, TODAY)).toBe("3 entries on this phone need attention.");
  });
});

describe("home text helpers", () => {
  it("days since last log", () => {
    expect(daysSinceText(null)).toBe("Nothing logged yet");
    expect(daysSinceText(0)).toBe("Logged today");
    expect(daysSinceText(1)).toBe("Last logged yesterday");
    expect(daysSinceText(3)).toBe("Last logged 3 days ago");
  });

  it("job alert text", () => {
    expect(jobAlertText({ level: "over", severity: "over", byCents: 5000 })).toEqual({ tone: "over", text: "$50.00 over budget" });
    expect(jobAlertText({ level: "trending", severity: "watch", byCents: 77500 })).toEqual({ tone: "watch", text: "Trending $775.00 over budget" });
    expect(jobAlertText(null)).toBeNull();
  });

  it("stage line lists current stages with pause reasons", () => {
    expect(stageLine([])).toBe("No stage started");
    expect(stageLine([{ stageId: "1", name: "Sheet install", status: "active", pauseReason: null }])).toBe("Sheet install");
    expect(
      stageLine([
        { stageId: "1", name: "Sheet install", status: "active", pauseReason: null },
        { stageId: "2", name: "Flashings", status: "paused", pauseReason: "weather" },
      ]),
    ).toBe("Sheet install, Flashings (paused: weather)");
  });
});
