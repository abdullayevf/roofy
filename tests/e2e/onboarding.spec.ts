import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";

const isPhone = (name: string) => name !== "desktop";

/** The wordmark, the title and the form share one left edge, and the column is the 448 px one, centred. */
async function expectOneColumn(page: Page) {
  const wordmark = await page.getByText("Roofy", { exact: true }).first().boundingBox();
  const title = await page.getByRole("heading", { level: 1 }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(wordmark && title).toBeTruthy();
  expect(Math.abs(wordmark!.x - title!.x)).toBeLessThanOrEqual(1);
  const main = (await page.locator("main").boundingBox())!;
  expect(main.width).toBeLessThanOrEqual(448 + 1);
  expect(Math.abs(main.x + main.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
}

async function open(page: Page, role: string, path: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(path)}`);
}

const STEPS = [
  ["business", "Your business", 1],
  ["trade", "Your trade", 2],
  ["defaults", "Stages and categories", 3],
  ["crew", "Your crew", 4],
  ["install", "Put Roofy on your phone", 5],
] as const;

test.describe("Set-up wizard (screen 2)", () => {
  for (const [step, title, n] of STEPS) {
    test(`step ${n} (${step}) shows its title and progress, with no money and no tab bar`, async ({
      page,
    }, testInfo) => {
      const consoleLog = collectConsole(page);
      await open(page, "owner", `/onboarding?step=${step}`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText(`Step ${n} of 5`)).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }

  test("the install step shows this device's steps under the wizard title, with Continue and Back as the only exits", async ({ page }, testInfo) => {
    await open(page, "owner", "/onboarding?step=install");
    const own = { iphone: /iPhone or iPad/, android: /Android/, desktop: /computer/ }[testInfo.project.name as "iphone" | "android" | "desktop"];
    await expect(page.getByRole("heading", { level: 2, name: own })).toBeVisible();
    if (testInfo.project.name === "iphone") await expect(page.getByRole("listitem").filter({ hasText: "Open Roofy in Safari." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Skip for now" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    // ?platform= shows another device's steps first, as on /install.
    await open(page, "owner", "/onboarding?step=install&platform=ios");
    await expect(page.getByRole("listitem").filter({ hasText: "Open Roofy in Safari." })).toBeVisible();
  });

  test("sign-up leads to one centred column with the wordmark above it", async ({ page }) => {
    await open(page, "owner", "/onboarding?step=business");
    await expectOneColumn(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expectOneColumn(page);
  });

  test("a blank business name and a bad ABN say what to fix, per field", async ({ page }) => {
    await open(page, "owner", "/onboarding?step=business");
    await page.getByLabel("Business name", { exact: true }).fill("");
    await page.getByLabel("ABN", { exact: true }).fill("123");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Add your business name.")).toBeVisible();
    await expect(page.getByText("ABN should be 11 digits.")).toBeVisible();
    await expect(page.getByText("Step 1 of 5")).toBeVisible();
  });

  test("a crew row without a rate is not added", async ({ page }) => {
    await open(page, "owner", "/onboarding?step=crew");
    await page.getByRole("button", { name: "Add crew member" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Sam");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Add an hourly rate.")).toBeVisible();
  });

  test("with a crew row open, one reason line sits directly under the disabled Continue", async ({ page }) => {
    await open(page, "owner", "/onboarding?step=crew");
    await page.getByRole("button", { name: "Add crew member" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Sam");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const next = page.getByRole("button", { name: "Continue", exact: true });
    await expect(next).toBeDisabled();
    const why = page.getByRole("status");
    await expect(why).toHaveText("Add Sam's rate, or cancel.");
    const [a, b] = [(await next.boundingBox())!, (await why.boundingBox())!];
    expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(0);
    expect(b.y - (a.y + a.height)).toBeLessThanOrEqual(24);
    expect(await why.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    // Cancel is a real button with a 48 x 48 hit area, not a small underlined link (lesson 32).
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    const cancelBox = (await cancel.boundingBox())!;
    expect(cancelBox.width, "Cancel is at least 48 px wide").toBeGreaterThanOrEqual(48);
    expect(cancelBox.height, "Cancel is at least 48 px tall").toBeGreaterThanOrEqual(48);
    await cancel.click();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("offline, the steps stay readable and Continue says it needs connection", async ({
    page,
  }, testInfo) => {
    await open(page, "owner", "/onboarding?step=business&demo=offline");
    await expect(page.getByRole("status").filter({ hasText: /connection/i })).toHaveCount(1);
    const next = page.getByRole("button", { name: "Continue", exact: true });
    await expect(next).toBeDisabled();
    // The sentence is body size, in ink, right under the disabled button (not a small grey line under the title).
    const why = page.getByRole("status");
    const [a, b] = [(await next.boundingBox())!, (await why.boundingBox())!];
    expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(0);
    expect(b.y - (a.y + a.height)).toBeLessThanOrEqual(24);
    expect(await why.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("a reload resumes where it was, and Back keeps what was entered", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.getByLabel("Business name", { exact: true }).fill("Smith Roofing");
    await page.getByLabel("ABN", { exact: true }).fill("51 824 753 556");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await expect(page.getByText("Picking up where you left off.")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Your trade" })).toBeVisible();
    await expect(page.getByText("Pick your trade to load its stages.")).toBeVisible();
    await expect(page.getByText("Picking up where you left off.")).toBeVisible();
    // Back is a left-aligned row at the top, not a centred button.
    const back = page.getByRole("button", { name: "Back" });
    const [box, main] = [(await back.boundingBox())!, (await page.locator("main").boundingBox())!];
    expect(box.x - main.x).toBeLessThanOrEqual(1);
    expect(box.width).toBeLessThan(main.width / 2);
    await back.click();
    await expect(page.getByLabel("Business name", { exact: true })).toHaveValue("Smith Roofing");
  });

  test("once set up it hands off to the first job", async ({ page }, testInfo) => {
    await open(page, "owner", "/onboarding");
    await expect(page.getByRole("heading", { level: 1, name: "You're set up" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your first job" })).toHaveAttribute("href", "/jobs/new");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  for (const role of ["manager", "foreman"]) {
    test(`${role} cannot open it and sees no figures`, async ({ page }) => {
      await open(page, role, "/onboarding");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Your business")).toHaveCount(0);
      expect(await page.locator("main").innerText()).not.toMatch(/\$/);
    });
  }
});
