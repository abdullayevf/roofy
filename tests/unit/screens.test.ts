import { describe, expect, it } from "vitest";
import { memberSchema } from "../../src/data/admin-inputs";
import { getSeed } from "../../src/data/fake/store";
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

describe("capture routes use real seed ids", () => {
  const seed = getSeed();
  const payRunIds = new Set(seed.payRuns.map((r) => r.id));

  it("no pay route holds a :param stand-in, and every /pay/<id> is a seeded pay run", () => {
    expect("runId" in PLACEHOLDER_IDS).toBe(false);
    for (const screen of SCREENS) {
      const raw = /^\/pay\/([^/?]+)/.exec(screen.route)?.[1];
      if (raw === undefined) continue;
      expect(raw.startsWith(":"), `${screen.id} still has a placeholder: ${screen.route}`).toBe(false);
      expect(payRunIds.has(raw), `${screen.id} points at ${raw}, which is not a seeded pay run`).toBe(true);
    }
  });

  it("every default stand-in id is a real seed id, so a capture cannot 404 on a made-up one", () => {
    const known = new Set<string>([
      ...seed.projects.map((p) => p.id),
      ...seed.stages.map((s) => s.id),
      ...seed.crewMembers.map((c) => c.id),
      ...seed.expenses.map((e) => e.id),
      ...seed.meta.statementTokens.map((t) => t.token),
      "job-profitability",
    ]);
    for (const [name, value] of Object.entries(PLACEHOLDER_IDS)) {
      expect(known.has(value), `PLACEHOLDER_IDS.${name} = ${value} is not a seed id`).toBe(true);
    }
  });
});

describe("field-2 filled-flow captures", () => {
  const field2 = SCREENS.filter((s) => s.group === "field-2");
  const byId = (id: string) => field2.find((s) => s.id === id);

  it("shows the crew-day filled, saved, already-logged and saved-with-no-signal, and the outbox with all four groups", () => {
    expect(byId("log-crew-day-filled")?.route).toMatch(/^\/log\?same=1&ex=.+:50$/);
    expect(byId("log-crew-day-saved")?.steps).toEqual(["Save day"]);
    expect(byId("log-crew-day-logged-today")?.steps).toEqual(["Save day", "wait:Logged:", "Log another stage"]);
    expect(byId("log-crew-day-offline-saved")).toMatchObject({ states: ["offline"], goOffline: true, steps: ["Save day"] });
    expect(byId("outbox")?.states).toContain("mixed");
  });

  it("waits for the saved day before it switches to No work, and checks the blocked row is on the page", () => {
    // Task 23 fix 2: a fixed 300 ms after "Save day" lost the race with the sync push about one run in three, so the
    // No work page was drawn before Jake's log existed and the baseline silently held an enabled row.
    const blocked = byId("log-no-work-blocked");
    expect(blocked?.steps).toEqual(["Save day", "wait:Logged: Jake", "radio:No work"]);
    expect(blocked?.expectStill).toBe("Jake already has a log today.");
  });

  it("never presses a switch option straight after a save without waiting for the saved outcome", () => {
    // A save is a network round trip of 250 to 450 ms, longer than the runners' fixed pause after a button.
    const racy = SCREENS.filter((s) =>
      (s.steps ?? []).some((step, i, all) => /^radio:/.test(step) && /^Save\b/.test(all[i - 1] ?? "")),
    );
    expect(racy.map((s) => s.id)).toEqual([]);
  });

  it("holds every capture after a Save step until the saved text is on the page, never a fixed pause", () => {
    // Task 23 fix 3: the same 300 ms pause after "Save day" / "Save progress" / "Save no work" was the whole wait on
    // five more captures. A screen with a Save step needs `expectStill` (the saved text before the shot) or a later
    // "wait:" step (before the next press).
    const unproven = SCREENS.filter((s) => {
      const steps = s.steps ?? [];
      return steps.some((step, i) => /^Save\b/.test(step) && !s.expectStill && !steps.slice(i + 1).some((next) => next.startsWith("wait:")));
    });
    expect(unproven.map((s) => s.id)).toEqual([]);
  });

  it("names the saved text each field-2 save capture waits for", () => {
    expect(byId("log-crew-day-saved")?.expectStill).toBe("Logged:");
    expect(byId("log-crew-day-offline-saved")?.expectStill).toBe("Saved on this device:");
    expect(byId("log-progress-saved")?.expectStill).toBe("Logged:");
    expect(byId("log-no-work-saved")?.expectStill).toBe("Saved:");
    expect(byId("log-crew-day-logged-today")?.steps).toEqual(["Save day", "wait:Logged:", "Log another stage"]);
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

describe("entry-settings invite captures", () => {
  const seedEmails = new Set(getSeed().members.map((m) => m.email.toLowerCase()));
  const emailOf = (steps: string[] = []) => steps.find((s) => s.startsWith("fill:Email="))?.slice("fill:Email=".length);
  const invites = SCREENS.filter((s) => s.group === "entry-settings" && s.steps?.includes("Send invite"));

  it("an invite that is meant to be sent uses an email nobody in the seed already has", () => {
    const sent = invites.filter((s) => s.expectStill === "Invite sent.");
    expect(sent.length).toBeGreaterThan(0);
    for (const screen of sent) {
      const email = emailOf(screen.steps)?.toLowerCase();
      expect(email, `${screen.id} fills an email`).toBeTruthy();
      expect(seedEmails.has(email!), `${screen.id} invites ${email}, who is already a member, so "Invite sent." never shows`).toBe(false);
    }
  });

  it("an invite that is meant to be sent passes the server's own name and email checks", () => {
    for (const screen of invites.filter((s) => s.expectStill === "Invite sent.")) {
      const name = screen.steps!.find((s) => s.startsWith("fill:Name="))!.slice("fill:Name=".length);
      const email = emailOf(screen.steps)!;
      const r = memberSchema.safeParse({ name, email, role: "foreman" });
      expect(r.success, `${screen.id}: ${JSON.stringify(r.error?.issues.map((i) => i.message))}`).toBe(true);
    }
  });

  it("shows the refusal for an email that is already a member", () => {
    const refused = invites.filter((s) => s.expectStill === "Someone with that email is already a member.");
    expect(refused.length).toBe(1);
    expect(seedEmails.has(emailOf(refused[0]!.steps)!.toLowerCase())).toBe(true);
  });
});
