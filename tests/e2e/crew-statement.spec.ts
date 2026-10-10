import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { STATEMENT_CONTRACTOR, STATEMENT_EMPLOYEE } from "./screens";

const isPhone = (name: string) => name !== "desktop";
const FOOTER = "Statement only — not a tax invoice. Please send your invoice as usual.";
const dima = `/s/${STATEMENT_CONTRACTOR}`;
const sam = `/s/${STATEMENT_EMPLOYEE}`;
const totals = (page: Page) => page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Totals" }) });

/** Screen 21: the public statement page. No role cookie is set in these tests: the link alone opens it. */
test.describe("crew statement (21)", () => {
  test("a contractor's statement: business, person, period, lines, GST, balance and the §16 footer; no app nav", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await page.goto(dima);
    await expect(page.getByRole("heading", { level: 1, name: "Pay statement" })).toBeVisible();
    await expect(page.locator("[data-statement-business]")).toHaveText("Harbour Roofing");
    await expect(page.getByText("Dima", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Contractor, ABN /)).toBeVisible();
    await expect(page.locator("[data-statement-period]")).toHaveText("Mon 14 Sep to Sun 20 Sep");
    expect(await page.locator("[data-pay-line]").count()).toBeGreaterThan(0);
    await expect(totals(page).getByText("GST", { exact: true })).toBeVisible();
    await expect(totals(page).locator('[data-pay-sum="total"]')).toContainText("$");
    await expect(page.locator("[data-statement-balance]")).toBeVisible();
    await expect(page.locator("[data-statement-footer]")).toHaveText(FOOTER);
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    // Outside the app shell: no navigation, no tab bar, no sign of the app's sections.
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Crew" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    if (!isPhone(testInfo.project.name)) {
      // Desktop uses the width (lessons): the totals sit beside the work, not under it in one 720 px column.
      const work = (await page.locator("[data-statement-work]").boundingBox())!;
      const summary = (await page.locator("[data-statement-summary]").boundingBox())!;
      expect(summary.x + summary.width).toBeLessThanOrEqual(work.x);
      expect(Math.abs(summary.y - work.y)).toBeLessThan(2);
    }
  });

  test("an employee's statement has Pay, no GST and no contractor footer", async ({ page }, testInfo) => {
    await page.goto(sam);
    await expect(page.getByText("Sam", { exact: true })).toBeVisible();
    await expect(page.getByText("Employee", { exact: true })).toBeVisible();
    await expect(totals(page).getByText("Pay", { exact: true })).toBeVisible();
    await expect(totals(page).getByText("GST", { exact: true })).toHaveCount(0);
    await expect(page.locator("[data-statement-footer]")).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("an unknown link gets one plain sentence and nothing about anyone (expired, turned off and reopened-run links: pay.test.ts)", async ({ page }, testInfo) => {
    await page.goto(`/s/${"0".repeat(64)}`);
    await expect(page.locator("[data-statement-gone]")).toHaveText("This statement link has expired or been turned off. Ask for a new one.");
    await expect(page.getByText("Harbour Roofing")).toHaveCount(0);
    expect(await page.locator("main").innerText()).not.toMatch(/\$\d/);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("loading and error states", async ({ page }) => {
    await page.goto(`${dima}?demo=loading`);
    await expect(page.locator('[data-screen="crew-statement"] [aria-busy="true"]')).toBeVisible();
    await page.goto(`${dima}?demo=error`);
    await expect(page.locator('[data-screen="crew-statement"]').getByRole("alert")).toContainText("Couldn't load this. Try again.");
  });

  test("Share copies the page's own link where there is no share sheet", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) },
        configurable: true,
      });
    });
    await page.goto(dima);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied." })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
    expect(new URL(copied).pathname).toBe(dima);
  });

  test("prints on A4 width: no Share button, nothing wider than the page", async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.emulateMedia({ media: "print" });
    await page.goto(dima);
    await expect(page.locator("[data-statement-footer]")).toHaveText(FOOTER);
    await expect(page.getByRole("button", { name: "Share" })).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
