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

  test("an active job opens its detail page", async ({ page }) => {
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

  test("a foreman opening Home lands on Log", async ({ page }) => {
    await signInAs(page, "foreman");
    await expect(page).toHaveURL(/\/log$/);
  });
});
