import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { REPORT_KINDS } from "../../src/components/screens/reports-text";
import { canOpen, type Section } from "../../src/components/shell/access";
import { DEMO_STATES } from "../../src/data/contracts";
import { getSeed } from "../../src/data/fake/store";
import { expectNoMoney } from "./money-scan";
import { SCREENS, resolveRoute } from "./screens";

/**
 * Task 21, the foreman leakage sweep. Signed in with the literal `roofy_role=foreman` cookie, every route the
 * foreman can open, on every `?demo=` state, has no money in its HTML (inlined RSC payload included) or in what a
 * person reads; every money route shows "No access" and no figure. The routes come from SCREENS and the seed, not a
 * hand list: a screen whose first path segment is in no section fails the first test until it is classified here.
 */

const seed = getSeed();
const { meta } = seed;

/** First path segment -> shell section, the one `canOpen` decides on. */
const SECTIONS: Record<string, Section> = {
  "": "home",
  jobs: "jobs",
  log: "log",
  crew: "crew",
  more: "more",
  outbox: "outbox",
  pay: "pay",
  reports: "reports",
  expenses: "expenses",
  settings: "settings",
  history: "history",
  export: "export",
  install: "install",
};

/** Not foreman-shaped pages, each for a reason: they are left out of the sweep. */
const SKIPPED: { match: RegExp; why: string }[] = [
  { match: /^\/design(\/|$)/, why: "the design-system gallery: fixed sample figures, no workspace data" },
  { match: /^\/s\//, why: "a public statement link: a crew member's own pay, opened without signing in" },
  { match: /^\/prototype\//, why: "the prototype role switch: it sets a different role cookie" },
];

/** Signed-out pages: the foreman sees the same form as anyone. */
const ENTRY = ["/sign-in", "/sign-up"];
/** Owner-only, outside the shell sections. */
const REFUSED_OUTSIDE_SECTIONS = ["/onboarding"];
/** Opened by typed URL only, with the foreman-shaped crew list (no balances): review CR2, crew-list.spec.ts. */
const OPEN_IN_REFUSED_SECTIONS = ["/crew"];
/** Money pages inside sections the foreman opens: a job's contract price, and a stage's forecast (budget and cost to date). */
const REFUSED_IN_OPEN_SECTIONS = [/^\/jobs\/new$/, /^\/jobs\/[^/]+\/edit$/, /^\/jobs\/[^/]+\/stages\/[^/]+\/forecast$/];

type Kind = "open" | "refused" | "skip";

const pathnameOf = (path: string) => path.split("?")[0]!;

function kindOf(path: string): Kind {
  const pathname = pathnameOf(path);
  if (SKIPPED.some((s) => s.match.test(pathname))) return "skip";
  if (ENTRY.includes(pathname)) return "open";
  if (REFUSED_OUTSIDE_SECTIONS.includes(pathname)) return "refused";
  if (OPEN_IN_REFUSED_SECTIONS.includes(pathname)) return "open";
  const section = SECTIONS[pathname.split("/")[1] ?? ""];
  if (!section)
    throw new Error(`foreman-leakage: ${path} is in no section; classify it in foreman-leakage.spec.ts`);
  if (!canOpen("foreman", section)) return "refused";
  if (REFUSED_IN_OPEN_SECTIONS.some((r) => r.test(pathname))) return "refused";
  return "open";
}

const withDemo = (path: string, state: string) => `${path}${path.includes("?") ? "&" : "?"}demo=${state}`;
/** Every `?demo=` state, plus the page as it opens. */
const ALL_STATES = ["normal", ...DEMO_STATES];

/**
 * Query keys that prefill a form with what the person types (the receipt total and GST on Add expense). The foreman
 * (Narrowing ruled justified by the spec review, spec §3 l.49; expense-new.spec.ts:133 scans that prefilled form.)
 * adds expenses, so the amount they type is theirs to see; it is dropped from the scanned URL so the scan catches
 * workspace money only. The rest of the query (who paid, saved, check) is kept, so those states are still scanned.
 */
const OWN_INPUT_KEYS = ["total", "gst"];
function withoutOwnInput(path: string): string {
  const [pathname, query] = path.split("?");
  if (!query) return path;
  const params = new URLSearchParams(query);
  for (const key of OWN_INPUT_KEYS) params.delete(key);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname!;
}

const screenRoutes = SCREENS.map((s) => ({ spec: s, path: withoutOwnInput(resolveRoute(s.route)) }));

/**
 * Seed ids beyond the ones SCREENS names: every named job and fixture and every stage on them (forecast and done
 * pages for the named stages), every crew member, the named and one-per-status pay runs, the named expenses.
 */
const jobIds = [...Object.values(meta.projects), meta.fixtures.noStages, meta.fixtures.longNames];
const namedStages = new Set<string>(Object.values(meta.stages));
const stagePaths = seed.stages
  .filter((st) => jobIds.includes(st.projectId))
  .flatMap((st) => {
    const base = `/jobs/${st.projectId}/stages/${st.id}`;
    return namedStages.has(st.id) ? [base, `${base}/forecast`, `${base}/done`] : [base];
  });
const payRunIds = [
  ...new Set([
    ...Object.values(meta.payRuns),
    ...["draft", "approved", "exported"].map((s) => seed.payRuns.find((r) => r.status === s)?.id),
  ]),
].filter((id): id is string => Boolean(id));
const seedPaths = [
  ...jobIds.flatMap((id) => [`/jobs/${id}`, `/jobs/${id}/edit`]),
  ...stagePaths,
  ...Object.values(meta.expenses).flatMap((id) => [`/expenses/${id}`, `/expenses/${id}?edit=1`]),
  ...Object.values(meta.crew).flatMap((id) => [`/crew/${id}`, `/crew/${id}/payout`]),
  ...payRunIds.map((id) => `/pay/${id}`),
];

/**
 * The paths to scan, grouped by pathname (one test each, so they run in parallel): a SCREENS pathname on every demo
 * state; a SCREENS route with a query on the states it lists; a seed id on its normal state.
 */
function sweep(kind: Kind): Map<string, string[]> {
  const groups = new Map<string, Set<string>>();
  const add = (path: string) => {
    const key = pathnameOf(path);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(path);
  };
  for (const { spec, path } of screenRoutes) {
    if (kindOf(path) !== kind) continue;
    const pathname = pathnameOf(path);
    for (const state of ALL_STATES) add(state === "normal" ? pathname : withDemo(pathname, state));
    if (path === pathname) continue;
    for (const state of spec.states) {
      if (state === "normal" || state === "foreman") add(path);
      else add(withDemo(path, state));
    }
  }
  for (const path of seedPaths) if (kindOf(path) === kind) add(path);
  return new Map([...groups].map(([k, v]) => [k, [...v]]));
}

/**
 * Every page in src/app as a pathname pattern: route groups dropped, a dynamic segment matches any one segment.
 * A new page that no SCREENS route or seed path reaches fails the sweep instead of being missed.
 */
function appPagePatterns(): { page: string; pattern: RegExp }[] {
  const root = join(__dirname, "../../src/app");
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
    (f) => f === "page.tsx" || f.endsWith(`${sep}page.tsx`),
  );
  return files.map((f) => {
    const segments = relative(root, join(root, f))
      .split(sep)
      .slice(0, -1)
      .filter((seg) => !/^\(.*\)$/.test(seg))
      .map((seg) => (/^\[.*\]$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    return { page: f, pattern: new RegExp(`^/${segments.join("/")}$`) };
  });
}

const OPEN = sweep("open");
const REFUSED = sweep("refused");

test.beforeEach(async ({ context }, testInfo) => {
  await context.addCookies([{ name: "roofy_role", value: "foreman", url: testInfo.project.use.baseURL! }]);
});

test.describe("Foreman leakage: the route list", () => {
  test("every SCREENS route is classified, and agrees with what SCREENS says the foreman sees", () => {
    for (const { spec, path } of screenRoutes) {
      const kind = kindOf(path); // throws on a route in no section
      // A foreman variant of a screen is a page the foreman opens; a foreman no-access screen is a refused one. A money
      // page listed in REFUSED_IN_OPEN_SECTIONS (the stage forecast) shoots its foreman state as the No access page.
      const refusedHere = REFUSED_IN_OPEN_SECTIONS.some((r) => r.test(pathnameOf(path)));
      if (spec.states.includes("foreman")) expect(kind, `${spec.id} ${path}`).toBe(refusedHere ? "refused" : "open");
      if (spec.roles.includes("foreman") && spec.id.endsWith("no-access"))
        expect(kind, `${spec.id} ${path}`).toBe("refused");
    }
    // The money pages the plan names are all refused.
    for (const path of [
      "/pay",
      `/pay/${meta.payRuns.review}`,
      `/crew/${meta.crew.dima}`,
      "/reports",
      "/reports/crew",
      "/settings/on-cost",
      "/settings/levels",
      "/settings/pay-period",
    ]) {
      expect(kindOf(path), path).toBe("refused");
    }
    expect(OPEN.size).toBeGreaterThan(10);
    // The six-plus money pages the brief names are in the refused sweep itself, not only classified.
    for (const pathname of [
      "/pay",
      "/reports",
      "/settings/on-cost",
      "/settings/levels",
      "/settings/pay-period",
    ])
      expect(REFUSED.has(pathname), pathname).toBe(true);
    // Review F3: the stage forecast (refused in fix 1) is swept as refused, so every demo state must say No access.
    const forecast = `/jobs/${meta.projects.smith}/stages/${meta.stages.smithSheetInstall}/forecast`;
    expect(REFUSED.has(forecast), forecast).toBe(true);
    expect(REFUSED.size).toBeGreaterThan(10);
  });

  test("every page in src/app is reached by the sweep or skipped for a reason", () => {
    const swept = [...OPEN.keys(), ...REFUSED.keys()];
    const skipped = screenRoutes.map(({ path }) => pathnameOf(path)).filter((p) => kindOf(p) === "skip");
    const patterns = appPagePatterns();
    expect(patterns.length).toBeGreaterThan(30);
    for (const { page, pattern } of patterns) {
      const reached = [...swept, ...skipped].some((p) => pattern.test(p));
      expect(reached, `src/app/${page} has no SCREENS route or seed path in the foreman sweep`).toBe(true);
    }
  });
});

test.describe("Foreman leakage: pages the foreman opens have no money", () => {
  for (const [pathname, paths] of OPEN) {
    test(`${pathname} (${paths.length} states)`, async ({ page }) => {
      test.setTimeout(30_000 + paths.length * 5_000);
      await expectNoMoney(page, paths);
    });
  }
});

test.describe("Foreman leakage: money pages say No access and show no figure", () => {
  for (const [pathname, paths] of REFUSED) {
    test(`${pathname} (${paths.length} states)`, async ({ page }) => {
      test.setTimeout(30_000 + paths.length * 5_000);
      for (const path of paths) {
        await expectNoMoney(page, [path]);
        await expect(page.getByRole("heading", { name: "No access" }), path).toBeVisible();
      }
    });
  }

  // The role check runs before any demo branch, so no refused role sees a skeleton or error page first (fix 1).
  test("an accountant's refused pages say No access in every demo state", async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(90_000);
    await context.addCookies([
      { name: "roofy_role", value: "accountant", url: testInfo.project.use.baseURL! },
    ]);
    for (const base of [
      "/log",
      "/log/progress",
      "/log/no-work",
      "/outbox",
      "/crew",
      "/expenses/new",
      "/onboarding",
    ]) {
      for (const state of ["loading", "error", "offline"]) {
        await page.goto(`${base}?demo=${state}`);
        await expect(page.getByRole("heading", { name: "No access" }), `${base}?demo=${state}`).toBeVisible();
      }
    }
  });

  test("every report CSV download is refused with no figure", async ({ page }) => {
    for (const kind of REPORT_KINDS) {
      const res = await page.request.get(`/reports/${kind}/csv`);
      expect(res.status(), kind).toBe(403);
      expect(await res.text(), kind).not.toMatch(/\$\d|cents|amount|rate/i);
    }
  });

  test("the workspace export download is refused with no figure", async ({ page }) => {
    const res = await page.request.get("/export/download");
    expect(res.status()).toBe(403);
    expect(await res.text()).not.toMatch(/\$\d|cents|amount|rate/i);
  });
});
