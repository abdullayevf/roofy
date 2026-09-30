import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";

const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("Home (manager)", () => {
  test("shows the Monday screen: key figure, needs attention, active jobs, last week, pay period", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    // Key figure under the title.
    await expect(page.getByText(/^Labour last week/)).toBeVisible();
    await expect(page.locator('[data-screen="home"] p.text-figure-xl')).toHaveText(/^\$[\d,]+\.\d{2}$/);
    // Needs attention: the Smith job is trending over on sheet install.
    await expect(page.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Smith job.*trending \$775\.00 over on sheet install/ })).toBeVisible();
    // Active jobs: a row with a tape bar, labour, forecast margin and days since last log.
    await expect(page.getByRole("heading", { level: 2, name: "Active jobs" })).toBeVisible();
    const smith = page.getByRole("link", { name: /Smith job/ }).last();
    await expect(smith.getByRole("progressbar")).toBeVisible();
    await expect(smith.getByText("Forecast margin")).toBeVisible();
    await expect(smith.getByText("Last logged 3 days ago")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Last week" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "This pay period" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review pay run" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  // Fixme until the job detail page exists (Task 14): today /jobs/<id> is a 404.
  test.fixme("an active job opens its detail page", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("link", { name: /Smith job/ }).last().click();
    await expect(page).toHaveURL(/\/jobs\//);
  });

  test("?demo=loading shows the skeleton", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=loading");
    await expect(page.locator('[data-screen="home"][aria-busy="true"]')).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=error reaches the error screen with Try again", async ({ page }) => {
    await signInAs(page, "manager", "/?demo=error");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.getByText(/\$\d/)).toHaveCount(0);
  });

  test("?demo=empty: no jobs, nothing to attend to, and a way to add a job", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=empty");
    await expect(page.getByText("Nothing needs your attention today.")).toBeVisible();
    await expect(page.getByText("No jobs yet. Add your first job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a job" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "This pay period" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=offline shows the banner over the same Home", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=offline");
    await expect(page.getByRole("status")).toContainText("No signal");
    await expect(page.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Active jobs" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=attention adds the outbox item to Needs attention, and it opens the outbox", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=attention");
    const item = page.getByRole("link", { name: "1 entry on this phone needs attention." });
    await expect(item).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await item.click();
    await expect(page).toHaveURL(/\/outbox/);
  });

  test("Needs attention holds at most 7 items, each a tap-through", async ({ page }) => {
    await signInAs(page, "manager");
    const items = page
      .locator('[data-screen="home"] section', { has: page.getByRole("heading", { level: 2, name: "Needs attention" }) })
      .getByRole("link");
    expect(await items.count()).toBeLessThanOrEqual(7);
    expect(await items.count()).toBeGreaterThan(0);
  });

  test("an accountant sees the same Home", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.getByRole("heading", { level: 2, name: "Active jobs" })).toBeVisible();
  });
});

/** Raw HTML (including the RSC payload) of a page for the signed-in role. */
async function rawHtml(page: Page, path: string): Promise<string> {
  const res = await page.request.get(path);
  return res.text();
}

const MONEY_TEXT = /\$\s?\d/;
// The RSC payload has references like "$1" and "$undefined", so raw HTML is scanned for formatted amounts ($775.00).
const MONEY_AMOUNT = /\$\d[\d,]*\.\d{2}\b/;
const MONEY_KEY = /"[^"]*(?:rate|amount|cents|budget|margin|balance|cost|earn|pay|total|gst)[^"]*"\s*:/i;

test.describe("Home (foreman)", () => {
  test("shows Log today, the outbox status and the assigned jobs, with no dollars", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.getByText("Mon 28 Sep")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log today" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "On this phone" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Everything on this phone has been sent." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Your jobs" })).toBeVisible();
    const smith = page.getByRole("link", { name: /Smith job/ }).last();
    await expect(smith.getByRole("progressbar")).toBeVisible();
    await expect(smith).toContainText("Sheet install");
    await expect(smith).toContainText(/Last logged|Logged today/);
    expect(await page.locator("body").innerText()).not.toMatch(MONEY_TEXT);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Log today opens Log", async ({ page }) => {
    await signInAs(page, "foreman");
    await page.getByRole("link", { name: "Log today" }).click();
    await expect(page).toHaveURL(/\/log/);
    await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
  });

  test("the foreman's nav starts with Home, active on /", async ({ page }) => {
    await signInAs(page, "foreman");
    await expect(page.getByRole("navigation", { name: "Primary" }).locator('[aria-current="page"]')).toHaveText("Home");
  });

  test("?demo=empty: no jobs, a plain instruction, no Log today", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=empty");
    await expect(page.getByText("No jobs yet. Ask your manager to add you to a job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log today" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=loading shows the skeleton", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=loading");
    await expect(page.locator('[data-screen="home"][aria-busy="true"]')).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=error reaches the error screen with Try again", async ({ page }) => {
    await signInAs(page, "foreman", "/?demo=error");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("?demo=noperm shows no access with a way back", async ({ page }) => {
    await signInAs(page, "foreman", "/?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Log" })).toBeVisible();
  });

  test("?demo=offline shows the banner and Log today still works", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=offline");
    await expect(page.getByRole("status")).toContainText("No signal");
    await expect(page.getByRole("link", { name: "Log today" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=waiting counts entries waiting to send and opens the outbox", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=waiting");
    const status = page.getByRole("link", { name: "3 entries are waiting to send." });
    await expect(status).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await status.click();
    await expect(page).toHaveURL(/\/outbox/);
  });

  test("?demo=attention flags the entry that needs attention", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=attention");
    await expect(page.getByRole("link", { name: "1 entry needs attention." })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("no state carries a dollar figure or a money key, in the page or its data", async ({ page }) => {
    await signInAs(page, "foreman");
    for (const state of ["", "empty", "loading", "error", "offline", "waiting", "attention", "noperm"]) {
      const html = await rawHtml(page, state ? `/?demo=${state}` : "/");
      expect(html, `?demo=${state}`).not.toMatch(MONEY_AMOUNT);
      expect(html.match(MONEY_KEY)?.[0] ?? null, `?demo=${state} money key`).toBeNull();
    }
  });
});
