import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";

const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

/** The outbox badge beside the title: same row as the h1. */
async function expectBadgeBesideTitle(page: Page, name: string | RegExp) {
  const badge = page.getByRole("link", { name });
  await expect(badge).toBeVisible();
  const [t, b] = await Promise.all([
    page.getByRole("heading", { level: 1, name: "Home" }).boundingBox(),
    badge.boundingBox(),
  ]);
  expect(Math.abs(t!.y + t!.height / 2 - (b!.y + b!.height / 2))).toBeLessThan(24);
  expect(b!.x).toBeGreaterThan(t!.x + t!.width);
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
    // Active jobs: a card with a tape bar, labour, forecast margin and the last log.
    await expect(page.getByRole("heading", { level: 2, name: "Active jobs" })).toBeVisible();
    const smith = page.getByRole("link", { name: /Smith job/ }).last();
    await expect(smith.getByRole("progressbar")).toBeVisible();
    await expect(smith.getByText("Forecast margin")).toBeVisible();
    await expect(smith.getByText("3 days ago")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Last week" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "This pay period" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review pay run" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a job card names the stage its flag is about and marks the forecast on the bar", async ({ page }) => {
    await signInAs(page, "manager");
    const smith = page.getByRole("link", { name: /Smith job/ }).last();
    await expect(smith).toContainText("Whole job");
    await expect(smith).toContainText("Sheet install is trending $775.00 over its labour budget.");
    await expect(smith.getByTestId("tape-marker")).toBeVisible();
    // Amounts are figures, right-aligned; labels are meta.
    const labour = smith.locator("dd").first();
    await expect(labour).toHaveClass(/text-figure/);
    await expect(labour).toHaveCSS("text-align", "right");
    // A job with no flag has no marker.
    const harris = page.getByRole("link", { name: /Harris job/ }).last();
    await expect(harris.getByTestId("tape-marker")).toHaveCount(0);
  });

  test("Last week and This pay period rows tap through", async ({ page }) => {
    await signInAs(page, "manager");
    const main = page.getByRole("main");
    for (const name of [/^Expenses/, /^Employees/, /^Contractors/, /^Balances still owed/, /^Draft total/]) {
      await expect(main.getByRole("link", { name })).toBeVisible();
    }
    await expect(main.getByRole("link", { name: /^Balances still owed/ })).toHaveAttribute("href", "/crew");
    await expect(main.getByRole("link", { name: /^Expenses/ })).toHaveAttribute("href", "/expenses");
  });

  test("Installed is one row per unit", async ({ page }) => {
    await signInAs(page, "manager");
    await expect(page.getByText("Installed (m²)")).toBeVisible();
    await expect(page.getByText("Installed (lm)")).toBeVisible();
  });

  // Fixme until the job detail page exists (Task 14): today /jobs/<id> is a 404.
  test.fixme("an active job opens its detail page", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("link", { name: /Smith job/ }).last().click();
    await expect(page).toHaveURL(/\/jobs\//);
  });

  test("?demo=loading shows the real title and headings with blocks where the figures go", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=loading");
    await expect(page.locator('[data-screen="home"][aria-busy="true"]')).toBeVisible();
    for (const h of ["Needs attention", "Active jobs", "Last week", "This pay period"]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=error keeps Home on screen with its message and Try again, and no link back to Home", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Couldn't load Home figures" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home" })).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Try again" });
    await expect(retry).toBeVisible();
    if (isPhone(testInfo.project.name)) {
      // In the lower half of the screen, in thumb reach.
      const box = (await retry.boundingBox())!;
      expect(box.y).toBeGreaterThan(page.viewportSize()!.height / 2);
    } else {
      // The sidebar still names the workspace.
      await expect(page.getByText("Harbour Roofing").first()).toBeVisible();
    }
  });

  test("?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.getByText(/\$\d/)).toHaveCount(0);
  });

  test("?demo=empty: one centred message and an Add a job button, no zero figures", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=empty");
    await expect(page.getByText("No jobs yet. Add your first job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a job" })).toBeVisible();
    await expect(page.locator('[data-screen="home"] p.text-figure-xl')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Last week" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "This pay period" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=offline says when the figures are from", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=offline");
    await expect(page.getByRole("status")).toContainText("No signal");
    await expect(page.getByRole("status")).toContainText("saved on this device");
    await expect(page.getByText(/^Figures from Mon 28 Sep, 6:20 am\./)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Active jobs" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=attention: a failed entry shows as a danger badge beside the title and as a Needs attention row", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/?demo=attention");
    await expectBadgeBesideTitle(page, "1 needs attention");
    const item = page.getByRole("link", { name: "1 entry on this device needs attention." });
    await expect(item).toBeVisible();
    // Only seven are listed; the rest are counted, not linked.
    await expect(page.getByText(/^\d+ more things? to check$/)).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await item.click();
    await expect(page).toHaveURL(/\/outbox/);
  });

  test("?demo=waiting: the badge reads N to send beside the title", async ({ page }) => {
    await signInAs(page, "manager", "/?demo=waiting");
    await expectBadgeBesideTitle(page, "3 to send");
  });

  test("Needs attention holds at most 7 items, each a tap-through", async ({ page }) => {
    await signInAs(page, "manager");
    const items = page
      .locator('[data-screen="home"] section', { has: page.getByRole("heading", { level: 2, name: "Needs attention" }) })
      .getByRole("link");
    expect(await items.count()).toBeLessThanOrEqual(7);
    expect(await items.count()).toBeGreaterThan(0);
  });

  test("the column is centred and no wider than 720 px on a tablet-sized window", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone project only");
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "manager");
    const box = (await page.locator('[data-screen="home"]').boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(721);
    expect(Math.abs(box.x - (844 - (box.x + box.width)))).toBeLessThan(2);
  });

  test("an accountant sees the same Home, worded for reading a pay run", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.getByRole("heading", { level: 2, name: "Active jobs" })).toBeVisible();
    await expect(page.getByText(/things? to check in this pay run\./)).toBeVisible();
    await expect(page.getByText(/before you approve/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open pay run" })).toBeVisible();
  });
});

