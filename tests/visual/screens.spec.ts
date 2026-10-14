/**
 * Visual baselines (Task 22): one full-page shot per screen in tests/e2e/screens.ts, for every state it designs, at
 * the project's viewport (visual-iphone 390, visual-android 412, visual-desktop 1440). Light for all; dark too for the
 * core field screens and Home (their normal and foreman states).
 *
 *   pnpm test:visual                                 compare against the committed baselines
 *   pnpm exec playwright test --project='visual-*' --update-snapshots   (re)write them; the conductor does this
 *   pnpm exec playwright test --project=visual-iphone -g "home-manager"   a few screens
 *
 * What makes a shot repeatable: reduced motion and animations off; the document hydrated and the web fonts loaded
 * before the shot; the browser clock fixed at the fake clock's "now" (Mon 28 Sep 2026, 7 a.m. Sydney) so nothing
 * relative ("3 days ago") moves. Nothing is masked: the app shows no live clock.
 *
 * One role per screen (the first in its `roles`), and the foreman variant under the foreman cookie. The extra
 * installed-mode, landscape, tablet and keyboard captures stay with the design loop (scripts/design-capture.ts).
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { waitForHydrated } from "../e2e/guards";
import { resolveRoute, SCREENS, type DemoState, type ScreenSpec } from "../e2e/screens";

type Viewport = "iphone" | "android" | "desktop";
type Scheme = "light" | "dark";

/** The fake clock's "now" (src/data/fake/clock.ts): Mon 28 Sep 2026, 7 a.m. in Sydney. */
const FAKE_NOW = new Date("2026-09-27T21:00:00Z");

/** Screens shot in dark as well: the core field screens and Home. */
const DARK_SCREENS = new Set([
  "home-manager",
  "home-foreman",
  "log-crew-day",
  "log-progress",
  "log-no-work",
  "stage-detail",
  "job-detail",
]);
/** The states those screens are shot in under dark. */
const DARK_STATES: DemoState[] = ["normal", "foreman"];

/** The viewports a screen is shot at, from its own flags (the same rules as the design loop). */
function viewportsOf(screen: ScreenSpec): Viewport[] {
  const all: Viewport[] = screen.viewports ?? ["iphone", "android", "desktop"];
  return all.filter(
    (v) => !(screen.phoneOnly && v === "desktop") && !(screen.desktopOnly && v !== "desktop"),
  );
}

/** Presses the screen's `steps` in order, as the design loop does, and waits for the settled outcome. */
async function runSteps(
  page: Page,
  context: BrowserContext,
  screen: ScreenSpec,
  state: DemoState,
): Promise<void> {
  if (screen.goOffline) await context.setOffline(true);
  for (const step of screen.steps ?? []) {
    const fill = /^fill:(.+?)=(.*)$/.exec(step);
    if (fill) {
      const box = page.getByLabel(fill[1]!, { exact: true });
      await box.fill(fill[2]!);
      await box.blur();
      await page.waitForTimeout(450);
      continue;
    }
    if (step === "reload") {
      await page.reload();
      await settle(page);
      continue;
    }
    // "wait:Logged: Jake" holds the next step until that text is on the page, so a save has landed (a fixed pause is
    // shorter than the sync push now and then, and the next page would be drawn before the write exists).
    if (step.startsWith("wait:")) {
      await page.getByText(step.slice(5)).first().waitFor({ timeout: 15_000 });
      continue;
    }
    if (step.startsWith("row:")) {
      await page
        .getByRole("button", { name: step.slice(4) })
        .first()
        .click();
      await page.waitForTimeout(600);
      continue;
    }
    const radio = step.startsWith("radio:");
    await page
      .getByRole(radio ? "radio" : "button", { name: radio ? step.slice(6) : step, exact: true })
      .click();
    await page.waitForTimeout(radio ? 1200 : 300);
  }
  if (screen.expectStill) await page.getByText(screen.expectStill).first().waitFor({ timeout: 15_000 });
  const named = screen.stateText?.[state];
  if (named) await page.getByText(named).first().waitFor({ timeout: 15_000 });
}

/** React has attached to every field, and the web fonts are in: nothing is still arriving. */
async function settle(page: Page): Promise<void> {
  await waitForHydrated(page);
  await page.evaluate(() => document.fonts.ready);
}

/** The viewport a project shoots: visual-iphone, visual-android, visual-desktop. */
function viewportOf(projectName: string): Viewport {
  const viewport = projectName.replace(/^visual-/, "");
  if (viewport !== "iphone" && viewport !== "android" && viewport !== "desktop") {
    throw new Error(`visual: project ${projectName} is not a viewport project`);
  }
  return viewport;
}

/** The state/scheme pairs a screen is shot in. Names are `<screen>-<state>-<scheme>.png` inside the project's folder. */
function shotsOf(screen: ScreenSpec): { state: DemoState; scheme: Scheme }[] {
  return screen.states.flatMap((state) => [
    { state, scheme: "light" as const },
    ...(DARK_SCREENS.has(screen.id) && DARK_STATES.includes(state)
      ? [{ state, scheme: "dark" as const }]
      : []),
  ]);
}

const names = SCREENS.flatMap((screen) =>
  shotsOf(screen).map(({ state, scheme }) => `${screen.id}-${state}-${scheme}`),
);
const duplicate = names.find((n, i) => names.indexOf(n) !== i);
if (duplicate) throw new Error(`visual: two shots would write ${duplicate}.png`);

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });

    for (const screen of SCREENS) {
      for (const shot of shotsOf(screen).filter((s) => s.scheme === scheme)) {
        test(`${screen.id} · ${shot.state}`, async ({ page, context, baseURL }, testInfo) => {
          const viewport = viewportOf(testInfo.project.name);
          test.skip(!viewportsOf(screen).includes(viewport), "this screen is not shot at this viewport");

          // state "foreman" is the screen's normal state under the foreman cookie, never ?demo=foreman.
          const role = shot.state === "foreman" ? "foreman" : screen.roles[0];
          if (role) await context.addCookies([{ name: "roofy_role", value: role, url: baseURL! }]);
          await page.clock.setFixedTime(FAKE_NOW);

          const url = new URL(resolveRoute(screen.route), baseURL);
          if (shot.state !== "normal" && shot.state !== "foreman") url.searchParams.set("demo", shot.state);
          const response = await page.goto(url.toString(), { waitUntil: "networkidle" });
          expect(response, url.toString()).not.toBeNull();
          await settle(page);
          await runSteps(page, context, screen, shot.state);

          // A full-page shot is taken until two in a row match, so a long page needs longer than the 5 s default (review
          // G2a: the design gallery timed out on android). 1.5 s per screen-height of page, never under 5 s.
          const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
          const shotTimeout = Math.max(5_000, Math.ceil(pageHeight / page.viewportSize()!.height) * 1_500);
          testInfo.setTimeout(testInfo.timeout + shotTimeout);
          await expect(page).toHaveScreenshot(`${screen.id}-${shot.state}-${scheme}.png`, {
            timeout: shotTimeout,
            fullPage: true,
            // CSS pixels: the phones render at 2.6 to 3 device pixels per CSS pixel, which would make each baseline
            // 7 to 9 times larger for no extra regression signal.
            scale: "css",
          });
        });
      }
    }
  });
}
