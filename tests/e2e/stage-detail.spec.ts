import { expect, test, type Page } from "@playwright/test";
import { checkBarClearsLogCircle, checkConsole, checkContentClearsPinnedBar, checkOnePrimary, checkPrimaryInBottomThird, collectConsole, expectScreenHealthy, expectStill } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const isPhone = (name: string) => name !== "desktop";
const smith = meta.projects.smith;
const stageIdOf = (name: string) => seed.stages.find((s) => s.projectId === smith && s.name === name)!.id;

const active = `/jobs/${smith}/stages/${meta.stages.smithSheetInstall}`;
const notStarted = `/jobs/${smith}/stages/${stageIdOf("Flashings, gutters & downpipes")}`;
const done = `/jobs/${smith}/stages/${stageIdOf("Site setup & safety")}`;
const paused = `/jobs/${meta.projects.rydeHeritage}/stages/${meta.stages.rydeCoat}`;
const longNames = `/jobs/${meta.fixtures.longNames}/stages/${meta.fixtures.longNamesStage}`;

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const controls = (page: Page) => page.locator("[data-stage-controls]");
const bar = (page: Page) => page.locator('[data-screen="stage-detail"] [data-slot="primary-action"]');

/** One primary, and on a phone it sits in the pinned bar in the bottom third (jobs-2 D1, F1, F7). */
async function expectOnePrimaryInReach(page: Page, phone: boolean) {
  const one = await checkOnePrimary(page);
  expect(one.failures).toEqual([]);
  if (phone) expect((await checkPrimaryInBottomThird(page)).failures).toEqual([]);
}
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const link = (page: Page, name: string) => page.getByRole("link", { name, exact: true });

