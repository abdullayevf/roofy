import { describe, expect, it } from "vitest";
import { PLACEHOLDER_IDS, resolveRoute, SCREENS, type ScreenGroup } from "../e2e/screens";

const KNOWN_GROUPS: ScreenGroup[] = [
  "system",
  "field-1",
  "field-2",
  "jobs-1",
  "jobs-2",
  "crew",
  "expenses",
  "pay",
  "reports",
  "entry-settings",
];

describe("SCREENS manifest", () => {
  it("every screen has a non-empty route, at least one state, and a known group", () => {
    for (const screen of SCREENS) {
      expect(screen.route.startsWith("/")).toBe(true);
      expect(screen.states.length).toBeGreaterThan(0);
      expect(KNOWN_GROUPS).toContain(screen.group);
    }
  });

  it("ids are unique", () => {
    const ids = SCREENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every screen group used by plan Tasks 8 and 11-19", () => {
    const covered = new Set(SCREENS.map((s) => s.group));
    for (const group of KNOWN_GROUPS) expect(covered.has(group)).toBe(true);
  });

  it("every dynamic route segment has a placeholder id", () => {
    for (const screen of SCREENS) {
      const params = [...screen.route.matchAll(/:([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]!);
      for (const param of params) {
        expect(PLACEHOLDER_IDS[param], `no placeholder id for :${param} in ${screen.route}`).toBeDefined();
      }
    }
  });
});

describe("field-2 filled-flow captures", () => {
  const field2 = SCREENS.filter((s) => s.group === "field-2");
  const byId = (id: string) => field2.find((s) => s.id === id);

  it("shows the crew-day filled, saved, already-logged and saved-with-no-signal, and the outbox with all four groups", () => {
    expect(byId("log-crew-day-filled")?.route).toMatch(/^\/log\?same=1&ex=.+:50$/);
    expect(byId("log-crew-day-saved")?.steps).toEqual(["Save day"]);
    expect(byId("log-crew-day-logged-today")?.steps).toEqual(["Save day", "Log another stage"]);
    expect(byId("log-crew-day-offline-saved")).toMatchObject({ states: ["offline"], goOffline: true, steps: ["Save day"] });
    expect(byId("outbox")?.states).toContain("mixed");
  });

  it("shows progress split two ways, the split that does not add up, and the saved tape", () => {
    expect(byId("log-progress-split")?.route).toMatch(/^\/log\/progress\?stage=.+&qty=12000&crew=.+,.+$/);
    expect(byId("log-progress-split-error")?.route).toMatch(/&shares=6000,3200$/);
    expect(byId("log-progress-saved")?.steps).toEqual(["Save progress"]);
  });

  it("keeps the filled captures small: light, phone and desktop, no extras", () => {
    for (const id of ["log-crew-day-filled", "log-progress-split", "log-crew-day-offline-saved"]) {
      expect(byId(id)).toMatchObject({ lightOnly: true, noExtras: true });
    }
  });
});

describe("resolveRoute", () => {
  it("substitutes a single dynamic segment", () => {
    expect(resolveRoute("/jobs/:jobId", { jobId: "abc" })).toBe("/jobs/abc");
  });

  it("substitutes several dynamic segments", () => {
    expect(resolveRoute("/jobs/:jobId/stages/:stageId", { jobId: "j1", stageId: "s1" })).toBe(
      "/jobs/j1/stages/s1",
    );
  });

  it("leaves a route with no dynamic segments unchanged", () => {
    expect(resolveRoute("/jobs")).toBe("/jobs");
  });

  it("throws when an id is missing for a segment in the route", () => {
    expect(() => resolveRoute("/jobs/:jobId", {})).toThrow(/:jobId/);
  });

  it("resolves every manifest route against the default PLACEHOLDER_IDS", () => {
    for (const screen of SCREENS) {
      expect(() => resolveRoute(screen.route)).not.toThrow();
    }
  });
});
