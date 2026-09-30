/**
 * Screen manifest for the design loop (`docs/specs/04-design-process.md` §2/§4)
 * and `scripts/design-capture.ts`. Lists every route from `docs/design/flows.md`'s
 * screen inventory, grouped to match `docs/plans/03-design-prototype.md`
 * Tasks 8 ("system") and 11-19 (screen groups D5 builds through the loop).
 *
 * Routes that don't exist yet are expected — `design-capture.ts` skips a 404
 * with a warning rather than failing the run. Dynamic segments (`:jobId`,
 * `:stageId`, ...) are written as literal placeholders here; `resolveRoute`
 * substitutes them from `PLACEHOLDER_IDS` by default (a fixed stand-in map
 * for now), or a caller can pass its own id map once Task 6's fake seed
 * exposes real ids. `resolveFirstListLink` is the "read it off the list
 * page" alternative flows.md/the task text also allows, for when a fixed id
 * would 404 against whatever the seed actually generated.
 */

import type { Page } from "@playwright/test";

/**
 * `?demo=` states, per `src/data/fake/demo.ts` (Task 6), PLUS the literal
 * "foreman" token used here as shorthand: a screen listing "foreman" in its
 * `states` gets an extra capture of its *normal* state under the
 * `roofy_role=foreman` cookie (never `?demo=foreman`, which isn't a real demo
 * state), showing the same route with the foreman-shaped DTO. See
 * "States every screen designs" in docs/design/flows.md.
 */
export type DemoState =
  "normal" | "empty" | "loading" | "error" | "offline" | "waiting" | "attention" | "noperm" | "foreman";

export type Role = "owner" | "manager" | "foreman" | "accountant";

export type ScreenGroup =
  | "system" // Task 8 — /design
  | "field-1" // Task 11 — Home
  | "field-2" // Task 12 — Log grid, progress, no-work, outbox
  | "jobs-1" // Task 13 — Jobs list, new/edit job
  | "jobs-2" // Task 14 — Job detail, stage detail, stage done
  | "crew" // Task 15 — Crew list/detail, payout
  | "expenses" // Task 16 — Expenses list, add/edit
  | "pay" // Task 17 — Pay runs, review, statement
  | "reports" // Task 18 — Reports, record history, workspace export
  | "entry-settings"; // Task 19 — Sign in/up, onboarding, install, settings, more

export type ScreenSpec = {
  /** Stable id used in the screenshot filename and by --screens filtering. */
  id: string;
  group: ScreenGroup;
  /** Next.js-style route; dynamic segments as `:name`. */
  route: string;
  states: DemoState[];
  /**
   * Roles that can reach this screen at all (drives the `roofy_role` cookie
   * for non-"foreman"-state captures). Empty means "no role gate" — a
   * pre-auth or public-link screen (sign in, the crew statement page).
   */
  roles: Role[];
  /** Capture phone viewports only (iphone, android) — skip desktop. */
  phoneOnly?: boolean;
  /** Capture the desktop viewport only. */
  desktopOnly?: boolean;
  /**
   * Adds a keyboard-open iPhone capture (DESIGN.md §8): focus the field with
   * this label, shrink the viewport by the keyboard's height, and check the
   * field and the named primary action are both still visible and unobstructed.
   */
  keyboard?: { field: string; action: string };
  /**
   * Section headings (level 2) to bring to the top of an extra installed-mode
   * iPhone shot each, for screens whose bars are not fixed to the viewport
   * (the gallery shows the tab bars and pinned sheet actions in place).
   */
  installedSections?: string[];
  /** Capture only these viewports (default: iphone, android, desktop). */
  viewports?: ("iphone" | "android" | "desktop")[];
  /** Capture the light scheme only (default: light and dark). */
  lightOnly?: boolean;
  /** Skip the extra installed-mode, landscape, tablet and keyboard captures. */
  noExtras?: boolean;
};

// All states a field-entry screen a foreman can reach should design: real
// content, the three loading/empty/error states, both outbox-adjacent states
// (offline banner, "N to send"/"needs attention"), and the foreman variant.
const FIELD_STATES: DemoState[] = [
  "normal",
  "empty",
  "loading",
  "error",
  "offline",
  "waiting",
  "attention",
  "foreman",
];

