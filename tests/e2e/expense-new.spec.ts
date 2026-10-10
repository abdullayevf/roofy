import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const smith = meta.projects.smith;
const smithName = seed.projects.find((p) => p.id === smith)!.nickname;
const isPhone = (name: string) => name !== "desktop";
// The same pattern as money-scan.ts MONEY_TEXT: a "$" followed by a digit in what a person reads.
const MONEY_TEXT = /\$\s?\d/;

async function signInAs(page: Page, role: string, next = "/expenses/new") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const screen = (page: Page) => page.locator('[data-screen="expense-new"]');

test.describe("Add expense (manager)", () => {
  test("opens empty: photo, total, GST, optional supplier, date, job, category, paid by", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Add expense" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose photo" })).toBeVisible();
    await expect(page.getByLabel("Total paid")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Includes GST" })).toBeChecked();
    await expect(page.getByLabel("Supplier (optional)")).toHaveValue("");
    await expect(page.getByRole("radio", { name: "Company card" })).toBeChecked();
    await expect(page.getByRole("radiogroup", { name: "Job" })).toBeVisible();
    for (const chip of await page.locator('[data-field="expense-category"] label:visible').all())
      expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Save expense with nothing filled names what is missing; the supplier is not asked for", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Add a total, pick the job and pick a category.").first()).toBeVisible();
    await expect(screen(page)).not.toContainText("supplier.");
  });

  test("GST follows the total ÷ 11, the cost line is ex GST, and No GST takes the GST box away", async ({ page }) => {
    await signInAs(page, "manager");
    // Typed again until the page has hydrated: a fill before then never reaches the form's state.
    await expect(async () => {
      await page.getByLabel("Total paid").fill("110.00");
      await page.getByLabel("Total paid").blur();
      await expect(page.getByLabel("GST amount")).toHaveValue("10.00", { timeout: 1000 });
    }).toPass();
    await expect(page.locator("[data-expense-cost]")).toHaveText("Cost to the job $100.00 ex GST.");
    await page.getByRole("radio", { name: "No GST" }).check({ force: true });
    await expect(page.getByLabel("GST amount")).toHaveCount(0);
    await expect(page.locator("[data-expense-cost]")).toHaveText("Cost to the job $110.00 ex GST.");
  });

  test("paid by a crew member says when they are paid back", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `/expenses/new?job=${smith}&supplier=Bunnings&total=110.00&paid=crew&crew=${meta.crew.dima}`);
    await expect(page.locator("[data-reimbursement]")).toHaveText("Dima is paid this back in the next pay run.");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("reached from a job, the job is already chosen and can be changed", async ({ page }) => {
    await signInAs(page, "manager", `/expenses/new?job=${smith}`);
    await expect(page.locator("[data-job-chosen]")).toHaveText(smithName);
    await page.getByRole("button", { name: "Change job" }).click();
    await expect(page.getByRole("radio", { name: smithName })).toBeChecked();
  });

  test("saved with no signal: the panel says it is on this device and waiting", async ({ page, context }) => {
    await signInAs(page, "manager", `/expenses/new?job=${smith}&total=110.00`);
    await page.locator('[data-field="expense-category"]').getByRole("radio", { name: "Materials" }).check({ force: true });
    await context.setOffline(true);
    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved on this device:" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add another expense" })).toBeVisible();
    await context.setOffline(false);
  });

  test("loading and error states", async ({ page }) => {
    await signInAs(page, "manager", "/expenses/new?demo=error");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.goto("/expenses/new?demo=loading");
    await expect(screen(page)).toHaveAttribute("aria-busy", "true");
  });
});

test.describe("Add expense (foreman and accountant)", () => {
  test("a foreman sees no dollar figure but the total they type", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await expectNoMoney(page, ["/expenses/new", `/expenses/new?job=${smith}`]);
    // The amount box draws a "$" before the input; the scan above proves it never reads as a figure.
    await expect(page.locator('[data-field="expense-total"]')).toContainText("$");
    await page.getByLabel("Total paid").fill("110.00");
    await page.getByLabel("Total paid").blur();
    await expect(page.getByLabel("Total paid")).toHaveValue("110.00");
    await expect(page.getByLabel("GST amount")).toHaveCount(0);
    await expect(page.locator("[data-expense-cost]")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(MONEY_TEXT);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an accountant gets the no-access page", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.getByRole("heading", { level: 1, name: "No access" })).toBeVisible();
  });
});
