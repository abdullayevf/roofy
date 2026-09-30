import { describe, expect, it } from "vitest";
import type { AttentionItem } from "@/data/contracts";
import {
  attentionSentence,
  daysSinceText,
  jobAlertText,
  logStatusText,
  showMoreText,
  outboxStatus,
  payFlagsText,
  stageLine,
  stageForecastLine,
  loggedOnDevice,
  figuresFromText,
  foremanHeadline,
  unsentJobIds,
} from "./home-text";

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
    expect(attentionSentence(item, TODAY)).toBe("Flashings on Kelly job: paused 10 working days, waiting on materials.");
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
    const one = { ...base, kind: "outbox_attention" as const, count: 1 };
    expect(attentionSentence({ ...one, entries: [{ type: "crew_day", crewNames: ["Kev"], jobName: "Smith job" }] }, TODAY)).toBe(
      "Kev's hours for Smith job didn't send. Tap to fix.",
    );
    expect(attentionSentence({ ...one, entries: [{ type: "progress", crewNames: ["Mick", "Josh"], jobName: null }] }, TODAY)).toBe(
      "Mick and Josh's progress didn't send. Tap to fix.",
    );
    expect(attentionSentence({ ...one, entries: [{ type: "no_work", crewNames: ["A", "B", "C"], jobName: null }] }, TODAY)).toBe(
      "A and 2 others' no-work note didn't send. Tap to fix.",
    );
    expect(attentionSentence({ ...one, entries: [{ type: "expense", crewNames: [], jobName: "Smith job" }] }, TODAY)).toBe(
      "Expense for Smith job didn't send. Tap to fix.",
    );
    expect(attentionSentence({ ...base, kind: "outbox_attention", count: 3, entries: [] }, TODAY)).toBe(
      "3 entries on this device didn't send. Tap to fix.",
    );
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
    expect(jobAlertText({ level: "over", severity: "over", byCents: 5000 }, "Clean-up")).toEqual({
      tone: "over",
      text: "Clean-up is $50.00 over its labour budget.",
    });
    expect(jobAlertText({ level: "trending", severity: "watch", byCents: 77500 }, "Sheet install")).toEqual({
      tone: "watch",
      text: "Sheet install is trending $775.00 over its labour budget.",
    });
    expect(jobAlertText(null, null)).toBeNull();
    expect(jobAlertText({ level: "over", severity: "over", byCents: 5000 }, null)?.text).toBe("$50.00 over its labour budget.");
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

describe("outboxStatus", () => {
  it("says everything is sent when nothing is waiting", () => {
    expect(outboxStatus([])).toEqual({ tone: "clear", text: "Everything on this device has been sent." });
    expect(outboxStatus([{ state: "sent" }])).toEqual({ tone: "clear", text: "Everything on this device has been sent." });
  });

  it("counts entries waiting or sending", () => {
    expect(outboxStatus([{ state: "waiting" }])).toEqual({ tone: "waiting", text: "1 entry is waiting to send." });
    expect(outboxStatus([{ state: "waiting" }, { state: "sending" }, { state: "sent" }])).toEqual({
      tone: "waiting",
      text: "2 entries are waiting to send.",
    });
  });

  it("puts entries that need attention first", () => {
    expect(outboxStatus([{ state: "needs_attention" }, { state: "waiting" }])).toEqual({
      tone: "attention",
      text: "1 entry needs attention.",
    });
    expect(outboxStatus([{ state: "needs_attention" }, { state: "needs_attention" }]).text).toBe("2 entries need attention.");
  });
});

describe("showMoreText", () => {
  it("counts the items left off", () => {
    expect(showMoreText(1)).toBe("Show 1 more");
    expect(showMoreText(3)).toBe("Show 3 more");
  });
});

describe("logStatusText", () => {
  it("says nothing is logged yet, or which job and how many people", () => {
    expect(logStatusText({ jobs: [], crewCount: 0 })).toBe("Not logged yet today");
    expect(logStatusText({ jobs: ["Smith job"], crewCount: 3 })).toBe("Logged: Smith job, 3 crew");
    expect(logStatusText({ jobs: ["Smith job", "Patel job"], crewCount: 5 })).toBe("Logged: 2 jobs, 5 crew");
  });
});

