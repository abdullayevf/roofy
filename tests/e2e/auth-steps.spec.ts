import { expect, test, type Page } from "@playwright/test";
import {
  checkCodeFieldFont,
  checkEntryLinesMeta,
  checkInlineLinkHit,
  collectConsole,
  expectScreenHealthy,
  waitForHydrated,
} from "./guards";

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
    // Too many tries clears the box and locks both the box and the button until the wait is over.
    await expect(page.getByLabel("Code")).toHaveValue("");
    await expect(page.getByLabel("Code")).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Try again in \d+ s$/ })).toBeDisabled();
    expect((await checkEntryLinesMeta(page, { phone: isPhone(testInfo.project.name) })).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the code box is Atkinson with tabular figures and no spacing, and Back to sign in is a 48 px link on the left", async ({
    page,
  }) => {
    await open(page, "/two-factor");
    await page.getByLabel("Code").fill("482913");
    expect((await checkCodeFieldFont(page)).failures).toEqual([]);
    expect((await checkInlineLinkHit(page)).failures).toEqual([]);
    const link = page.getByRole("link", { name: "Back to sign in" });
    const field = await page.getByLabel("Code").boundingBox();
    const box = await link.boundingBox();
    expect(
      Math.abs(box!.x - field!.x),
      "Back to sign in lines up with the box's left edge",
    ).toBeLessThanOrEqual(1);
  });

  test("the error demo shows its sentence with Try again as the one button", async ({ page }) => {
    await open(page, "/two-factor?demo=error");
    await expect(formAlert(page)).toHaveText("Couldn't check your code. Try again.");
    await expect(button(page, "Try again")).toBeVisible();
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
    await expect(page.getByText(/as a foreman/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Join Harbour and Bay/);
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
      const out = await button(page, "Sign out").boundingBox();
      const column = await page.locator("main").boundingBox();
      expect(out!.width, "Sign out is full width").toBeGreaterThanOrEqual(
        Math.min(column!.width - 32, 448 - 32) - 1,
      );
      await expect(page.locator("main").getByRole("link")).toHaveCount(0);
      expect(await page.locator("main").innerText()).not.toMatch(/\$\d/);
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }
});
