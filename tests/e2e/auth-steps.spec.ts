import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy, waitForHydrated } from "./guards";

const isPhone = (name: string) => name !== "desktop";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const formAlert = (page: Page) => page.locator("main [role=alert]").filter({ hasText: /\S/ });

async function open(page: Page, url: string) {
  await page.goto(url);
  await waitForHydrated(page);
}

test.describe("Two-factor step", () => {
  test("is healthy, asks for 6 digits, and says wrong code and too many tries in plain words", async ({
    page,
  }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, "/two-factor");
    await expect(page.getByRole("heading", { level: 1, name: "Enter your code" })).toBeVisible();
    await button(page, "Check code").click();
    await expect(page.getByText("Enter the 6-digit code from your authenticator app.")).toBeVisible();
    await page.getByLabel("Code").fill("000000");
    await button(page, "Check code").click();
    await expect(page.getByText("That code doesn't match.")).toBeVisible();
    await page.getByLabel("Code").fill("111111");
    await button(page, "Check code").click();
    await expect(formAlert(page)).toContainText("Too many tries.");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a good code signs in and goes Home; offline blocks the button", async ({ page }) => {
    await open(page, "/two-factor");
    await page.getByLabel("Code").fill("482913");
    await button(page, "Check code").click();
    await expect(page).toHaveURL(/\/$/);
    await open(page, "/two-factor?demo=offline");
    await expect(page.getByText("Needs connection")).toBeVisible();
    await expect(button(page, "Check code")).toBeDisabled();
  });
});

test.describe("Invite link", () => {
  test("names the team and role, wraps a very long team name, and is healthy", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, "/invite/long");
    await expect(
      page.getByText("Harbour and Bay Roofing and Waterproofing Contractors of the Northern Beaches"),
    ).toBeVisible();
    await expect(page.getByText(/as foreman/)).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  for (const id of ["expired", "cancelled", "used"]) {
    test(`a ${id} invite says so once and offers Sign in, with no Join team`, async ({ page }, testInfo) => {
      const consoleLog = collectConsole(page);
      await open(page, `/invite/${id}`);
      await expect(formAlert(page)).toHaveCount(1);
      await expect(formAlert(page)).toContainText("This invite has expired or was cancelled.");
      await expect(button(page, "Join team")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }
});

test.describe("Owner still setting up", () => {
  for (const role of ["manager", "foreman"]) {
    test(`a ${role} on /onboarding gets the no-access screen with Sign out, and no money`, async ({
      page,
    }, testInfo) => {
      const consoleLog = collectConsole(page);
      await page.goto(`/prototype/role?as=${role}&next=%2Fonboarding`);
      await waitForHydrated(page);
      await expect(
        page.getByRole("heading", { level: 1, name: "The owner is still setting this up" }),
      ).toBeVisible();
      await expect(button(page, "Sign out")).toBeVisible();
      await expect(page.locator("main").getByRole("link")).toHaveCount(0);
      expect(await page.locator("main").innerText()).not.toMatch(/\$\d/);
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }
});
