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
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;

/** A new job opened filled in: Smith's next job, Metal re-roof, its stages (from the last metal re-roof job) accepted. */
const smithClientId = seed.projects.find((p) => p.id === meta.projects.smith)!.clientId;
/** A Smith job stage by name: one that is done, one active (`meta.stages.smithSheetInstall`), one not started. */
const smithStage = (name: string) => seed.stages.find((st) => st.projectId === meta.projects.smith && st.name === name)!.id;
const STAGE_DONE = smithStage("Site setup & safety");
const STAGE_NOT_STARTED = smithStage("Flashings, gutters & downpipes");
/** Screen 13 on Harris ridge (E5.1: $2,000.00 lump sum, Sam/Tom/Dima). */
const PAY_RUN_STATUS = new Map(seed.payRuns.map((r) => [r.id, r.status]));
// An older, exported run: Export CSV again, no Reopen (a later run is approved).
const PAY_RUN_EXPORTED = seed.payRuns.find((r) => r.status === "exported")!.id;
/** Expense edit states (Task 16): one already paid back in an approved pay run, one with no receipt. */
const EXPENSE_APPROVED = seed.expenses.find((e) => e.reimbursedInPayRunId && PAY_RUN_STATUS.get(e.reimbursedInPayRunId) !== "draft")!.id;
const EXPENSE_NO_RECEIPT = seed.expenses.find(
  (e) => e.receiptFileId === null && e.paidBy === "company_card" && e.projectId === meta.projects.smith,
)!.id;
/** Public statement links (screen 21) from the seed: Dima, a contractor, and Sam, an employee. */
const statementToken = (crewId: string) => meta.statementTokens.find((x) => x.crewMemberId === crewId)!.token;
export const STATEMENT_CONTRACTOR = statementToken(meta.crew.dima);
export const STATEMENT_EMPLOYEE = statementToken(meta.crew.sam);
const STAGE_DONE_ROUTE = `/jobs/${meta.projects.harris}/stages/${meta.stages.harrisRidge}/done`;
/** The address of a stage page. */
const stageRoute = (jobId: string, stageId: string) => `/jobs/${jobId}/stages/${stageId}`;

export const JOB_PREFILL = `/jobs/new?${new URLSearchParams({
  client: smithClientId,
  type: "metal_reroof",
  name: "Smith job — Ryde carport roof",
  address: "14 Quarry Rd, Ryde",
  contract: "3850000",
  accepted: "1",
}).toString()}`;

/**
 * `?demo=` states, per `src/data/fake/demo.ts` (Task 6), PLUS the literal
 * "foreman" token used here as shorthand: a screen listing "foreman" in its
 * `states` gets an extra capture of its *normal* state under the
 * `roofy_role=foreman` cookie (never `?demo=foreman`, which isn't a real demo
 * state), showing the same route with the foreman-shaped DTO. See
 * "States every screen designs" in docs/design/flows.md.
 */
export type DemoState =
  | "normal"
  | "empty"
  | "loading"
  | "error"
  | "offline"
  | "waiting"
  | "attention"
  | "mixed" // an outbox with one entry in each group
  | "blocked" // Owner 2FA reads as off: the pay run's Approve is blocked
  | "noperm"
  | "foreman";

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
  /** Labels of buttons pressed in order once the page has loaded, before the shot (a save, then "Log another stage"); "radio:No work" presses a switch option; "fill:Sam's share=60" types into a field. */
  steps?: string[];
  /** Text that must be on the page once `steps` have run, before the shot: the settled outcome, not the spinner on the way to it. */
  expectStill?: string;
  /** Cut the network after the page has loaded and before `steps`, so a save is kept on the phone. */
  goOffline?: boolean;
};

// Admin-only screens never queue offline — they show "Needs connection"
// instead — and have a no-permission state for roles that can't reach them,
// but no outbox states and no foreman variant (foreman can't reach them).
const ADMIN_STATES: DemoState[] = ["normal", "empty", "loading", "error", "offline", "noperm"];

// Plain reads (reports, history) — no writes, so no waiting/attention.
const READ_STATES: DemoState[] = ["normal", "empty", "loading", "error", "offline"];

// Short forms/wizards with little to design beyond the happy path and errors.
const ENTRY_STATES: DemoState[] = ["normal", "error"];

// Sign in and sign up have no data to wait for: the form, the busy button, no signal, and the sorry sentence.
const AUTH_STATES: DemoState[] = ["normal", "loading", "offline", "error"];