/** Raw HTML (including the RSC payload) of a page for the signed-in role. */
async function rawHtml(page: Page, path: string): Promise<string> {
  const res = await page.request.get(path);
  return res.text();
}

// A dollar figure in what a person reads: whole ($775, $1,200) or with cents.
const MONEY_TEXT = /\$\s?\d/;
// The RSC payload has references like "$1" and "$undefined", so raw HTML is scanned for formatted amounts ($775.00).
const MONEY_AMOUNT = /\$\d[\d,]*\.\d{2}\b/;
// Any quoted key with a money word in it. Strict on purpose: a harmless future key such as "totalJobs" fails too, and can be renamed.
const MONEY_KEY = /"[^"]*(?:rate|amount|cents|budget|margin|balance|cost|earn|pay|total|gst)[^"]*"\s*:/i;

test.describe("Home (foreman)", () => {
  test("shows today's log status, Log today, the outbox status and the assigned jobs, with no dollars", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.getByText("Mon 28 Sep")).toBeVisible();
    await expect(page.locator('[data-screen="home"] p.text-figure-xl')).toHaveText("Not logged yet today");
    await expect(page.getByRole("link", { name: "Log today" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "On this device" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Everything on this device has been sent." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Your jobs" })).toBeVisible();
    const smith = page.getByRole("link", { name: /Smith job/ }).last();
    await expect(smith.getByRole("progressbar")).toBeVisible();
    await expect(smith).toContainText("Sheet install");
    await expect(smith).toContainText(/Last logged|Logged today/);
    expect(await page.locator("body").innerText()).not.toMatch(MONEY_TEXT);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Log today is pinned above the tab bar on a phone and never hides the last job", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the bar is fixed on a phone only");
    await signInAs(page, "foreman");
    const bar = page.locator('[data-slot="primary-action"]');
    const tabs = page.getByRole("navigation", { name: "Primary" });
    await expect(bar.getByRole("link", { name: "Log today" })).toBeInViewport();
    const [b, t] = await Promise.all([bar.boundingBox(), tabs.boundingBox()]);
    expect(b!.y + b!.height).toBeLessThanOrEqual(t!.y + 2);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = (await page.getByRole("link", { name: /progress|Sheet|Flashings|Tile/ }).last().boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(b!.y + 2);
  });

  test("Log today opens Log", async ({ page }) => {
    await signInAs(page, "foreman");
    await page.getByRole("link", { name: "Log today" }).click();
    await expect(page).toHaveURL(/\/log/);
    await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
  });

  test("the foreman's nav is Home first, active on /", async ({ page }) => {
    await signInAs(page, "foreman");
    await expect(page.getByRole("navigation", { name: "Primary" }).locator('[aria-current="page"]')).toHaveText("Home");
  });

  test("?demo=empty: one centred message, no Log today, no zero figures", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=empty");
    await expect(page.getByText("No jobs yet. Ask your manager to add you to a job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log today" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=loading shows the real title, date, headings and Log today", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=loading");
    await expect(page.locator('[data-screen="home"][aria-busy="true"]')).toBeVisible();
    await expect(page.getByText("Mon 28 Sep")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Your jobs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log today" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=error keeps Home and Log today on screen, with Try again and no Go to Home", async ({ page }) => {
    await signInAs(page, "foreman", "/?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Couldn't load your jobs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log today" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home" })).toHaveCount(0);
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

  test("?demo=waiting: N to send beside the title, the same words in the status row", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=waiting");
    await expectBadgeBesideTitle(page, "3 to send");
    const status = page.getByRole("link", { name: "3 entries are waiting to send." });
    await expect(status).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await status.click();
    await expect(page).toHaveURL(/\/outbox/);
  });

  test("?demo=attention: N needs attention beside the title and in the status row", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/?demo=attention");
    await expectBadgeBesideTitle(page, "1 needs attention");
    await expect(page.getByRole("link", { name: "1 entry needs attention." })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("no state carries a dollar figure or a money key, in the page or its data", async ({ page }) => {
    await signInAs(page, "foreman");
    for (const state of ["", "empty", "loading", "error", "offline", "waiting", "attention", "noperm"]) {
      const path = state ? `/?demo=${state}` : "/";
      const html = await rawHtml(page, path);
      expect(html, `?demo=${state}`).not.toMatch(MONEY_AMOUNT);
      expect(html.match(MONEY_KEY)?.[0] ?? null, `?demo=${state} money key`).toBeNull();
      // What a person reads: no whole-dollar amounts either.
      await page.goto(path);
      expect(await page.locator("body").innerText(), `?demo=${state} visible text`).not.toMatch(MONEY_TEXT);
    }
  });
});
