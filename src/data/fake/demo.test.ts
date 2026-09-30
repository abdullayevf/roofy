import { describe, expect, it } from "vitest";
import { expectNoMoney } from "../dto";
import { DEMO_STATES, demoFlags, demoOutbox, isLoadingDemo, parseDemoState } from "./demo";
import { getSeed } from "./store";

const NOW = new Date("2026-09-27T21:00:00Z");

describe("parseDemoState", () => {
  it("accepts the nine states and nothing else", () => {
    expect(DEMO_STATES).toEqual([
      "empty",
      "loading",
      "error",
      "offline",
      "waiting",
      "attention",
      "noperm",
      "blocked",
      "mixed",
    ]);
    for (const s of DEMO_STATES) expect(parseDemoState(s)).toBe(s);
    expect(parseDemoState(["waiting", "error"])).toBe("waiting");
    expect(parseDemoState("EMPTY")).toBeNull();
    expect(parseDemoState("nope")).toBeNull();
    expect(parseDemoState(undefined)).toBeNull();
    expect(parseDemoState(null)).toBeNull();
    expect(parseDemoState([])).toBeNull();
  });
});

describe("demo flags", () => {
  it("loading and offline are flags the page and layout read", () => {
    expect(isLoadingDemo("loading")).toBe(true);
    expect(isLoadingDemo(null)).toBe(false);
    expect(demoFlags("offline", getSeed(), NOW)).toMatchObject({
      state: "offline",
      loading: false,
      offline: true,
    });
    expect(demoFlags(null, getSeed(), NOW)).toEqual({
      state: null,
      loading: false,
      offline: false,
      outbox: [],
    });
  });

  it("waiting: three entries waiting to send (crew day, progress, no work) dated today", () => {
    const items = demoOutbox("waiting", getSeed(), NOW);
    expect(items.map((i) => [i.entry.type, i.state, i.date, i.rejection])).toEqual([
      ["crew_day", "waiting", "2026-09-28", null],
      ["progress", "waiting", "2026-09-28", null],
      ["no_work", "waiting", "2026-09-28", null],
    ]);
    expect(items[0]).toMatchObject({
      projectName: "Smith job — Ryde re-roof",
      stageName: "Sheet install",
      crewNames: ["Sam", "Dima"],
    });
    expect(new Set(items.map((i) => i.entry.id)).size).toBe(3);
    for (const i of items) expectNoMoney(i, `outbox ${i.entry.type}`);
  });

  it("attention: one entry the server rejected, with its reason", () => {
    const items = demoOutbox("attention", getSeed(), NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.state).toBe("needs_attention");
    expect(items[0]!.rejection).toEqual({
      code: "forbidden",
      message: "You don't have access to this job any more. Ask your manager.",
    });
    expectNoMoney(items, "outbox attention");
  });

  it("attention: the entry is on a job the demo foreman is assigned to, so it shows in Your jobs", () => {
    const seed = getSeed();
    const [item] = demoOutbox("attention", seed, NOW);
    const projectId = (item!.entry.input as { projectId: string }).projectId;
    const foreman = seed.members.find((m) => m.role === "foreman")!;
    const assigned = seed.projectAssignments.filter((a) => a.memberId === foreman.id).map((a) => a.projectId);
    expect(assigned).toContain(projectId);
  });

  it("mixed: one entry in each group, with progress and no-work shown too, and none of them money", () => {
    const items = demoOutbox("mixed", getSeed(), NOW);
    expect(items.map((i) => i.state).sort()).toEqual(["needs_attention", "sending", "sent", "waiting"]);
    expect(items.find((i) => i.state === "needs_attention")!.rejection?.message).toBeTruthy();
    expect(items.filter((i) => i.state !== "needs_attention").every((i) => i.rejection === null)).toBe(true);
    expect(items.some((i) => i.entry.type === "progress")).toBe(true);
    expect(new Set(items.map((i) => i.entry.id)).size).toBe(items.length);
    expectNoMoney(items, "outbox mixed");
  });

  it("every other state has an empty outbox", () => {
    for (const s of DEMO_STATES.filter((x) => x !== "waiting" && x !== "attention" && x !== "mixed")) {
      expect(demoOutbox(s, getSeed(), NOW)).toEqual([]);
    }
    expect(demoOutbox(null, getSeed(), NOW)).toEqual([]);
  });
});
