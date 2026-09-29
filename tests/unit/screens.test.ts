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
  "direction",
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

  it("the direction group is the two screens in both directions, phone and desktop, light only", () => {
    const direction = SCREENS.filter((s) => s.group === "direction");
    expect(direction.map((s) => s.id).sort()).toEqual([
      "home-challenger",
      "home-galvanised",
      "log-challenger",
      "log-galvanised",
    ]);
    for (const s of direction) {
      expect(s).toMatchObject({ viewports: ["iphone", "desktop"], lightOnly: true, noExtras: true });
    }
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