// An email long enough to push a field past its edge if the field does not wrap or scroll.
const LONG_NAME = "Scaffolding hire, safety rails and edge protection for the Harbour View Apartments re-roof";
const LONG_EMAIL = "maria.fernanda.van-der-westhuizen-smith@harbour-and-bay-roofing-contractors.example";

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

  // --- field-2 (Task 12): Log crew-day (6), Progress (7), No-work (8), Outbox (24).
  // Trimmed to states and roles that look different: an owner sees what a manager sees, error is one shared
  // screen (captured once, on the crew-day grid), and "waiting" differs from "attention" only by a badge that
  // Home already shows.
  {
    id: "log-crew-day",
    group: "field-2",
    route: "/log",
    states: ["normal", "empty", "loading", "error", "offline", "attention", "foreman"],
    roles: ["manager"],
  },
  {
    // A foreman with no jobs: "You can log once a manager adds you to a job." and no button.
    id: "log-crew-day-foreman",
    group: "field-2",
    route: "/log",
    states: ["empty"],
    roles: ["foreman"],
  },
  {
    id: "log-progress",
    group: "field-2",
    route: "/log/progress",
    states: ["normal", "empty", "loading", "foreman"],
    roles: ["manager"],
    // The quantity field with the decimal keypad up; the pinned Save progress must stay in view.
    keyboard: { field: "Quantity done", action: "Save progress" },
  },
  {
    id: "log-no-work",
    group: "field-2",
    route: "/log/no-work",
    states: ["normal", "empty", "loading", "foreman"],
    roles: ["manager"],
  },
  {
    id: "outbox",
    group: "field-2",
    route: "/outbox",
    states: ["normal", "loading", "attention", "mixed"],
    roles: ["manager"],
  },
  {
    id: "outbox-foreman",
    group: "field-2",
    route: "/outbox",
    states: ["attention"],
    roles: ["foreman"],
  },

  // The filled flows, opened with the route's own prefill (the address an outbox "Edit and resend" builds) and,
  // where the shot is of an outcome, the buttons a person presses. Light, phone and desktop only.
  {
    // Smith job, Sheet install, Sam and Dima ticked, Sam on a half day.
    id: "log-crew-day-filled",
    group: "field-2",
    route: `/log?same=1&ex=${meta.crew.sam}:50`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // The ticked chips have folded into "Logged" under the date.
    id: "log-crew-day-saved",
    group: "field-2",
    route: "/log?same=1",
    states: ["normal"],
    roles: ["manager"],
    steps: ["Save day"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // After a save, the same people are on the grid again marked "Already logged today".
    id: "log-crew-day-logged-today",
    group: "field-2",
    route: "/log?same=1",
    states: ["normal"],
    roles: ["manager"],
    steps: ["Save day", "Log another stage"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // No signal: the save is kept on the phone ("Saved on this device") and the badge says "1 to send".
    id: "log-crew-day-offline-saved",
    group: "field-2",
    route: "/log?same=1",
    states: ["offline"],
    roles: ["manager"],
    goOffline: true,
    steps: ["Save day"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // 120 m² between Sam and Dima: 60 m² each, and the stage's tape at 30%.
    id: "log-progress-split",
    group: "field-2",
    route: `/log/progress?stage=${meta.stages.smithSheetInstall}&qty=12000&crew=${meta.crew.sam},${meta.crew.dima}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // A custom split that adds up to 92%: the message under the shares, Save progress off.
    id: "log-progress-split-error",
    group: "field-2",
    route: `/log/progress?stage=${meta.stages.smithSheetInstall}&qty=12000&crew=${meta.crew.sam},${meta.crew.dima}&shares=6000,3200`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Saved: the tape has moved to 60%.
    id: "log-progress-saved",
    group: "field-2",
    route: `/log/progress?stage=${meta.stages.smithSheetInstall}&qty=12000&crew=${meta.crew.sam},${meta.crew.dima}`,
    states: ["normal"],
    roles: ["manager"],
    steps: ["Save progress"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Jake ticked for rain, with the reason chosen: the date on its rule, Save no work ready.
    id: "log-no-work-filled",
    group: "field-2",
    route: `/log/no-work?crew=${meta.crew.jake}&reason=rain`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Jake already has a log today (saved on the grid, then Log > No work): his row is off with the reason.
    id: "log-no-work-blocked",
    group: "field-2",
    route: `/log?project=${meta.projects.smith}&stage=${meta.stages.smithSheetInstall}&crew=${meta.crew.jake}`,
    states: ["normal"],
    roles: ["manager"],
    steps: ["Save day", "radio:No work"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    id: "log-no-work-saved",
    group: "field-2",
    route: `/log/no-work?crew=${meta.crew.jake}&reason=rain`,
    states: ["normal"],
    roles: ["manager"],
    steps: ["Save no work"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },

  // --- jobs-1 (Task 13): Jobs list (9), New/edit job (10) --------------
  // Trimmed like field-2: manager (an owner sees the same) and foreman only; offline is the shell's banner on the list,
  // so only the form (a disabled Create job saying why) captures it.
  {
    id: "jobs-list",
    group: "jobs-1",
    route: "/jobs",
    states: ["normal", "empty", "loading", "error", "foreman"],
    roles: ["manager"],
  },
  {
    // Every status at once: the Quoted, On hold and Complete jobs carry their status under the address.
    id: "jobs-list-all",
    group: "jobs-1",
    route: "/jobs?status=all",
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // A foreman with no jobs: one sentence and a way to Log, no Add job.
    id: "jobs-list-foreman-empty",
    group: "jobs-1",
    route: "/jobs",
    states: ["empty"],
    roles: ["foreman"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    id: "job-new",
    group: "jobs-1",
    route: "/jobs/new",
    states: ["normal", "loading", "error", "offline"],
    roles: ["manager"],
    // The site address with the keyboard up; the pinned Create job must stay in view.
    keyboard: { field: "Site address", action: "Create job" },
  },
  {
    // A new workspace: no clients to pick, only Quick-add client.
    id: "job-new-no-clients",
    group: "jobs-1",
    route: "/jobs/new",
    states: ["empty"],
    roles: ["manager"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Smith, Metal re-roof, named and addressed, the stages from the last metal re-roof job accepted: Create job ready.
    id: "job-new-filled",
    group: "jobs-1",
    route: JOB_PREFILL,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // The stage editor: one compact row per stage, Sheet install open (name, budgets, Remove), Add stage below.
    id: "job-new-editing-stages",
    group: "jobs-1",
    route: JOB_PREFILL,
    states: ["normal"],
    roles: ["manager"],
    steps: ["Edit stages", "Sheet install $4,000.00"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Quick-add client: the sheet with Client name and Save client.
    id: "job-new-quick-add",
    group: "jobs-1",
    route: "/jobs/new",
    states: ["normal"],
    roles: ["manager"],
    steps: ["Quick-add client"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // A target finish before the start: the message under the field, Create job off, the sentence naming the fix.
    id: "job-new-invalid",
    group: "jobs-1",
    route: `${JOB_PREFILL}&start=2026-10-05&finish=2026-10-01`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Saved: title "Job added", Log today on this job (primary), Add another job, Back to jobs above the title.
    id: "job-new-saved",
    group: "jobs-1",
    route: JOB_PREFILL,
    states: ["normal"],
    roles: ["manager"],
    steps: ["Create job"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    id: "job-edit",
    group: "jobs-1",
    route: `/jobs/${meta.projects.smith}/edit`,
    states: ["normal", "loading"],
    roles: ["manager"],
  },

  // --- jobs-2 (Task 14): Job detail (11), Stage detail (12), Stage done (13)
  {
    id: "job-detail",
    group: "jobs-2",
    route: "/jobs/:jobId",
    states: ["normal", "loading", "error", "offline", "foreman", "noperm"],
    roles: ["owner", "manager", "foreman"],
  },
  {
    // A quoted job with no stages yet: "No stages yet" and a way to add them.
    id: "job-detail-empty",
    group: "jobs-2",
    route: `/jobs/${meta.fixtures.noStages}`,
    states: ["normal"],
    roles: ["manager"],
  },
  {
    // Client, job, address and stage names as long as real ones get: nothing may overflow.
    id: "job-detail-long-names",
    group: "jobs-2",
    route: `/jobs/${meta.fixtures.longNames}`,
    states: ["normal"],
    roles: ["manager"],
  },
  {
    id: "stage-detail",
    group: "jobs-2",
    route: "/jobs/:jobId/stages/:stageId",
    states: ["normal", "loading", "error", "offline", "foreman", "noperm"],
    roles: ["owner", "manager", "foreman"],
  },
  {
    id: "stage-detail-not-started",
    group: "jobs-2",
    route: stageRoute(meta.projects.smith, STAGE_NOT_STARTED),
    states: ["normal", "foreman"],
    roles: ["manager"],
  },
  {
    // Paused waiting on materials for over five working days: the "paused too long" note.
    id: "stage-detail-paused",
    group: "jobs-2",
    route: stageRoute(meta.projects.rydeHeritage, meta.stages.rydeCoat),
    states: ["normal"],
    roles: ["manager"],
  },
  {
    id: "stage-detail-done",
    group: "jobs-2",
    route: stageRoute(meta.projects.smith, STAGE_DONE),
    states: ["normal", "foreman"],
    roles: ["manager"],
  },
  {
    id: "stage-detail-long-names",
    group: "jobs-2",
    route: stageRoute(meta.fixtures.longNames, meta.fixtures.longNamesStage),
    states: ["normal"],
    roles: ["manager"],
  },
  {
    // Forecast labour breakdown (flows "Find the job losing money", tap 2): Sam's and Dima's per-unit lines, $1,432.50 so far,
    // ÷ 30% done = $4,775.00 against the $4,000.00 budget and $4,200.00 warning point. Money only: the foreman gets No permission.
    id: "stage-forecast",
    group: "jobs-2",
    route: `${stageRoute(meta.projects.smith, meta.stages.smithSheetInstall)}/forecast`,
    states: ["normal", "loading", "error", "offline", "foreman", "noperm"],
    roles: ["owner", "manager", "accountant", "foreman"],
  },
  {
    // A done stage: the forecast is what it cost, no warning point.
    id: "stage-forecast-done",
    group: "jobs-2",
    route: `${stageRoute(meta.projects.smith, STAGE_DONE)}/forecast`,
    states: ["normal"],
    roles: ["manager"],
  },
  {
    // Ryde coat, paused at 0% with labour logged: no forecast yet (under 10% done).
    id: "stage-forecast-under-10",
    group: "jobs-2",
    route: `${stageRoute(meta.projects.rydeHeritage, meta.stages.rydeCoat)}/forecast`,
    states: ["normal"],
    roles: ["accountant"],
  },
  {
    id: "stage-forecast-long-names",
    group: "jobs-2",
    route: `${stageRoute(meta.fixtures.longNames, meta.fixtures.longNamesStage)}/forecast`,
    states: ["normal"],
    roles: ["manager"],
  },
  {
    // The pause sheet open: a note field, then five reasons.
    id: "stage-detail-pause-sheet",
    group: "jobs-2",
    route: stageRoute(meta.projects.smith, meta.stages.smithSheetInstall),
    states: ["normal"],
    roles: ["manager"],
    steps: ["Pause stage"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Paused at once on tapping Weather: the sheet closes and the chip says Paused, Weather.
    id: "stage-detail-paused-weather",
    group: "jobs-2",
    route: stageRoute(meta.projects.smith, meta.stages.smithSheetInstall),
    states: ["normal"],
    roles: ["manager"],
    steps: ["Pause stage", "Weather"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // No signal: the pause is kept on the phone and the chip says Waiting.
    id: "stage-detail-offline-waiting",
    group: "jobs-2",
    route: stageRoute(meta.projects.smith, meta.stages.smithSheetInstall),
    states: ["offline"],
    roles: ["manager"],
    goOffline: true,
    steps: ["Pause stage", "Waiting on materials"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Screen 13: Harris ridge, $2,000.00 lump sum logged by Sam, Tom and Dima (E5.1). Foreman gets No permission.
    id: "stage-done",
    group: "jobs-2",
    route: STAGE_DONE_ROUTE,
    states: ["normal", "loading", "error", "offline", "foreman"],
    roles: ["manager"],
  },
  {
    id: "stage-done-not-100",
    group: "jobs-2",
    route: STAGE_DONE_ROUTE,
    states: ["normal"],
    roles: ["manager"],
    steps: ["fill:Sam's share=30"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    id: "stage-done-edited",
    group: "jobs-2",
    route: STAGE_DONE_ROUTE,
    states: ["normal"],
    roles: ["manager"],
    steps: ["fill:Sam's share=40", "fill:Tom's share=40", "fill:Dima's share=20"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // After Confirm done: the stage page, now Done.
    id: "stage-done-saved",
    group: "jobs-2",
    route: STAGE_DONE_ROUTE,
    states: ["normal"],
    roles: ["manager"],
    steps: ["Confirm done"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },

  // --- crew (Task 15): Crew list (14), Crew member detail (15), Payout (20)
  {
    id: "crew-list",
    group: "crew",
    route: "/crew",
    states: ["normal", "empty", "loading", "error", "offline", "foreman"],
    roles: ["owner", "manager"],
  },
  {
    // Active and inactive together: Pete has left, and a contractor with a very long name has left too (nothing may overflow).
    id: "crew-list-all",
    group: "crew",
    route: "/crew?show=all",
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Dima is paid ahead (an advance is more than he is owed): the in-credit state.
    id: "crew-detail",
    group: "crew",
    route: `/crew/${meta.crew.dima}`,
    states: ["normal", "loading", "error", "offline", "noperm"],
    roles: ["owner", "manager"],
  },
  {
    // Kev is owed, and has been for longer than a pay period.
    id: "crew-detail-owed",
    group: "crew",
    route: `/crew/${meta.crew.kev}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // A very long name, and nothing logged, paid or shared yet: every section is empty.
    id: "crew-detail-long",
    group: "crew",
    route: `/crew/${meta.fixtures.longNamesCrew}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    id: "crew-payout",
    group: "crew",
    route: "/crew/:crewId/payout",
    states: ["normal", "loading", "error", "offline", "noperm"],
    roles: ["owner", "manager"],
    // Amount with the keyboard open and Save payout still reachable (the Note box sits below it in the same form).
    keyboard: { field: "Amount", action: "Save payout" },
  },
  {
    // Filled in: $1,482.00, Payment, bank transfer, a note (flows.md "Record a payout").
    id: "crew-payout-filled",
    group: "crew",
    route: `/crew/${meta.crew.dima}/payout?amount=1482.00&kind=payment&method=bank_transfer&note=Pay%20run%20to%2027%20Sep`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Save payout tapped with $0.00 and neither Advance nor Payment: each field says what is missing.
    id: "crew-payout-refused",
    group: "crew",
    route: `/crew/${meta.crew.dima}/payout?amount=0&check=1`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Back on the crew member's page after a real save (flows.md E15.1: last week's pay run approved, then $1,482.00
    // paid to Dima today, in this browser's demo session): nothing owed, the payment on top, the "Payment saved." toast.
    id: "crew-payout-saved",
    group: "crew",
    route: `/prototype/role?as=manager&next=${encodeURIComponent(
      `/prototype/record-payout?crew=${meta.crew.dima}&cents=148200&kind=payment&approve=1&next=${encodeURIComponent(`/crew/${meta.crew.dima}?saved=payment`)}`,
    )}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },

  // --- expenses (Task 16): list (16), add/edit (17) --------------------
  {
    id: "expenses-list",
    group: "expenses",
    route: "/expenses",
    states: ["normal", "empty", "loading", "error", "offline", "foreman"],
    roles: ["owner", "manager"],
  },
  {
    // Narrowed to one job (the link from Job detail): the filter chip shows and takes the filter off.
    id: "expenses-list-job",
    group: "expenses",
    route: `/expenses?job=${meta.projects.smith}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // A job with no expenses: the list says so in one sentence and the chip stays so the filter can be cleared.
    id: "expenses-list-job-empty",
    group: "expenses",
    route: `/expenses?job=${meta.fixtures.noStages}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // A supplier and a job name that are very long: nothing may overflow or push the total off the row.
    id: "expenses-list-long-names",
    group: "expenses",
    route: `/expenses?job=${meta.fixtures.longNames}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    id: "expense-new",
    group: "expenses",
    route: "/expenses/new",
    states: ["normal", "loading", "error", "offline", "foreman"],
    roles: ["owner", "manager", "foreman"],
    // The total with the keyboard open: Save expense (with the cost beside it) stays above the keys.
    keyboard: { field: "Total paid", action: "Save expense" },
  },
  {
    // Filled in, paid by Dima: the payback note shows under Who paid (flows.md, Add a receipt).
    id: "expense-new-filled",
    group: "expenses",
    route: `/expenses/new?job=${meta.projects.smith}&supplier=Bunnings&total=110.00&paid=crew&crew=${meta.crew.dima}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // No GST chosen: the GST amount box goes and one line says the whole total is the cost.
    id: "expense-new-no-gst",
    group: "expenses",
    route: `/expenses/new?supplier=Post%20office&total=12.40&gst=none`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Save expense tapped with nothing filled in: each missing field says so and the bar names what is left.
    id: "expense-new-check",
    group: "expenses",
    route: `/expenses/new?check=1`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Saved with no signal: the expense waits on this device (Waiting) until it can send.
    id: "expense-new-waiting",
    group: "expenses",
    route: `/expenses/new?job=${meta.projects.smith}&supplier=Bunnings&total=110.00&saved=waiting`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Reached from a job's Add expense: the job is already chosen and its picker stays folded.
    id: "expense-new-from-job",
    group: "expenses",
    route: `/expenses/new?job=${meta.projects.smith}`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // One expense: figures, receipt, Edit and Record history (flows.md "Expense edit").
    id: "expense-detail",
    group: "expenses",
    route: "/expenses/:expenseId",
    states: ["normal", "loading", "error"],
    roles: ["owner", "manager"],
  },
  {
    // Back after Save changes: one line says the changes are kept.
    id: "expense-detail-saved",
    group: "expenses",
    route: "/expenses/:expenseId?saved=1",
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Edit (17): the Add expense form filled in, receipt kept; offline = Save changes off with "Needs connection".
    id: "expense-edit",
    group: "expenses",
    route: "/expenses/:expenseId?edit=1",
    states: ["normal", "loading", "error", "offline"],
    roles: ["owner", "manager"],
    keyboard: { field: "Total paid", action: "Save changes" },
  },
  {
    id: "expense-edit-no-receipt",
    group: "expenses",
    route: `/expenses/${EXPENSE_NO_RECEIPT}?edit=1`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Already paid back in an approved pay run: the warning shows above the form.
    id: "expense-edit-approved",
    group: "expenses",
    route: `/expenses/${EXPENSE_APPROVED}?edit=1`,
    states: ["normal"],
    roles: ["manager"],
    viewports: ["iphone", "desktop"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Edit is Owner/Manager only: a foreman gets the no-access page, with no amounts in it.
    id: "expense-edit-noperm",
    group: "expenses",
    route: "/expenses/:expenseId?edit=1",
    states: ["normal"],
    roles: ["foreman"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },

  // --- pay (Task 17): Pay runs list (18), review (19), statement (21) --
  {
    // The draft to review first (flags, blocking count, Review pay run), then past runs with Draft/Approved/Exported.
    // The accountant variant reads "Open pay run". Offline the list and the review stay open to read (Approve, Reopen and
    // Export on the review say "Needs connection"). The latest 8 other runs show, then "Show older pay runs".
    id: "pay-runs-list",
    group: "pay",
    route: "/pay",
    states: ADMIN_STATES,
    roles: ["owner", "manager", "accountant"],
  },
  {
    // A foreman never reaches pay runs: the no-permission page, with no figure in its HTML.
    id: "pay-runs-list-foreman",
    group: "pay",
    route: "/pay",
    states: ["normal"],
    roles: ["foreman"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Flags first (missing rate blocks, warnings tap through to their line), then each person: lines with late-entry and
    // adjustment labels, contractor subtotal, GST and total, reimbursements; then the run totals. The seed's draft has a
    // missing rate, so normal shows that block with "Approve without the rate"; `blocked` adds Owner 2FA off (Go to
    // settings); offline disables Approve with "Needs connection"; the accountant reads with no Approve.
    id: "pay-run-review",
    group: "pay",
    route: `/pay/${meta.payRuns.review}`,
    states: ["normal", "loading", "error", "offline", "blocked"],
    roles: ["owner", "manager", "accountant"],
  },
  {
    // The confirmation sheet open (approving locks the period), opened by `?confirm=` so it can be captured.
    id: "pay-run-review-confirm",
    group: "pay",
    route: `/pay/${meta.payRuns.review}?confirm=waive`,
    states: ["normal"],
    roles: ["manager"],
  },
  {
    // An approved run: Export CSV and Reopen (Owner/Manager); an accountant gets Export CSV only. Offline disables both.
    id: "pay-run-review-approved",
    group: "pay",
    route: `/pay/${meta.payRuns.lastApproved}`,
    states: ["normal", "offline"],
    roles: ["owner", "accountant"],
  },
  {
    // An exported run: "Exported to CSV", Export CSV again, Share statement per person; no Reopen once a later run is approved.
    id: "pay-run-review-exported",
    group: "pay",
    route: `/pay/${PAY_RUN_EXPORTED}`,
    states: ["normal"],
    roles: ["owner"],
  },
  {
    // A foreman never reaches a pay run: the no-permission page, with no figure in its HTML.
    id: "pay-run-review-foreman",
    group: "pay",
    route: `/pay/${meta.payRuns.review}`,
    states: ["normal"],
    roles: ["foreman"],
    viewports: ["iphone"],
    lightOnly: true,
    noExtras: true,
  },
  {
    // Screen 21, public (no role cookie, no app nav): Dima's statement for the last approved run — business and ABN,
    // contractor ABN, period, lines, totals with GST, payouts, balance after and the §16 contractor footer. Share hands
    // on the page's own link. Print width is checked by `crew-statement.spec.ts` (print media at A4 width).
    id: "crew-statement",
    group: "pay",
    route: "/s/:token",
    states: ["normal", "loading", "error"],
    roles: [], // public, unguessable-link page — no role cookie involved
  },
  {
    // An employee's statement (Sam): "Pay" not "Subtotal", no GST, no contractor footer.
    id: "crew-statement-employee",
    group: "pay",
    route: `/s/${STATEMENT_EMPLOYEE}`,
    states: ["normal"],
    roles: [],
    noExtras: true,
  },
  {
    // An expired, turned-off or unknown link: one plain sentence, nothing about the person or the business.
    id: "crew-statement-gone",
    group: "pay",
    route: `/s/${"0".repeat(64)}`,
    states: ["normal"],
    roles: [],
    viewports: ["iphone", "desktop"],
    noExtras: true,
  },

  // --- reports (Task 18): Reports (22), Record history (25), Export (26)
  {
    id: "reports",
    group: "reports",
    route: "/reports",
    states: READ_STATES,
    roles: ["owner", "manager", "accountant"],
  },
  // Each report kind (Task 18 runs A and B). Default range: the last 3 months. Offline: Export CSV needs a connection,
  // Print stays. Print width is checked by `reports.spec.ts` (print media at A4 width), not by capture.
  ...(["job-profitability", "crew", "productivity", "pauses", "pay-history"] as const).flatMap((kind) => [
    { id: `reports-${kind}`, group: "reports" as const, route: `/reports/${kind}`, states: READ_STATES, roles: ["owner", "manager", "accountant"] as Role[] },
    // A chosen range (last week) and a range with nothing in it.
    { id: `reports-${kind}-filtered`, group: "reports" as const, route: `/reports/${kind}?from=2026-09-21&to=2026-09-27`, states: ["normal" as const], roles: [] },
    { id: `reports-${kind}-empty-range`, group: "reports" as const, route: `/reports/${kind}?from=2020-01-01&to=2020-01-31`, states: ["normal" as const], roles: [] },
    // A Foreman never sees reports: no permission, no figures.
    { id: `reports-${kind}-no-access`, group: "reports" as const, route: `/reports/${kind}`, states: ["normal" as const], roles: ["foreman"] as Role[] },
  ]),
  { id: "reports-no-access", group: "reports", route: "/reports", states: ["normal"], roles: ["foreman"] },
  // Long job names: the Featherstonehaugh-Montgomery job in August holds only a receipt. The index cards carry figures
  // and counts, never names, so the long names show on the kind pages (phone cards wrap, the desktop table wraps).
  { id: "reports-long-names", group: "reports", route: "/reports/job-profitability?from=2026-08-01&to=2026-08-31", states: ["normal"], roles: [] },
  // Record history (Task 18 run C): Owner and Manager. `?job=` and `?crew=` narrow it; an Accountant and a Foreman
  // are told they have no permission.
  {
    id: "record-history",
    group: "reports",
    route: "/history",
    states: [...READ_STATES, "noperm"],
    roles: ["manager"],
  },
  { id: "record-history-job", group: "reports", route: `/history?job=${meta.projects.smith}`, states: ["normal"], roles: [] },
  { id: "record-history-crew", group: "reports", route: `/history?crew=${meta.crew.dima}`, states: ["normal"], roles: [] },
  // A job with long names: the sentence and the job name wrap, nothing is cut.
  { id: "record-history-long-names", group: "reports", route: `/history?job=${meta.fixtures.longNames}`, states: ["normal"], roles: [] },
  { id: "record-history-no-access", group: "reports", route: "/history", states: ["normal"], roles: ["accountant", "foreman"] },
  // Workspace export (Task 18 run D): Owner only. The shot after the button is the saved state; the others are told
  // they have no permission.
  // The Owner is never told they have no permission, so there is no noperm state for them (N6).
  { id: "workspace-export", group: "reports", route: "/export", states: READ_STATES, roles: ["owner"] },
  { id: "workspace-export-done", group: "reports", route: "/export", states: ["normal"], roles: ["owner"], steps: ["Export workspace"], expectStill: "is saved to your downloads" },
  { id: "workspace-export-no-access", group: "reports", route: "/export", states: ["normal"], roles: ["manager", "accountant", "foreman"] },

  // --- entry-settings (Task 19) -----------------------------------------
  // Sign in and sign up: the form, the busy button, no signal, and the plain-words refusals.
  { id: "sign-in", group: "entry-settings", route: "/sign-in", states: AUTH_STATES, roles: [], keyboard: { field: "Password", action: "Sign in" } },
  { id: "sign-in-invalid", group: "entry-settings", route: "/sign-in", states: ["normal"], roles: [], steps: ["Sign in"], expectStill: "Enter your email address." },
  {
    id: "sign-in-wrong-password",
    group: "entry-settings",
    route: "/sign-in",
    states: ["normal"],
    roles: [],
    steps: ["fill:Email=karen@harbourroofing.example", "fill:Password=not-the-password", "Sign in"],
    expectStill: "don't match",
  },
  { id: "sign-in-long-email", group: "entry-settings", route: "/sign-in", states: ["normal"], roles: [], steps: [`fill:Email=${LONG_EMAIL}`, "fill:Password=not-the-password"] },
  { id: "sign-up", group: "entry-settings", route: "/sign-up", states: AUTH_STATES, roles: [], keyboard: { field: "Password", action: "Create account" } },
  { id: "sign-up-invalid", group: "entry-settings", route: "/sign-up", states: ["normal"], roles: [], steps: ["fill:Email=karen@harbourroofing", "fill:Password=short", "Create account"], expectStill: "Use at least 8 characters." },
  {
    id: "sign-up-email-taken",
    group: "entry-settings",
    route: "/sign-up",
    states: ["normal"],
    roles: [],
    steps: ["fill:Email=karen@harbourroofing.example", "fill:Password=a-long-password", "Create account"],
    expectStill: "already exists",
  },
  // Set-up wizard: each step, its refusals, offline (admin steps need connection), the done state and the wrong role.
  // An owner already set up sees the done state (You're set up, then Add your first job, on to the first log).
  { id: "onboarding", group: "entry-settings", route: "/onboarding", states: ENTRY_STATES, roles: ["owner"] },
  { id: "onboarding-business", group: "entry-settings", route: "/onboarding?step=business", states: ["normal", "offline"], roles: ["owner"] },
  { id: "onboarding-trade", group: "entry-settings", route: "/onboarding?step=trade", states: ["normal"], roles: ["owner"] },
  { id: "onboarding-defaults", group: "entry-settings", route: "/onboarding?step=defaults", states: ["normal"], roles: ["owner"] },
  { id: "onboarding-crew", group: "entry-settings", route: "/onboarding?step=crew", states: ["normal", "offline"], roles: ["owner"] },
  { id: "onboarding-install", group: "entry-settings", route: "/onboarding?step=install", states: ["normal"], roles: ["owner"] },
  { id: "onboarding-invalid", group: "entry-settings", route: "/onboarding?step=business", states: ["normal"], roles: ["owner"], steps: ["fill:Business name=", "fill:ABN=123", "Continue"], expectStill: "ABN should be 11 digits." },
  { id: "onboarding-crew-row-error", group: "entry-settings", route: "/onboarding?step=crew", states: ["normal"], roles: ["owner"], steps: ["Add crew member", "fill:Name=Sam", "Add"], expectStill: "Add a rate before adding." },
  // Resumed: after sign-up and the business step, the wizard reopens on step 2 (the step is saved, so a reload lands here too).
  { id: "onboarding-resumed", group: "entry-settings", route: "/sign-up", states: ["normal"], roles: [], steps: ["Continue with Google", "fill:Business name=Smith Roofing", "fill:ABN=51 824 753 556", "Continue"], expectStill: "Step 2 of 5" },
  // Back keeps what was entered on the step before.
  { id: "onboarding-back-keeps", group: "entry-settings", route: "/sign-up", states: ["normal"], roles: [], steps: ["Continue with Google", "fill:Business name=Smith Roofing", "fill:ABN=51 824 753 556", "Continue", "Back"], expectStill: "Step 1 of 5" },
  { id: "onboarding-no-access", group: "entry-settings", route: "/onboarding", states: ["normal"], roles: ["manager", "foreman"] },
  // Install guide: the steps for the device it is opened on come first; the others sit behind a disclosure.
  { id: "install-guide", group: "entry-settings", route: "/install", states: ["normal", "error"], roles: ["owner", "manager", "foreman", "accountant"] },
  { id: "install-guide-ios", group: "entry-settings", route: "/install?platform=ios", states: ["normal"], roles: ["owner"] },
  { id: "install-guide-android", group: "entry-settings", route: "/install?platform=android", states: ["normal"], roles: ["owner"] },
  { id: "install-guide-desktop", group: "entry-settings", route: "/install?platform=desktop", states: ["normal"], roles: ["owner"] },
  { id: "install-guide-installed", group: "entry-settings", route: "/install?installed=1", states: ["normal"], roles: ["owner"] },
  // Settings (screen 23, run C): Owner and Manager; accountant and foreman refused. Owner-only: two-factor.
  { id: "settings", group: "entry-settings", route: "/settings", states: ["normal", "loading", "error", "offline"], roles: ["owner", "manager"] },
  { id: "settings-no-access", group: "entry-settings", route: "/settings", states: ["normal"], roles: ["accountant", "foreman"] },
  { id: "settings-business", group: "entry-settings", route: "/settings/business", states: ["normal", "loading", "error", "offline"], roles: ["owner", "manager"] },
  { id: "settings-business-invalid", group: "entry-settings", route: "/settings/business", states: ["normal"], roles: ["owner"], steps: ["fill:Business name=", "fill:ABN=123", "Save changes"], expectStill: "ABN should be 11 digits." },
  { id: "settings-business-saved", group: "entry-settings", route: "/settings/business", states: ["normal"], roles: ["owner"], steps: ["Save changes"], expectStill: "Changes saved." },
  { id: "settings-pay-period", group: "entry-settings", route: "/settings/pay-period", states: ["normal", "loading", "offline"], roles: ["owner", "manager"] },
  { id: "settings-pay-period-invalid", group: "entry-settings", route: "/settings/pay-period", states: ["normal"], roles: ["manager"], steps: ["fill:Standard day=", "Save changes"], expectStill: "Add the hours in a standard day." },
  { id: "settings-on-cost", group: "entry-settings", route: "/settings/on-cost", states: ["normal", "loading", "offline"], roles: ["owner", "manager"] },
  { id: "settings-on-cost-invalid", group: "entry-settings", route: "/settings/on-cost", states: ["normal"], roles: ["owner"], steps: ["fill:On-cost=abc", "Save changes"], expectStill: "Enter a percent, like 18.5." },
  { id: "settings-levels", group: "entry-settings", route: "/settings/levels", states: ["normal", "loading", "error", "offline", "empty"], roles: ["owner", "manager"] },
  { id: "settings-levels-invalid", group: "entry-settings", route: "/settings/levels", states: ["normal"], roles: ["owner"], steps: ["fill:Floor rate for Roofer=0.00", "Save changes"], expectStill: "Add a floor rate before saving." },
  { id: "settings-levels-saved", group: "entry-settings", route: "/settings/levels", states: ["normal"], roles: ["manager"], steps: ["fill:Floor rate for Roofer=34.50", "Save changes"], expectStill: "Changes saved." },
  { id: "settings-levels-no-access", group: "entry-settings", route: "/settings/levels", states: ["normal"], roles: ["accountant", "foreman"] },
  // Two-factor: on in the seed; `blocked` reads it as off, so the set-up form shows.
  { id: "settings-two-factor", group: "entry-settings", route: "/settings/two-factor", states: ["normal", "blocked", "loading"], roles: ["owner"] },
  { id: "settings-two-factor-invalid", group: "entry-settings", route: "/settings/two-factor", states: ["blocked"], roles: ["owner"], steps: ["fill:Code=12ab", "Turn on two-factor"], expectStill: "Enter the 6-digit code from your app." },
  { id: "settings-two-factor-no-access", group: "entry-settings", route: "/settings/two-factor", states: ["normal"], roles: ["manager", "accountant"] },
  // Run D: templates, expense categories, members and roles (Owner), foreman assignments, and More.
  { id: "settings-templates", group: "entry-settings", route: "/settings/templates", states: ["normal", "empty", "loading", "error", "offline"], roles: ["owner", "manager"] },
  { id: "settings-templates-edit", group: "entry-settings", route: "/settings/templates?type=metal_reroof", states: ["normal", "offline"], roles: ["owner", "manager"] },
  { id: "settings-templates-invalid", group: "entry-settings", route: "/settings/templates?type=metal_reroof", states: ["normal"], roles: ["owner"], steps: ["fill:Stage 1 labour share=1", "Save changes"], expectStill: "Labour shares must add up to 100%." },
  { id: "settings-templates-blank-name", group: "entry-settings", route: "/settings/templates?type=metal_reroof", states: ["normal"], roles: ["manager"], steps: ["fill:Stage 1 name=", "Save changes"], expectStill: "Add a name for the stage." },
  { id: "settings-templates-saved", group: "entry-settings", route: "/settings/templates?type=metal_reroof", states: ["normal"], roles: ["owner"], steps: ["Save changes"], expectStill: "Changes saved." },
  { id: "settings-templates-no-access", group: "entry-settings", route: "/settings/templates", states: ["normal"], roles: ["accountant", "foreman"] },
  { id: "settings-categories", group: "entry-settings", route: "/settings/categories", states: ["normal", "empty", "loading", "error", "offline"], roles: ["owner", "manager"] },
  { id: "settings-categories-invalid", group: "entry-settings", route: "/settings/categories", states: ["normal"], roles: ["owner"], steps: ["fill:New category=materials", "Save changes"], expectStill: "There's already a category called materials." },
  { id: "settings-categories-saved", group: "entry-settings", route: "/settings/categories", states: ["normal"], roles: ["manager"], steps: ["fill:New category=Skip bins", "Save changes"], expectStill: "Changes saved." },
  { id: "settings-categories-long", group: "entry-settings", route: "/settings/categories", states: ["normal"], roles: ["owner"], steps: [`fill:New category=${LONG_NAME}`, "Save changes"], expectStill: "Changes saved." },
  { id: "settings-categories-no-access", group: "entry-settings", route: "/settings/categories", states: ["normal"], roles: ["accountant", "foreman"] },
  { id: "settings-members", group: "entry-settings", route: "/settings/members", states: ["normal", "empty", "loading", "error", "offline"], roles: ["owner"] },
  { id: "settings-members-invalid", group: "entry-settings", route: "/settings/members", states: ["normal"], roles: ["owner"], steps: ["fill:Email=karen@harbourroofing", "Send invite"], expectStill: "Add the person's name." },
  { id: "settings-members-saved", group: "entry-settings", route: "/settings/members", states: ["normal"], roles: ["owner"], steps: ["fill:Name=Karen Lee", "fill:Email=karen@harbourroofing.example", "Send invite"], expectStill: "Invite sent." },
  { id: "settings-members-long", group: "entry-settings", route: "/settings/members", states: ["normal"], roles: ["owner"], steps: [`fill:Name=${LONG_NAME}`, `fill:Email=${LONG_EMAIL}`, "Send invite"], expectStill: "Invite sent." },
  { id: "settings-members-no-access", group: "entry-settings", route: "/settings/members", states: ["normal"], roles: ["manager", "accountant", "foreman"] },
  { id: "settings-assignments", group: "entry-settings", route: "/settings/assignments", states: ["normal", "empty", "loading", "error", "offline"], roles: ["owner", "manager"] },
  { id: "settings-assignments-saved", group: "entry-settings", route: "/settings/assignments", states: ["normal"], roles: ["owner"], steps: ["Save changes"], expectStill: "Changes saved." },
  { id: "settings-assignments-no-access", group: "entry-settings", route: "/settings/assignments", states: ["normal"], roles: ["accountant", "foreman"] },
  { id: "more-menu", group: "entry-settings", route: "/more", states: ["normal", "offline"], roles: ["owner", "manager", "accountant", "foreman"] },
  { id: "more-menu-no-access", group: "entry-settings", route: "/more", states: ["noperm"], roles: ["owner"] },
];

/**
 * Fixed stand-in ids for dynamic route segments, used until Task 6's fake
 * seed is running and exposes real ones. Named after the flows.md worked
 * example (Smith job — Ryde re-roof, Sheet install, Dima) so a screenshot
 * take with these placeholders still reads sensibly.
 */
export const PLACEHOLDER_IDS: Record<string, string> = {
  jobId: meta.projects.smith,
  stageId: meta.stages.smithSheetInstall,
  crewId: meta.crew.dima,
  expenseId: meta.expenses.smithSheets,
  token: STATEMENT_CONTRACTOR,
  kind: "job-profitability",
};

/**
 * No `runId` here on purpose: a made-up run id 404s (the `/pay/:runId` captures were skipped that way). Pay routes
 * name a seed run directly, `/pay/${meta.payRuns.review}`, and `resolveRoute` throws on a `:runId`.
 */

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
