import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, e2eServerEnv } from "./tests/e2e-db/env";
import { selection } from "./tests/e2e-db/select";

const noWebkit = process.env.ROOFY_NO_WEBKIT === "1";

// Opt-in escape hatch for a container whose cached Chromium build doesn't match
// the revision this Playwright version expects (and downloading a new one isn't
// possible): point at the browser binary that is actually installed.
const chromiumExecutable = process.env.ROOFY_CHROMIUM_EXECUTABLE;
// Chromium takes the date field's order (dd/mm/yyyy) from the process language (LANGUAGE), not from the
// context locale or --lang, so every Chromium launch gets an Australian one.
const chromiumLaunchOptions = {
  ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
  env: { ...process.env, LANGUAGE: "en_AU", LC_ALL: "en_AU.UTF-8", LANG: "en_AU.UTF-8" } as Record<string, string>,
};

// Containers without WebKit installed (no download available) opt in to running
// the "iphone" project on Chromium instead, keeping the iPhone 14 device shape:
// viewport, isMobile, hasTouch, deviceScaleFactor and user agent.
const iphone = noWebkit
  ? {
      ...devices["Desktop Chrome"],
      userAgent: devices["iPhone 14"].userAgent,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: devices["iPhone 14"].deviceScaleFactor,
      isMobile: devices["iPhone 14"].isMobile,
      hasTouch: devices["iPhone 14"].hasTouch,
      launchOptions: chromiumLaunchOptions,
    }
  : { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } };

const android = {
  ...devices["Pixel 7"],
  viewport: { width: 412, height: 915 },
  launchOptions: chromiumLaunchOptions,
};

const desktop = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
  launchOptions: chromiumLaunchOptions,
};

// Visual baselines (tests/visual): the same three viewports, light by default, motion off (the app also honours
// prefers-reduced-motion). The shots are fonts-loaded, hydrated and on the fake clock; see tests/visual/screens.spec.ts.
const visual = { reducedMotion: "reduce" as const, colorScheme: "light" as const };

// Db-mode projects (tests/e2e-db) and their server on 3101 exist only when a run names a db-* project, so a fake run
// never starts that server or needs Postgres. The flag is exported for the workers, which do not see the CLI flags.
const run = selection(process.argv);
if (run.db) process.env.ROOFY_DB_PROJECTS = "1";

// The same three devices, against the db server (ROOFY_DATA=db on 3101, roofy_e2e). One test is one whole journey
// (sign up, verify, onboard), so the time limit is longer and a file's tests run in order.
const db = { testDir: "tests/e2e-db", timeout: 90_000, fullyParallel: false };
const dbProjects = run.db
  ? [
      { name: "db-iphone", ...db, use: { ...iphone, baseURL: E2E_BASE_URL } },
      { name: "db-android", ...db, use: { ...android, baseURL: E2E_BASE_URL } },
      { name: "db-desktop", ...db, use: { ...desktop, baseURL: E2E_BASE_URL } },
    ]
  : [];

const fakeServer = {
  command: "pnpm build && pnpm start",
  url: "http://127.0.0.1:3100",
  // Off by default so a stale server is never reused silently; opt in explicitly.
  reuseExistingServer: process.env.ROOFY_REUSE_SERVER === "1",
  timeout: 240_000,
  env: { ROOFY_DATA: "fake" },
};

// Never builds: the one build comes first (the fake server above, or by hand), and ROOFY_DATA is read at runtime.
// `pnpm db:reset-e2e` creates, drops and migrates roofy_e2e; `pnpm e2e-db:server` is `next start -p 3101`.
const dbServer = {
  command: "pnpm db:reset-e2e && pnpm e2e-db:server",
  url: `${E2E_BASE_URL}/sign-in`,
  reuseExistingServer: process.env.ROOFY_REUSE_SERVER === "1",
  timeout: 240_000,
  env: run.db ? e2eServerEnv() : {},
};

export default defineConfig({
  // The iphone, android and desktop projects run tests/e2e only; the visual-* projects below set their own testDir.
  testDir: "tests/e2e",
  expect: {
    // Animations off (and the caret hidden) for every toHaveScreenshot; a baseline must not catch a frame mid-motion.
    toHaveScreenshot: { animations: "disabled", caret: "hide" },
  },
  // One folder per viewport project, so 1,000+ baselines are not in one directory.
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{-platform}{ext}",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    // What an Australian phone shows: dd/mm/yyyy dates, Sydney clock.
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
  },
  projects: [
    { name: "iphone", use: iphone },
    { name: "android", use: android },
    { name: "desktop", use: desktop },
    // Visual baselines, one project per viewport: `pnpm test:visual` (all of them) or --project=visual-iphone.
    { name: "visual-iphone", testDir: "tests/visual", testIgnore: "pwa.spec.ts", use: { ...iphone, ...visual } },
    { name: "visual-android", testDir: "tests/visual", testIgnore: "pwa.spec.ts", use: { ...android, ...visual } },
    { name: "visual-desktop", testDir: "tests/visual", testIgnore: "pwa.spec.ts", use: { ...desktop, ...visual } },
    // Installability (Chromium's DevTools protocol) and the installed-app checks; no screenshots. The second project
    // runs the same file on the iPhone engine (WebKit) for everything that does not need the protocol.
    { name: "visual-pwa", testDir: "tests/visual", testMatch: "pwa.spec.ts", use: { ...android, ...visual } },
    { name: "visual-pwa-iphone", testDir: "tests/visual", testMatch: "pwa.spec.ts", use: { ...iphone, ...visual } },
    ...dbProjects,
  ],
  // A fake-only run keeps exactly the one 3100 server it always had.
  webServer: run.db ? [...(run.fake ? [fakeServer] : []), dbServer] : fakeServer,
});