// Admin-only screens never queue offline — they show "Needs connection"
// instead — and have a no-permission state for roles that can't reach them,
// but no outbox states and no foreman variant (foreman can't reach them).
const ADMIN_STATES: DemoState[] = ["normal", "empty", "loading", "error", "offline", "noperm"];

// Plain reads (reports, history) — no writes, so no waiting/attention.
const READ_STATES: DemoState[] = ["normal", "empty", "loading", "error", "offline"];

// Short forms/wizards with little to design beyond the happy path and errors.
const ENTRY_STATES: DemoState[] = ["normal", "error"];

export const SCREENS: ScreenSpec[] = [
  // --- system (Task 8) ------------------------------------------------
  {
    id: "design",
    group: "system",
    route: "/design",
    states: ["normal"],
    roles: ["owner"],
    // The Record payout sheet's amount field, with its pinned Save payout.
    keyboard: { field: "Amount", action: "Save payout" },
    installedSections: ["Navigation", "Sheet"],
  },

  // --- field-1 (Task 11): Home manager (4), Home foreman (5) ----------
  {
    id: "home-manager",
    group: "field-1",
    route: "/",
    states: ["normal", "empty", "loading", "error", "offline", "attention"],
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "home-foreman",
    group: "field-1",
    route: "/",
    states: ["normal", "empty", "loading", "error", "offline", "waiting", "attention"],
    roles: ["foreman"],
  },

  // --- field-2 (Task 12): Log crew-day (6), Progress (7), No-work (8), Outbox (24)
  {
    id: "log-crew-day",
    group: "field-2",
    route: "/log",
    states: FIELD_STATES,
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "log-progress",
    group: "field-2",
    route: "/log/progress",
    states: FIELD_STATES,
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "log-no-work",
    group: "field-2",
    route: "/log/no-work",
    states: ["normal", "empty", "loading", "error", "offline", "waiting", "foreman"],
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "outbox",
    group: "field-2",
    route: "/outbox",
    states: ["normal", "empty", "loading", "error", "offline", "waiting", "attention", "foreman"],
    roles: ["owner", "manager", "foreman"],
  },

  // --- jobs-1 (Task 13): Jobs list (9), New/edit job (10) --------------
  {
    id: "jobs-list",
    group: "jobs-1",
    route: "/jobs",
    states: ["normal", "empty", "loading", "error", "offline", "foreman"],
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "job-new",
    group: "jobs-1",
    route: "/jobs/new",
    states: ENTRY_STATES.concat("loading"),
    roles: ["owner", "manager"],
  },
  {
    id: "job-edit",
    group: "jobs-1",
    route: "/jobs/:jobId/edit",
    states: ENTRY_STATES.concat("loading"),
    roles: ["owner", "manager"],
  },

  // --- jobs-2 (Task 14): Job detail (11), Stage detail (12), Stage done (13)
  {
    id: "job-detail",
    group: "jobs-2",
    route: "/jobs/:jobId",
    states: ["normal", "empty", "loading", "error", "offline", "foreman", "noperm"],
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "stage-detail",
    group: "jobs-2",
    route: "/jobs/:jobId/stages/:stageId",
    states: ["normal", "loading", "error", "offline", "foreman", "noperm"],
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "stage-done",
    group: "jobs-2",
    route: "/jobs/:jobId/stages/:stageId/done",
    states: ["normal", "loading", "error"],
    roles: ["owner", "manager"],
  },

  // --- crew (Task 15): Crew list (14), Crew member detail (15), Payout (20)
  {
    id: "crew-list",
    group: "crew",
    route: "/crew",
    states: ["normal", "empty", "loading", "error", "offline"],
    roles: ["owner", "manager"],
  },
  {
    id: "crew-detail",
    group: "crew",
    route: "/crew/:crewId",
    states: ["normal", "loading", "error", "offline", "noperm"],
    roles: ["owner", "manager"],
  },
  {
    id: "crew-payout",
    group: "crew",
    route: "/crew/:crewId/payout",
    states: ["normal", "loading", "error", "offline"],
    roles: ["owner", "manager"],
  },

  // --- expenses (Task 16): list (16), add/edit (17) --------------------
  {
    id: "expenses-list",
    group: "expenses",
    route: "/expenses",
    states: ["normal", "empty", "loading", "error", "offline"],
    roles: ["owner", "manager"],
  },
  {
    id: "expense-new",
    group: "expenses",
    route: "/expenses/new",
    states: ["normal", "loading", "error", "offline", "foreman"],
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "expense-detail",
    group: "expenses",
    route: "/expenses/:expenseId",
    states: ["normal", "loading", "error", "offline"],
    roles: ["owner", "manager"],
  },

  // --- pay (Task 17): Pay runs list (18), review (19), statement (21) --
  {
    id: "pay-runs-list",
    group: "pay",
    route: "/pay",
    states: ADMIN_STATES,
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "pay-run-review",
    group: "pay",
    route: "/pay/:runId",
    states: ["normal", "loading", "error", "offline"],
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "crew-statement",
    group: "pay",
    route: "/s/:token",
    states: ["normal", "error", "noperm"],
    roles: [], // public, unguessable-link page — no role cookie involved
  },

  // --- reports (Task 18): Reports (22), Record history (25), Export (26)
  {
    id: "reports",
    group: "reports",
    route: "/reports",
    states: READ_STATES,
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "reports-kind",
    group: "reports",
    route: "/reports/:kind",
    states: READ_STATES,
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "record-history",
    group: "reports",
    route: "/history",
    states: READ_STATES,
    roles: ["owner", "manager"],
  },
  { id: "workspace-export", group: "reports", route: "/export", states: ADMIN_STATES, roles: ["owner"] },

  // --- entry-settings (Task 19) -----------------------------------------
  { id: "sign-in", group: "entry-settings", route: "/sign-in", states: ENTRY_STATES, roles: [] },
  { id: "sign-up", group: "entry-settings", route: "/sign-up", states: ENTRY_STATES, roles: [] },
  { id: "onboarding", group: "entry-settings", route: "/onboarding", states: ENTRY_STATES, roles: ["owner"] },
  {
    id: "install-guide",
    group: "entry-settings",
    route: "/install",
    states: ["normal"],
    roles: ["owner", "manager"],
  },
  {
    id: "settings",
    group: "entry-settings",
    route: "/settings",
    states: ADMIN_STATES,
    roles: ["owner", "manager"],
  },
  {
    id: "settings-levels",
    group: "entry-settings",
    route: "/settings/levels",
    states: ADMIN_STATES,
    roles: ["owner", "manager"],
  },
  {
    id: "more-menu",
    group: "entry-settings",
    route: "/more",
    states: ["normal"],
    roles: ["owner", "manager", "accountant"],
  },
];