test.describe("Stage detail (manager)", () => {
  test("an active stage shows its name, status, what can be done now, the money and a timeline", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", active);
    await expect(page.getByRole("heading", { level: 1, name: "Sheet install" })).toBeVisible();
    await expect(page.locator('[data-screen="stage-detail"]')).toHaveAttribute("data-view", "manager");
    await expect(controls(page)).toHaveAttribute("data-status", "active");
    await expect(button(page, "Pause stage")).toBeVisible();
    await expect(link(page, "Mark stage done")).toHaveAttribute("href", `${active}/done`);
    await expect(button(page, "Start stage")).toHaveCount(0);
    await expect(button(page, "Resume stage")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to job" })).toHaveAttribute("href", `/jobs/${smith}`);
    await expect(page.getByRole("heading", { level: 2, name: "Money" })).toBeVisible();
    for (const name of ["Labour", "Materials"]) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Timeline" })).toBeVisible();
    await expect(bar(page).getByRole("button", { name: "Pause stage" })).toHaveAttribute("data-variant", "secondary");
    await expect(bar(page).getByRole("link", { name: "Mark stage done" })).toHaveAttribute("data-variant", "primary");
    await expectOnePrimaryInReach(page, isPhone(testInfo.project.name));
    // The budget warning is said once (on the tape bar), and Materials reads like Labour: a figure and "Budget $X" or no budget.
    await expect(page.getByText(/^(Budget \$[\d,]+\.\d\d|No budget set)$/)).toHaveCount(2);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  for (const [label, path] of [["working", active], ["paused", paused], ["offline", `${active}?demo=offline`]] as const) {
    test(`on a phone on its side the stage's buttons are one compact row at the bottom, clear of the Log circle (${label})`, async ({ page }, testInfo) => {
      test.skip(!isPhone(testInfo.project.name), "phone only");
      for (const size of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
        await page.setViewportSize(size);
        await signInAs(page, "manager", path);
        await expect(bar(page)).toBeVisible();
        const box = (await bar(page).boundingBox())!;
        expect(box.height, "one compact row").toBeLessThanOrEqual(72);
        expect(box.y + box.height, "pinned at the bottom").toBeGreaterThan(size.height - 120);
        expect((await checkBarClearsLogCircle(page)).failures).toEqual([]);
        expect((await checkOnePrimary(page)).failures).toEqual([]);
      }
    });
  }

  test("the forecast labour row shows its working, and each progress entry shows its quantity and unit", async ({ page }) => {
    await signInAs(page, "manager", active);
    await expect(page.getByText("$1,432.50 spent at 30% done, so about $4,775.00 for the whole stage.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Progress" })).toBeVisible();
    expect(await page.getByText(/^\d[\d,]*(\.\d+)? m²$/).count(), "a quantity with its unit on every progress row").toBeGreaterThan(0);
  });

  test("a stage that is not started offers Start and not Pause", async ({ page }) => {
    await signInAs(page, "manager", notStarted);
    await expect(controls(page)).toHaveAttribute("data-status", "not_started");
    await expect(button(page, "Start stage")).toBeVisible();
    await expect(button(page, "Pause stage")).toHaveCount(0);
    await expect(button(page, "Resume stage")).toHaveCount(0);
  });

  test("a stage that is paused says why, offers Resume, and lists the days lost", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", paused);
    await expect(controls(page)).toHaveAttribute("data-status", "paused");
    await expect(controls(page).getByText("Waiting on materials")).toBeVisible();
    await expect(button(page, "Resume stage")).toBeVisible();
    await expect(button(page, "Pause stage")).toHaveCount(0);
    await expect(controls(page).getByText(/Paused \d+ working days/)).toBeVisible();
    await expect(bar(page).getByRole("button", { name: "Resume stage" })).toHaveAttribute("data-variant", "primary");
    await expect(bar(page).getByRole("link", { name: "Mark stage done" })).toHaveAttribute("data-variant", "secondary");
    await expectOnePrimaryInReach(page, isPhone(testInfo.project.name));
    await expect(page.getByRole("heading", { level: 2, name: "Days lost" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a stage that is done has no Pause, and the manager can reopen it", async ({ page }) => {
    await signInAs(page, "manager", done);
    await expect(controls(page)).toHaveAttribute("data-status", "done");
    await expect(button(page, "Pause stage")).toHaveCount(0);
    await expect(button(page, "Reopen stage")).toBeVisible();
    await expect(link(page, "Mark stage done")).toHaveCount(0);
    // Done: no forecast, and the last stretch of the timeline reads Done, not Working.
    await expect(page.getByText("Forecast labour", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Done", { exact: true }).last()).toBeVisible();
  });

  test("a done stage on an installed phone on its side scrolls its last line clear of the bar (F16)", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "manager", done);
    await expect(bar(page)).toBeVisible();
    await page.evaluate(() => document.documentElement.style.setProperty("--sab-sim", "21px"));
    expect((await checkContentClearsPinnedBar(page)).failures).toEqual([]);
  });

  test("a stage not started yet says so on the timeline", async ({ page }) => {
    await signInAs(page, "manager", notStarted);
    await expect(page.getByText("Not started yet. Starts when the first day is logged.")).toBeVisible();
  });

  test("names as long as real ones get never push the page sideways", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", longNames);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welsh slate");
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a stage that is not in this job is not found", async ({ page }) => {
    const res = await page.goto(`/prototype/role?as=manager&next=${encodeURIComponent(`/jobs/${meta.projects.rydeHeritage}/stages/${meta.stages.smithSheetInstall}`)}`);
    expect(res?.status()).toBe(404);
  });
});

test.describe("Pause sheet", () => {
  test("opens with the note above five reasons, in order; a reason pauses at once and closes the sheet", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", active);
    await expect(controls(page)).toHaveAttribute("data-status", "active");
    await button(page, "Pause stage").click();
    const sheet = page.getByRole("dialog", { name: "Pause stage" });
    await expect(sheet).toBeVisible();
    const note = sheet.getByLabel("Add a note first (optional)");
    const reasons = ["Weather", "Waiting on materials", "Waiting on client/builder", "Crew on another job", "Other"];
    // The sheet slides up from the bottom: measure only once it has stopped, or the first box is read mid-slide.
    await expectStill(sheet);
    const noteBox = (await note.boundingBox())!;
    let previous = noteBox.y;
    for (const name of reasons) {
      const box = (await sheet.getByRole("button", { name, exact: true }).boundingBox())!;
      expect(box.y, `${name} sits below the note and the reason before it`).toBeGreaterThan(previous);
      expect(box.height, `${name} is a 48 px target`).toBeGreaterThanOrEqual(47.5);
      previous = box.y;
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await note.fill("Rain from lunch");
    await sheet.getByRole("button", { name: "Weather", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(controls(page)).toHaveAttribute("data-status", "paused");
    await expect(controls(page).getByText("Weather")).toBeVisible();
    await expect(button(page, "Resume stage")).toBeVisible();
    await expect(button(page, "Pause stage")).toHaveCount(0);
    // The timeline agrees with the chip: no open Working stretch, and a Paused: Weather line (F2).
    const timeline = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Timeline" }) });
    await expect(timeline.getByText(/^From /)).toHaveCount(1);
    await expect(timeline.getByText(/^Paused: Weather/)).toBeVisible();
    // The server holds the pause, not just this screen: a fresh load still says Paused, with the reason.
    await page.reload();
    await expect(controls(page)).toHaveAttribute("data-status", "paused");
    await expect(controls(page).getByText("Weather")).toBeVisible();
    await expect(button(page, "Resume stage")).toBeVisible();
  });

  // Phase 2 limit: a field entry sent without signal is shown as waiting on this phone but is not kept for later
  // (src/offline/submit.ts counts it, nothing re-sends it). The test holds what the screen says, and that pausing
  // again with signal reaches the server. Durable waiting entries arrive with the real sync in a later phase.
  test("with no signal the pause is kept on the phone and the stage says Waiting; with signal a pause reaches the server", async ({ page, context }) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", active);
    await expect(controls(page)).toHaveAttribute("data-status", "active");
    await context.setOffline(true);
    await button(page, "Pause stage").click();
    await page.getByRole("dialog", { name: "Pause stage" }).getByRole("button", { name: "Waiting on materials", exact: true }).click();
    await expect(controls(page).getByText("Waiting", { exact: true })).toBeVisible();
    await expect(controls(page).getByText("Saved on this device. It will send when you have signal.")).toBeVisible();
    await expect(controls(page)).toHaveAttribute("data-status", "paused");
    // A phone with no signal sends nothing, so no failed request lands in the console (the console-clean guard).
    expect(checkConsole(consoleLog).failures).toEqual([]);
    await context.setOffline(false);
    await page.reload();
    await expect(controls(page)).toHaveAttribute("data-status", "active");
    await expect(controls(page).getByText("Saved on this device")).toHaveCount(0);
    await button(page, "Pause stage").click();
    await page.getByRole("dialog", { name: "Pause stage" }).getByRole("button", { name: "Waiting on materials", exact: true }).click();
    await expect(controls(page)).toHaveAttribute("data-status", "paused");
    await expect(controls(page).getByText("Saved on this device")).toHaveCount(0);
    await page.reload();
    await expect(controls(page)).toHaveAttribute("data-status", "paused");
    await expect(controls(page).getByText("Waiting on materials")).toBeVisible();
  });
});

test.describe("Stage detail (foreman)", () => {
  test("a foreman's copy of the page has no money anywhere in the HTML, but can still pause", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", active);
    await expect(page.locator('[data-screen="stage-detail"]')).toHaveAttribute("data-view", "foreman");
    await expect(page.getByRole("heading", { level: 1, name: "Sheet install" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Money" })).toHaveCount(0);
    await expect(button(page, "Pause stage")).toBeVisible();
    // The same hierarchy as the manager's: Pause is secondary, and at most one primary, in thumb reach (D19).
    await expect(bar(page).getByRole("button", { name: "Pause stage" })).toHaveAttribute("data-variant", "secondary");
    expect((await checkOnePrimary(page)).failures).toEqual([]);
    expect((await checkBarClearsLogCircle(page)).failures).toEqual([]);
    await expectNoMoney(page, [active, notStarted, done]);
    await signInAs(page, "foreman", active);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a foreman's progress entries show the quantity and unit, with no dollar sign", async ({ page }) => {
    await signInAs(page, "foreman", active);
    await expect(page.getByRole("heading", { level: 2, name: "Progress" })).toBeVisible();
    expect(await page.getByText(/^\d[\d,]*(\.\d+)? m²$/).count()).toBeGreaterThan(0);
    await expect(page.getByText("$")).toHaveCount(0);
  });

  test("a stage on a job the foreman is not on says they cannot open it", async ({ page }) => {
    const harris = `/jobs/${meta.projects.harris}/stages/${meta.stages.harrisTile}`;
    await signInAs(page, "foreman", harris);
    await expect(page.locator('[data-screen="stage-detail"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "No access" })).toBeVisible();
    await expect(page.getByText(/Harris|Tile install/)).toHaveCount(0);
  });
});

test.describe("Stage detail states", () => {
  test("loading shows blocks shaped like the page, not a spinner", async ({ page }) => {
    await signInAs(page, "manager", `${active}?demo=loading`);
    await expect(page.locator('[data-screen="stage-detail"][aria-busy="true"]')).toBeVisible();
    // Shaped like the page: Money and Timeline rows, and the pinned bar where the buttons will be (D4/F6).
    expect(await page.locator('[aria-busy="true"] .min-h-16').count()).toBe(5);
    await expect(page.locator('[aria-busy="true"] .pin-action')).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to job" })).toBeVisible();
  });

  test("an error keeps the Back row and offers Try again as the one primary button", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `${active}?demo=error`);
    await expect(page.getByRole("link", { name: "Back to job" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline still shows the stage", async ({ page }) => {
    await signInAs(page, "manager", `${active}?demo=offline`);
    await expect(page.getByRole("heading", { level: 1, name: "Sheet install" })).toBeVisible();
    // Mark stage done needs a connection: disabled here, with the reason in the bar (F4). Pause still works.
    await expect(link(page, "Mark stage done")).toHaveAttribute("aria-disabled", "true");
    await expect(bar(page).getByText(/^Needs connection/)).toBeVisible();
    await expect(button(page, "Pause stage")).toBeEnabled();
  });

  test("no permission shows the no-access page, not the stage", async ({ page }) => {
    await signInAs(page, "manager", `${active}?demo=noperm`);
    await expect(page.locator('[data-screen="stage-detail"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
