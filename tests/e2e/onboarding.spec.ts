import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";

const isPhone = (name: string) => name !== "desktop";

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
    await expect(page.getByText("Add a rate before adding.")).toBeVisible();
  });

  test("offline, the steps stay readable and Continue says it needs connection", async ({
    page,
  }, testInfo) => {
    await open(page, "owner", "/onboarding?step=business&demo=offline");
    await expect(page.getByRole("status").filter({ hasText: /connection/i })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("a reload resumes where it was, and Back keeps what was entered", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.getByLabel("Business name", { exact: true }).fill("Smith Roofing");
    await page.getByLabel("ABN", { exact: true }).fill("51 824 753 556");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Your trade" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).first().click();
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