/**
 * Fixed stand-in ids for dynamic route segments, used until Task 6's fake
 * seed is running and exposes real ones. Named after the flows.md worked
 * example (Smith job — Ryde re-roof, Sheet install, Dima) so a screenshot
 * take with these placeholders still reads sensibly.
 */
export const PLACEHOLDER_IDS: Record<string, string> = {
  jobId: "smith-ryde-reroof",
  stageId: "sheet-install",
  crewId: "dima",
  expenseId: "screws-receipt",
  runId: "current-week",
  token: "demo-statement-token",
  kind: "job-profitability",
};

/** Replaces every `:param` segment in `route` using `ids` (default `PLACEHOLDER_IDS`). */
export function resolveRoute(route: string, ids: Record<string, string> = PLACEHOLDER_IDS): string {
  return route.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (match, name: string) => {
    const value = ids[name];
    if (value === undefined) {
      throw new Error(`resolveRoute: no id supplied for "${match}" in route "${route}"`);
    }
    return value;
  });
}

/**
 * Alternative to the fixed id map: opens `listRoute`, finds the first link
 * whose href matches the route's static prefix (everything before the first
 * `:param`), and returns that href. Returns null if the list page has no
 * such link (route not built yet, or the seed is empty) — the caller
 * (design-capture.ts) treats that the same as a 404: skip with a warning.
 */
export async function resolveFirstListLink(
  page: Page,
  listRoute: string,
  route: string,
): Promise<string | null> {
  const staticPrefix = route.split(":")[0]!.replace(/\/$/, "");
  await page.goto(listRoute, { waitUntil: "networkidle" }).catch(() => null);
  const href = await page
    .locator(`a[href^="${staticPrefix}/"]`)
    .first()
    .getAttribute("href")
    .catch(() => null);
  return href ?? null;
}