describe("payFlagsText", () => {
  it("asks a manager to check before approving, and an accountant to check the run", () => {
    expect(payFlagsText(1, [], "manager")).toBe("1 thing to check before you approve.");
    expect(payFlagsText(6, [{ kind: "missing_rate", crewName: "Tom" }], "owner")).toBe(
      "6 things to check before you approve. Missing rate for Tom stops approval.",
    );
    expect(payFlagsText(6, [{ kind: "owner_2fa_off", crewName: null }], "manager")).toBe(
      "6 things to check before you approve. Two-factor sign-in is off and stops approval.",
    );
    expect(
      payFlagsText(6, [{ kind: "missing_rate", crewName: "Tom" }, { kind: "missing_rate", crewName: "Kev" }], "owner"),
    ).toBe("6 things to check before you approve. Missing rate for Tom stops approval. 1 more also stops it.");
    expect(payFlagsText(6, [], "accountant")).toBe("6 things to check in this pay run.");
    expect(payFlagsText(1, [], "accountant")).toBe("1 thing to check in this pay run.");
  });
});

describe("stageForecastLine", () => {
  it("names the stage with its own forecast and budget", () => {
    expect(stageForecastLine("Clean-up", 410_000, 400_000)).toBe("Clean-up: $4,100.00 forecast of $4,000.00 budget");
  });
});

describe("loggedOnDevice", () => {
  const item = (state: "waiting" | "sending" | "needs_attention" | "sent", type: string, date: string) => ({
    state,
    date,
    entry: { type, input: {} },
  });
  it("is true for a crew-day for today that is waiting, sending or needs attention", () => {
    for (const state of ["waiting", "sending", "needs_attention"] as const)
      expect(loggedOnDevice([item(state, "crew_day", TODAY)], TODAY)).toBe(true);
  });
  it("ignores sent entries, other days and other kinds of entry", () => {
    expect(loggedOnDevice([item("sent", "crew_day", TODAY)], TODAY)).toBe(false);
    expect(loggedOnDevice([item("waiting", "crew_day", "2026-09-25")], TODAY)).toBe(false);
    expect(loggedOnDevice([item("waiting", "progress", TODAY)], TODAY)).toBe(false);
  });
});

describe("foremanHeadline", () => {
  const none = { jobs: [], crewCount: 0 };
  const item = (state: "waiting" | "needs_attention" | "sent", type = "crew_day", date = TODAY) => ({
    state,
    date,
    entry: { type, input: { projectId: "p1" } },
  });
  it("an entry needing attention comes first, with the fix button", () => {
    expect(foremanHeadline(none, [item("needs_attention")], TODAY)).toEqual({ text: "1 entry needs fixing", fix: true });
    expect(foremanHeadline({ jobs: ["Smith job"], crewCount: 2 }, [item("needs_attention"), item("needs_attention", "progress")], TODAY)).toEqual({
      text: "2 entries need fixing",
      fix: true,
    });
  });
  it("then a crew-day waiting on this device", () => {
    expect(foremanHeadline(none, [item("waiting")], TODAY)).toEqual({ text: "Logged, not sent yet", fix: false });
  });
  it("then what the server has, else not logged yet", () => {
    expect(foremanHeadline({ jobs: ["Smith job"], crewCount: 3 }, [], TODAY)).toEqual({ text: "Logged: Smith job, 3 crew", fix: false });
    expect(foremanHeadline(none, [item("sent"), item("waiting", "progress")], TODAY)).toEqual({ text: "Not logged yet today", fix: false });
  });
});

describe("unsentJobIds", () => {
  it("is the jobs with a crew-day for today that is waiting or needs attention", () => {
    const mk = (state: "waiting" | "sent" | "needs_attention", type: string, date: string, projectId: string) => ({
      state, date, entry: { type, input: { projectId } },
    });
    const ids = unsentJobIds(
      [mk("waiting", "crew_day", TODAY, "a"), mk("needs_attention", "crew_day", TODAY, "b"), mk("sent", "crew_day", TODAY, "c"),
       mk("waiting", "crew_day", "2026-09-25", "d"), mk("waiting", "progress", TODAY, "e")],
      TODAY,
    );
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("figuresFromText", () => {
  it("is one sentence with the time when the figures are from today", () => {
    expect(figuresFromText("2026-09-27T20:20:00.000Z", "Australia/Sydney", "2026-09-28")).toBe("Figures from 6:20 am.");
  });
  it("adds the date when they are from another day", () => {
    expect(figuresFromText("2026-09-25T20:20:00.000Z", "Australia/Sydney", "2026-09-28")).toBe("Figures from Sat 26 Sep, 6:20 am.");
  });
});
