import { describe, expect, it, vi } from "vitest";
import { todayIn } from "@/domain/dates";
import type { CrewDayDefaults } from "../../contracts";
import { DEFAULT_FAKE_NOW, fakeNow } from "../clock";
import { getSeed } from "../store";
import { fake } from "./testing";

const seed = getSeed();
const { meta } = seed;
const name = (id: string) => seed.crewMembers.find((c) => c.id === id)!.name;

describe("the work date", () => {
  it("todayIn(Australia/Sydney, fakeNow()) is Mon 28 Sep 2026 at the default clock (a Sunday in UTC)", () => {
    vi.stubEnv("ROOFY_FAKE_NOW", undefined);
    try {
      expect(DEFAULT_FAKE_NOW).toBe("2026-09-27T21:00:00Z");
      expect(todayIn("Australia/Sydney", fakeNow())).toBe("2026-09-28");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("crew-day grid defaults", () => {
  it("defaults to today; same as yesterday copies Fri 25 Sep: Smith sheet install, Sam and Dima", async () => {
    const { data, actor } = fake("manager");
    const d = await data.logs.crewDayDefaults(actor);
    expect(d.date).toBe("2026-09-28");
    expect(d.sameAsYesterday).toEqual({
      fromDate: "2026-09-25",
      projectId: meta.projects.smith,
      stageId: meta.stages.smithSheetInstall,
      crewMemberIds: [meta.crew.sam, meta.crew.dima],
    });
    expect(d.projects.map((p) => p.name)).toHaveLength(5);
    expect(d.latestStages[0]!.label).toMatch(/ — /);
    expect(d.crew.map((c) => c.name)).not.toContain("Pete");
  });

  it("on the Smith sheet install, per-unit workers are time-only and Jake is hourly at $24.00", async () => {
    const { data, actor } = fake("manager");
    const d = (await data.logs.crewDayDefaults(actor, { stageId: meta.stages.smithSheetInstall })) as Extract<
      CrewDayDefaults,
      { view: "manager" }
    >;
    expect([d.projectId, d.stageId]).toEqual([meta.projects.smith, meta.stages.smithSheetInstall]);
    const row = (n: string) => d.crew.find((c) => c.name === n)!;
    expect([row("Dima").basis, row("Dima").timeOnly, row("Dima").rateCents]).toEqual([
      "time_only",
      true,
      null,
    ]);
    expect([row("Jake").basis, row("Jake").rateCents, row("Jake").missingRate]).toEqual([
      "hourly",
      2400,
      false,
    ]);
    expect([row("Sam").basis, row("Sam").rateCents]).toEqual(["daily", 32000]);
  });

  it("uses Sam's Ryde heritage override on that job (E1.2)", async () => {
    const { data, actor } = fake("manager");
    const d = (await data.logs.crewDayDefaults(actor, { projectId: meta.projects.rydeHeritage })) as Extract<
      CrewDayDefaults,
      { view: "manager" }
    >;
    expect(d.crew.find((c) => c.name === "Sam")!.rateCents).toBe(36000);
  });

  it("foreman: assigned jobs only, no rates on the chips", async () => {
    const { data, actor } = fake("foreman");
    const d = await data.logs.crewDayDefaults(actor);
    expect(d.view).toBe("foreman");
    expect(d.projects.map((p) => p.name).sort()).toEqual([
      "Patel job — Epping re-roof",
      "Smith job — Ryde re-roof",
    ]);
    expect(d.sameAsYesterday?.projectId).toBe(meta.projects.smith);
    await expect(data.logs.crewDayDefaults(actor, { projectId: meta.projects.harris })).rejects.toMatchObject(
      {
        code: "forbidden",
      },
    );
  });

  it("a new workspace has nothing to copy yet", async () => {
    const { data, actor } = fake("manager", { demo: "empty" });
    const d = await data.logs.crewDayDefaults(actor);
    expect([d.sameAsYesterday, d.projects, d.crew, d.latestStages]).toEqual([null, [], [], []]);
  });
});

describe("log lists", () => {
  it("by day, by person and by stage; a foreman sees assigned jobs only", async () => {
    const m = fake("manager");
    const day = await m.data.logs.byDay(m.actor, "2026-09-25");
    expect(day.rows.length).toBeGreaterThan(5);
    const f = fake("foreman");
    const fday = await f.data.logs.byDay(f.actor, "2026-09-25");
    expect(new Set(fday.rows.map((r) => r.projectId))).toEqual(
      new Set([meta.projects.smith, meta.projects.patel]),
    );
    const jake = await m.data.logs.byPerson(m.actor, meta.crew.jake, {
      from: "2026-09-21",
      to: "2026-09-27",
    });
    expect(jake.rows.every((r) => r.crewName === "Jake")).toBe(true);
    const stage = await m.data.logs.byStage(m.actor, meta.stages.smithSheetInstall);
    expect(stage.rows.map((r) => r.basis).sort()).toEqual([
      "per_unit",
      "per_unit",
      "time_only",
      "time_only",
      "time_only",
      "time_only",
      "time_only",
      "time_only",
    ]);
  });

  it("progress defaults offer the recent unit stages as chips", async () => {
    const { data, actor } = fake("foreman");
    const d = await data.progress.defaults(actor);
    expect(d.latestStages.map((s) => s.label)).toEqual([
      "Smith job — Sheet install",
      "Patel job — Flashings, gutters & downpipes",
    ]);
    expect(d.latestStages[0]).toMatchObject({ unit: "m2", quantityDone: 12000, plannedQuantity: 40000 });
    const rows = await data.progress.byStage(actor, meta.stages.smithSheetInstall);
    expect(rows.rows[0]!.split.map((s) => name(s.crewMemberId))).toEqual(["Sam", "Dima"]);
  });

  it("no-work markers for last week include Jake's rain on Thu", async () => {
    const { data, actor } = fake("foreman");
    const rows = await data.noWork.list(actor, { from: "2026-09-21", to: "2026-09-27" });
    expect(rows).toContainEqual(
      expect.objectContaining({ name: "Jake", date: "2026-09-24", reason: "rain" }),
    );
  });
});
