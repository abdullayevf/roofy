import { describe, expect, it } from "vitest";
import type { PayFlag } from "@/data/contracts";
import { draftFlagsText, olderRunsLabel, payRunPeriodText, peopleCountText, RUNS_SHOWN, splitRuns } from "./pay-runs-text";

const flag = (over: Partial<PayFlag>): PayFlag => ({ kind: "gap", blocking: false, crewMemberId: null, crewName: null, dates: [], projectName: null, stageName: null, ...over }) as PayFlag;

describe("pay runs list text", () => {
  it("words the period as two dates", () => {
    expect(payRunPeriodText({ start: "2026-09-21", end: "2026-09-27" }, "2026-09-28")).toBe("Mon\u00a021\u00a0Sep to Sun\u00a027\u00a0Sep");
  });

  it("keeps each date whole (lesson 23): the only plain spaces are around 'to', year included", () => {
    const text = payRunPeriodText({ start: "2025-12-29", end: "2026-01-04" }, "2026-09-28");
    expect(text).toBe("Mon\u00a029\u00a0Dec\u00a02025 to Sun\u00a04\u00a0Jan");
    expect(text.split(" ")).toHaveLength(3);
  });

  it("counts people, keeping the number with its word", () => {
    expect(peopleCountText(1)).toBe("1 person");
    expect(peopleCountText(4)).toBe("4 people");
    expect(peopleCountText(0)).toBe("No one yet");
  });

  it("says nothing to check when a draft has no flags", () => {
    expect(draftFlagsText([], "owner")).toBe("Nothing to check before you approve.");
    expect(draftFlagsText([], "accountant")).toBe("Nothing to check in this pay run.");
  });

  it("counts flags and names what stops approval", () => {
    const flags = [flag({ kind: "missing_rate", blocking: true, crewName: "Dima" }), flag({ kind: "owner_2fa_off", blocking: true }), flag({})];
    expect(draftFlagsText(flags, "manager")).toBe("3 things to check, and Dima's missing rate and 1 more stop approval.");
    expect(draftFlagsText([flag({})], "accountant")).toBe("1 thing to check in this pay run.");
    expect(draftFlagsText([flag({ kind: "missing_rate", blocking: true, crewName: "Jake" }), flag({}), flag({}), flag({}), flag({}), flag({})], "owner")).toBe("6 things to check, and Jake's missing rate stops approval.");
    expect(draftFlagsText([flag({ kind: "owner_2fa_off", blocking: true }), flag({})], "manager")).toBe("2 things to check, and two-factor sign-in being off stops approval.");
    expect(draftFlagsText([flag({ kind: "missing_rate", blocking: true, crewName: null })], "owner")).toBe("1 thing to check, and a missing rate stops approval.");
  });

  it("puts the draft to review first and the rest newest first", () => {
    const run = (id: string, start: string, status: "draft" | "approved" | "exported") => ({ id, period: { start, end: start }, status, totalCents: 0, peopleCount: 1, flagCount: 0, blocking: false, approvedAt: null });
    const runs = [run("now", "2026-09-28", "draft"), run("last", "2026-09-21", "draft"), run("old", "2026-09-14", "exported")];
    const { review, others } = splitRuns(runs, "last");
    expect(review?.id).toBe("last");
    expect(others.map((r) => r.id)).toEqual(["now", "old"]);
    expect(splitRuns(runs, null).review).toBeNull();
  });

  it("hides a draft with no one in it, but never the draft to review", () => {
    const run = (id: string, start: string, status: "draft" | "approved", peopleCount: number) => ({ id, period: { start, end: start }, status, totalCents: 0, peopleCount, flagCount: 0, blocking: false, approvedAt: null });
    const runs = [run("next", "2026-10-05", "draft", 0), run("now", "2026-09-28", "draft", 0), run("last", "2026-09-21", "draft", 3), run("old", "2026-09-14", "approved", 0)];
    expect(splitRuns(runs, "last").others.map((r) => r.id)).toEqual(["old"]);
    expect(splitRuns(runs, "now").others.map((r) => r.id)).toEqual(["last", "old"]);
  });

  it("shows the latest 8 runs and words the button for the rest", () => {
    expect(RUNS_SHOWN).toBe(8);
    expect(olderRunsLabel(false)).toBe("Show older pay runs");
    expect(olderRunsLabel(true)).toBe("Show fewer pay runs");
  });
});
