import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy, waitForHydrated } from "./guards";

const isPhone = (name: string) => name !== "desktop";
const OWNER_EMAIL = "karen@harbourroofing.example";
const DEMO_PASSWORD = "roofy-demo";
const LONG_EMAIL = "maria.fernanda.van-der-westhuizen-smith@harbour-and-bay-roofing-contractors.example";
const email = (page: Page) => page.getByLabel("Email");
const password = (page: Page) => page.getByLabel("Password");
/** The form's own message; Next adds its own empty role="alert" route announcer to every page. */
const formAlert = (page: Page) => page.locator("form [role=alert]");
const primary = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function fill(page: Page, address: string, pass: string) {
  await email(page).fill(address);
  await password(page).fill(pass);
}

/**
 * Design-loop keyboard-open check, kept as a test: with the keyboard up an iPhone has 508 px (844 - KEYBOARD_HEIGHT_PX);
 * the primary button has to sit fully inside that, beside the Password field being typed in, with no scrolling.
 */
async function expectPrimaryClearOfKeyboard(page: Page, action: string, phone: boolean) {
  test.skip(!phone, "the on-screen keyboard is a phone matter");
  const width = page.viewportSize()?.width ?? 390;
  await password(page).focus();
  await page.setViewportSize({ width, height: 508 });
  const box = await primary(page, action).boundingBox();
  expect(box, `${action} is on the page`).not.toBeNull();
  expect(box!.y, `${action} top`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${action} bottom, with the keyboard open (viewport 508 px tall)`).toBeLessThanOrEqual(508);
}

test.describe("Sign in (screen 1)", () => {
  test("shows Google and email sign-in with one primary button, and no tab bar", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-in");
    await waitForHydrated(page);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    await expect(primary(page, "Sign in")).toBeEnabled();
    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
    await expect(page.getByRole("navigation", { name: "Primary" }), "nobody is signed in, so there is no app bar").toHaveCount(0);
    await expect(password(page)).toHaveAttribute("autocomplete", "current-password");
    await expect(email(page)).toHaveAttribute("type", "email");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("with the keyboard open the Sign in button is still fully on screen", async ({ page }, testInfo) => {
    await page.goto("/sign-in");
    await waitForHydrated(page);
    await expectPrimaryClearOfKeyboard(page, "Sign in", isPhone(testInfo.project.name));
  });

  test("an empty form says what is missing, beside each field, and puts the cursor on the first", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-in");
    await waitForHydrated(page);
    await primary(page, "Sign in").click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(email(page)).toBeFocused();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("text typed before the page has woken up is never lost: the box is read-only until then (F1)", async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/_next/static/**", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/sign-in", { waitUntil: "commit" });
    await expect(email(page)).toBeVisible();
    await expect(email(page), "before hydration the box takes no typing").toHaveAttribute("readonly", "");
    await email(page).click({ force: true });
    await page.keyboard.type(OWNER_EMAIL);
    // Let the held script requests through. The handler stays in place: it has several requests parked
    // on `held`, and unrouting it while they wake makes each one's continue() hit "Route is already handled!".
    release();
    await waitForHydrated(page);
    await expect(email(page), "once React is attached the box takes typing").not.toHaveAttribute("readonly", "");
    const kept = await email(page).inputValue();
    expect(kept, "typing before hydration did not land in the box, so nothing can be silently lost").toBe("");
    await fill(page, OWNER_EMAIL, DEMO_PASSWORD);
    await primary(page, "Sign in").click();
    await expect(page.getByText("Enter your email address.")).toHaveCount(0);
  });

  test("a wrong password keeps what was typed and says so in plain words", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-in");
    await waitForHydrated(page);
    await fill(page, OWNER_EMAIL, "not-the-password");
    await primary(page, "Sign in").click();
    await expect(formAlert(page)).toHaveText("That email and password don't match. Check them and try again.");
    await expect(email(page)).toHaveValue(OWNER_EMAIL);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a very long email stays inside its field and the page does not scroll sideways", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-in");
    await waitForHydrated(page);
    await fill(page, LONG_EMAIL, "not-the-password");
    const box = (await email(page).boundingBox())!;
    expect(box.x, "the field starts on the page").toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, "the field ends on the page").toBeLessThanOrEqual(page.viewportSize()!.width);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the owner's email and the demo password land on Home", async ({ page }) => {
    await page.goto("/sign-in");
    await waitForHydrated(page);
    await fill(page, OWNER_EMAIL, DEMO_PASSWORD);
    await primary(page, "Sign in").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("navigation", { name: "Primary" }).first()).toBeVisible();
  });

  test("Continue with Google goes straight on to Home", async ({ page }) => {
    await page.goto("/sign-in");
    await waitForHydrated(page);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("navigation", { name: "Primary" }).first()).toBeVisible();
  });

  test("while it checks, the button is busy and can't be pressed twice", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-in?demo=loading");
    await waitForHydrated(page);
    await expect(page.getByRole("button", { name: "Signing in" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("with no signal it says it needs a connection and blocks both buttons", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-in?demo=offline");
    await waitForHydrated(page);
    await expect(page.getByText("Needs connection — try again once you're back online.")).toHaveCount(1);
    await expect(primary(page, "Sign in")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("when something goes wrong it says sorry in one sentence and lets them try again", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-in?demo=error");
    await waitForHydrated(page);
    await fill(page, OWNER_EMAIL, DEMO_PASSWORD);
    await primary(page, "Sign in").click();
    await expect(formAlert(page)).toHaveText("Couldn't sign you in. Try again.");
    await expect(primary(page, "Sign in")).toBeEnabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });
});

test.describe("Sign up (screen 2)", () => {
  test("shows Google and email sign-up with one primary button, and a way back to sign in", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-up");
    await waitForHydrated(page);
    await expect(page.getByRole("heading", { level: 1, name: "Create your account" })).toBeVisible();
    await expect(primary(page, "Create account")).toBeEnabled();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    await expect(password(page)).toHaveAttribute("autocomplete", "new-password");
    await expect(page.getByText("At least 8 characters")).toHaveCount(1);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("with the keyboard open the Create account button is still fully on screen", async ({ page }, testInfo) => {
    await page.goto("/sign-up");
    await waitForHydrated(page);
    await expectPrimaryClearOfKeyboard(page, "Create account", isPhone(testInfo.project.name));
  });

  test("a short password and a half-typed email are named beside their fields", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-up");
    await waitForHydrated(page);
    await fill(page, "karen@harbourroofing", "short");
    await primary(page, "Create account").click();
    await expect(page.getByText("Check your email address. It should look like name@example.com.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(email(page)).toBeFocused();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an email that already has an account is told to sign in instead", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto("/sign-up");
    await waitForHydrated(page);
    await fill(page, OWNER_EMAIL, "a-long-password");
    await primary(page, "Create account").click();
    await expect(page.getByText("An account with that email already exists. Sign in instead.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a new email and a good password go on to set up the business", async ({ page }) => {
    await page.goto("/sign-up");
    await waitForHydrated(page);
    await fill(page, "new.owner@example.com", "a-long-password");
    await primary(page, "Create account").click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("no signal and the busy state are shown like on sign in", async ({ page }, testInfo) => {
    await page.goto("/sign-up?demo=offline");
    await waitForHydrated(page);
    await expect(primary(page, "Create account")).toBeDisabled();
    await page.goto("/sign-up?demo=loading");
    await waitForHydrated(page);
    await expect(page.getByRole("button", { name: "Creating account" })).toBeDisabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });
});
