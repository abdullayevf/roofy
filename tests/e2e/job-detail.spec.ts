import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const smith = `/jobs/${meta.projects.smith}`;

async function signInAs(page: Page, role: string, next = smith) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const stageRows = (page: Page) => page.locator("[data-stage-row]");

test.describe("Job detail (manager)", () => {
  test("names as long as real ones get wrap, even at 200% text size, and never push the page sideways", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `/jobs/${meta.fixtures.longNames}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Featherstonehaugh");
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("shows the job, its status, a row per stage that opens the stage, and the money", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: /Smith/ })).toBeVisible();
    await expect(page.locator('[data-screen="job-detail"]')).toHaveAttribute("data-view", "manager");
    expect(await stageRows(page).count()).toBeGreaterThan(1);
    await expect(stageRows(page).filter({ hasText: "Sheet install" })).toHaveAttribute("href", `${smith}/stages/${meta.stages.smithSheetInstall}`);
    await expect(page.getByRole("heading", { level: 2, name: "Money" })).toBeVisible();
    for (const name of ["Labour", "Materials", "Forecast margin"]) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    // The trending stage says so on its row.
    await expect(stageRows(page).filter({ hasText: "Sheet install" }).getByText(/over budget/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit job" })).toHaveAttribute("href", `${smith}/edit`);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the Back row is a 48 px target and the page never scrolls sideways", async ({ page }) => {
    await signInAs(page, "manager");
    const back = page.getByRole("link", { name: "Back to jobs" });
    await expect(back).toHaveAttribute("href", "/jobs");
    const box = await back.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(47.5);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });

  // The lists these open (Record history, Expenses) are built in Tasks 16 and 18, which must honour `job=`; until then
  // they are placeholders that ignore it, so this test holds the address the lists will be given, not the lists.
  test("every row with a figure links to the lines behind it, filtered to this job", async ({ page }) => {
    await signInAs(page, "manager");
    const hrefs = await page.locator('[data-screen="job-detail"] a[href^="/history"], [data-screen="job-detail"] a[href^="/expenses"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(2);
    for (const h of hrefs) expect(h, "a job-filtered list or one expense").toMatch(new RegExp(`^/(history\\?job=${meta.projects.smith}|expenses\\?job=${meta.projects.smith}|expenses/[\\w-]+)$`));
    expect(hrefs).toContain(`/history?job=${meta.projects.smith}`);
    expect(hrefs).toContain(`/expenses?job=${meta.projects.smith}`);
    for (const name of ["Labour", "Materials", "Forecast margin"]) {
      await expect(page.locator('[data-screen="job-detail"] a[href^="/history"], [data-screen="job-detail"] a[href^="/expenses"]').filter({ hasText: name }).first(), `${name} opens its lines`).toBeVisible();
    }
  });
});

test.describe("Job detail (foreman)", () => {
  test("a foreman's copy of the page has no money anywhere in the HTML", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await expect(page.locator('[data-screen="job-detail"]')).toHaveAttribute("data-view", "foreman");
    await expect(page.getByRole("heading", { level: 2, name: "Money" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit job" })).toHaveCount(0);
    expect(await stageRows(page).count()).toBeGreaterThan(1);
    await expectNoMoney(page, [smith]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a job the foreman is not on says they cannot open it", async ({ page }) => {
    await signInAs(page, "foreman", `/jobs/${meta.projects.harris}`);
    await expect(page.locator('[data-screen="job-detail"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Harris/)).toHaveCount(0);
  });
});

test.describe("Job detail states", () => {
  test("loading shows blocks shaped like the page, not a spinner", async ({ page }) => {
    await signInAs(page, "manager", `${smith}?demo=loading`);
    await expect(page.locator('[data-screen="job-detail"][aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to jobs" })).toBeVisible();
  });

  test("an error keeps the Back row and offers Try again as the one primary button", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `${smith}?demo=error`);
    await expect(page.getByRole("link", { name: "Back to jobs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline still shows the job", async ({ page }) => {
    await signInAs(page, "manager", `${smith}?demo=offline`);
    await expect(page.getByRole("heading", { level: 1, name: /Smith/ })).toBeVisible();
    await expect(stageRows(page).first()).toBeVisible();
  });

  test("no permission shows the no-access page, not the job", async ({ page }) => {
    await signInAs(page, "manager", `${smith}?demo=noperm`);
    await expect(page.locator('[data-screen="job-detail"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
