import { describe, expect, it } from "vitest";
import { basisLabel, buildEntries, canLog, crewDayHint, exceptionFor, initialException, pickableIds, usablePicks } from "./log-input";

const crew = (over: object) => ({
  crewMemberId: "c1", name: "Sam", type: "employee" as const, basis: "daily" as const, unit: null,
  standardHours: 800, timeOnly: false, loggedOnDate: false, noWorkOnDate: null, ...over,
});

describe("crew-day grid input", () => {
  it("labels the usual basis", () => {
    expect(basisLabel(crew({}))).toBe("Day");
    expect(basisLabel(crew({ basis: "hourly" }))).toBe("Hourly");
    expect(basisLabel(crew({ basis: "time_only", unit: "m2" }))).toBe("m²");
    expect(basisLabel(crew({ basis: "time_only", unit: "lm" }))).toBe("lm");
    expect(basisLabel(crew({ basis: "time_only", unit: "each" }))).toBe("Each");
    expect(basisLabel(crew({ basis: "time_only" }))).toBe("Hours only");
  });

  it("picks the exception control and its starting value", () => {
    expect(exceptionFor("daily")).toBe("half-day");
    expect(exceptionFor("hourly")).toBe("hours");
    expect(exceptionFor("time_only")).toBe("hours");
    expect(initialException(crew({}))).toBe(100);
    expect(initialException(crew({ basis: "hourly" }))).toBe(800);
    expect(initialException(crew({ basis: "time_only" }))).toBe(800);
  });

  it("builds entries for the ticked people only, on their basis", () => {
    const people = [
      crew({ crewMemberId: "a" }),
      crew({ crewMemberId: "b", basis: "hourly" }),
      crew({ crewMemberId: "c", basis: "time_only", unit: "m2" }),
      crew({ crewMemberId: "d" }),
    ];
    const entries = buildEntries(people, new Set(["a", "b", "c"]), { a: 50, b: 650, c: 800 });
    expect(entries).toEqual([
      { crewMemberId: "a", basis: "daily", days: 50, hours: 400, multiplier: null },
      { crewMemberId: "b", basis: "hourly", days: null, hours: 650, multiplier: 100 },
      { crewMemberId: "c", basis: "time_only", days: null, hours: 800, multiplier: null },
    ]);
  });

  it("a person with no exception set gets their starting value", () => {
    expect(buildEntries([crew({})], new Set(["c1"]), {})).toEqual([
      { crewMemberId: "c1", basis: "daily", days: 100, hours: 800, multiplier: null },
    ]);
  });

  it("never ticks or saves someone marked no work or already logged that day", () => {
    const people = [
      crew({ crewMemberId: "a" }),
      crew({ crewMemberId: "b", noWorkOnDate: "sick" }),
      crew({ crewMemberId: "c", loggedOnDate: true }),
    ];
    expect(people.map(canLog)).toEqual([true, false, false]);
    expect(pickableIds(people, ["a", "b", "c", "zzz"])).toEqual(["a"]);
    expect(buildEntries(people, new Set(["a", "b", "c"]), {}).map((e) => e.crewMemberId)).toEqual(["a"]);
  });

  it("hourly people carry their overtime multiplier; others never do", () => {
    const people = [crew({ crewMemberId: "a", basis: "hourly" }), crew({ crewMemberId: "b", basis: "hourly" }), crew({ crewMemberId: "c", basis: "time_only" })];
    const entries = buildEntries(people, new Set(["a", "b", "c"]), {}, { a: 150, c: 200 });
    expect(entries.map((e) => e.multiplier)).toEqual([150, 100, null]);
  });
});

describe("picks carried from an address", () => {
  const crew = [
    { crewMemberId: "day", basis: "daily" as const },
    { crewMemberId: "hourly", basis: "hourly" as const },
    { crewMemberId: "time", basis: "time_only" as const },
  ];

  it("keeps a half or full day for a daily person, and hours (with overtime for hourly only) for everyone else", () => {
    expect(
      usablePicks(crew, { day: 50, hourly: 950, time: 800 }, { hourly: 150, time: 150, day: 200 }),
    ).toEqual({ values: { day: 50, hourly: 950, time: 800 }, multipliers: { hourly: 150 } });
  });

  it("drops a value that means nothing on the person's basis now (hours on a day person, a day on an hours person)", () => {
    expect(usablePicks(crew, { day: 800, hourly: 100, time: 5000 }, {})).toEqual({ values: { hourly: 100 }, multipliers: {} });
  });

  it("drops people who are not on the crew", () => {
    expect(usablePicks(crew, { ghost: 50 }, { ghost: 150 })).toEqual({ values: {}, multipliers: {} });
  });
});

describe("the line under Save day", () => {
  it("names only what is missing", () => {
    expect(crewDayHint({ job: false, stage: false, people: false })).toBe("Choose a job and a stage, and tick at least one person.");
    expect(crewDayHint({ job: true, stage: false, people: false })).toBe("Choose a stage and tick at least one person.");
    expect(crewDayHint({ job: true, stage: true, people: false })).toBe("Tick at least one person.");
    expect(crewDayHint({ job: true, stage: false, people: true })).toBe("Choose a stage.");
    expect(crewDayHint({ job: false, stage: false, people: true })).toBe("Choose a job and a stage.");
    expect(crewDayHint({ job: true, stage: true, people: true })).toBeUndefined();
  });
});
