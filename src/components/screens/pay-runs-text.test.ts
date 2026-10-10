import { describe, expect, it } from "vitest";
import type { PayFlag } from "@/data/contracts";
import { draftFlagsText, payRunPeriodText, peopleCountText, splitRuns } from "./pay-runs-text";

const flag = (over: Partial<PayFlag>): PayFlag => ({ kind: "gap", blocking: false, crewMemberId: null, crewName: null, dates: [], projectName: null, stageName: null, ...over }) as PayFlag;

describe("pay runs list text", () => {
  it("words the period as two dates", () => {
    expect(payRunPeriodText({ start: "2026-09-21", end: "2026-09-27" }, "2026-09-28")).toBe("Mon 21 Sep to Sun 27 Sep");
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
    expect(draftFlagsText(flags, "manager")).toBe("3 things to check before you approve. Missing rate for Dima stops approval. 1 more also stops it.");
    expect(draftFlagsText([flag({})], "accountant")).toBe("1 thing to check in this pay run.");
  });

  it("puts the draft to review first and the rest newest first", () => {
    const run = (id: string, start: string, status: "draft" | "approved" | "exported") => ({ id, period: { start, end: start }, status, totalCents: 0, peopleCount: 1, flagCount: 0, blocking: false, approvedAt: null });
    const runs = [run("now", "2026-09-28", "draft"), run("last", "2026-09-21", "draft"), run("old", "2026-09-14", "exported")];
    const { review, others } = splitRuns(runs, "last");
    expect(review?.id).toBe("last");
    expect(others.map((r) => r.id)).toEqual(["now", "old"]);
    expect(splitRuns(runs, null).review).toBeNull();
  });
});
