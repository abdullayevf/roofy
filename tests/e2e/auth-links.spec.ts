import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy, waitForHydrated } from "./guards";

const isPhone = (name: string) => name !== "desktop";
const OWNER_EMAIL = "karen@harbourroofing.example";
const LONG_EMAIL = "maria.fernanda.van-der-westhuizen-smith@harbour-and-bay-roofing-contractors.example";
const SENT = "If that email has an account, we've sent a link to set a new password. Check your email.";
const EXPIRED = "This link has expired or was already used. Ask for a new one.";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
/** The form's own message; Next adds its own empty role="alert" route announcer to every page. */
const formAlert = (page: Page) => page.locator("main [role=alert]").filter({ hasText: /\S/ });

async function open(page: Page, url: string) {
  await page.goto(url);
  await waitForHydrated(page);
}

test.describe("Sign in links to Forgot password", () => {
  test("Forgot password? is a 48 px link to /forgot-password, only on sign in", async ({ page }) => {
    await open(page, "/sign-in");
    const link = page.getByRole("link", { name: "Forgot password?" });
    await expect(link).toHaveAttribute("href", "/forgot-password");
    const box = await link.boundingBox();
    expect(box!.height, "Forgot password? hit area").toBeGreaterThanOrEqual(48);
    await link.click();
    await expect(page.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeVisible();
    await open(page, "/sign-up");
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveCount(0);
  });
});

test.describe("Check your email", () => {
  test("names the address, wraps a long one, and offers a different email or sign in", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, `/check-email?email=${encodeURIComponent(LONG_EMAIL)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
    await expect(page.getByText(LONG_EMAIL)).toBeVisible();
    await expect(page.getByRole("link", { name: "Use a different email" })).toHaveAttribute("href", "/sign-up");
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("without an address it still says a link was sent", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, "/check-email");
    await expect(page.getByText("We sent you a link. Open it to finish setting up.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });
});

test.describe("Forgot password", () => {
  test("a blank box says what is missing; a known and an unknown email get the same answer", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, "/forgot-password");
    await button(page, "Send link").click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeFocused();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    const answers: string[] = [];
    for (const address of [OWNER_EMAIL, "nobody@nowhere.example", LONG_EMAIL]) {
      await open(page, "/forgot-password");
      await page.getByLabel("Email").fill(address);
      await button(page, "Send link").click();
      const status = page.getByRole("status").filter({ hasText: SENT });
      await expect(status).toBeVisible();
      answers.push((await status.textContent()) ?? "");
      await expect(page.getByText(address)).toHaveCount(0);
    }
    expect(new Set(answers).size, "one answer for every email").toBe(1);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline says Needs connection and blocks the button", async ({ page }) => {
    await open(page, "/forgot-password?demo=offline");
    await expect(page.getByText(/Needs connection/)).toBeVisible();
    await expect(button(page, "Send link")).toBeDisabled();
  });
});

test.describe("Reset password", () => {
  test("a short password is refused; a good one says to sign in", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, "/reset-password?token=good-link");
    await page.getByLabel("New password").fill("short");
    await button(page, "Set password").click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await page.getByLabel("New password").fill("a-long-password");
    await button(page, "Set password").click();
    await expect(page.getByText("Your password is set. Sign in with it now.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  for (const token of ["expired", "used"]) {
    test(`a ${token} link says so, once, and points at a new one`, async ({ page }, testInfo) => {
      const consoleLog = collectConsole(page);
      await open(page, `/reset-password?token=${token}`);
      await page.getByLabel("New password").fill("a-long-password");
      await button(page, "Set password").click();
      await expect(formAlert(page)).toHaveText(EXPIRED);
      await expect(page.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", "/forgot-password");
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }

  test("a link with no token shows the expired sentence and no form", async ({ page }) => {
    await open(page, "/reset-password");
    await expect(formAlert(page)).toHaveText(EXPIRED);
    await expect(page.getByLabel("New password")).toHaveCount(0);
  });
});

test.describe("Verify email", () => {
  test("a good link goes on to set-up", async ({ page }) => {
    await page.goto("/verify?token=good-link");
    await expect(page).toHaveURL(/\/onboarding/);
  });

  for (const token of ["expired", "used", null]) {
    test(`${token ?? "a missing"} token says the link is no good and offers Sign in`, async ({ page }, testInfo) => {
      const consoleLog = collectConsole(page);
      await open(page, token ? `/verify?token=${token}` : "/verify");
      await expect(formAlert(page)).toHaveText(EXPIRED);
      await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }

  test("the demo states: loading stays on Checking your link, offline says Needs connection, error offers Try again", async ({ page }) => {
    await open(page, "/verify?token=good-link&demo=loading");
    await expect(page.getByText("Checking your link")).toBeVisible();
    await expect(page).toHaveURL(/\/verify/);
    await open(page, "/verify?token=good-link&demo=offline");
    await expect(page.getByText(/Needs connection/)).toBeVisible();
    await open(page, "/verify?token=good-link&demo=error");
    await expect(formAlert(page)).toHaveText("Couldn't check your link. Try again.");
    await expect(button(page, "Try again")).toBeVisible();
  });
});
