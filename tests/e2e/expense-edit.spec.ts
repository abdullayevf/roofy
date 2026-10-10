import { expect, test, type Page } from "@playwright/test";
import { checkSegmentedRows, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const isPhone = (name: string) => name !== "desktop";
const runStatus = new Map(seed.payRuns.map((r) => [r.id, r.status]));
/** Smith's sheets: a company-card expense with its receipt kept. */
const withReceipt = meta.expenses.smithSheets;
/** A crew member's receipt already paid back in an approved (here exported) pay run. */
const approved = seed.expenses.find((e) => e.reimbursedInPayRunId && runStatus.get(e.reimbursedInPayRunId) !== "draft")!.id;
/** A company-card expense with no receipt and no pay run. */
const noReceipt = seed.expenses.find((e) => e.receiptFileId === null && e.paidBy === "company_card" && e.projectId === meta.projects.smith)!.id;
const WARNING = "This expense is in an approved pay run. Saving will adjust next week's pay run, not this one.";
const NEEDS_CONNECTION = "Needs connection. Try again once you're back online.";

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("Expense (owner and manager)", () => {
  test("shows the figures, the receipt, Edit and Record history", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "owner", `/expenses/${withReceipt}`);
    const screen = page.locator('[data-screen="expense-detail"]');
    await expect(screen.getByText("Total paid")).toBeVisible();
    await expect(screen.getByText("Cost to the job")).toBeVisible();
    await expect(screen.getByText("Receipt — Harbour Steel.jpg")).toBeVisible();
    await expect(page.getByRole("link", { name: "Record history" })).toHaveAttribute("href", `/history?table=expense&rowId=${withReceipt}`);
    await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveAttribute("href", `/expenses/${withReceipt}?edit=1`);
    if (!isPhone(testInfo.project.name)) {
      // Desktop uses the width: the figures and the facts sit side by side, not in one narrow column.
      const [a, b] = await Promise.all(
        [0, 1].map((i) => screen.locator(".border-group").nth(i).boundingBox()),
      );
      expect(a && b && b.x >= a.x + a.width).toBe(true);
      expect(a && b && Math.abs(b.y - a.y) < 2).toBe(true);
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Edit opens the same form, filled in, with the receipt kept", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `/expenses/${withReceipt}?edit=1`);
    await expect(page.getByRole("heading", { level: 1, name: "Edit expense" })).toBeVisible();
    await expect(page.locator('[data-screen="expense-edit"]')).toBeVisible();
    await expect(page.getByLabel("Total paid")).toHaveValue(/^[\d,]+\.\d\d$/);
    await expect(page.locator("[data-receipt-kept]")).toHaveText("Receipt attached: Receipt — Harbour Steel.jpg");
    await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
    await expect(page.locator("[data-job-chosen]")).toBeVisible();
    await expect(page.locator("[data-approved-warning]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    expect((await checkSegmentedRows(page)).failures).toEqual([]);
  });

  test("no receipt offers the same photo buttons as Add; Remove takes a kept receipt off", async ({ page }) => {
    await signInAs(page, "manager", `/expenses/${noReceipt}?edit=1`);
    await expect(page.locator("[data-receipt-kept]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose photo" })).toBeVisible();
    await page.goto(`/expenses/${withReceipt}?edit=1`);
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.locator("[data-receipt-kept]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
  });

  test("an expense in an approved pay run shows the warning first", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `/expenses/${approved}?edit=1`);
    const warning = page.locator("[data-approved-warning]");
    await expect(warning).toHaveText(WARNING);
    const form = await page.getByLabel("Total paid").boundingBox();
    expect((await warning.boundingBox())!.y, "warning above the form").toBeLessThan(form!.y);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline: Save changes is off and says it needs a connection", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `/expenses/${withReceipt}?edit=1&demo=offline`);
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await expect(page.getByText(NEEDS_CONNECTION)).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("saved, loading and error", async ({ page }) => {
    await signInAs(page, "manager", `/expenses/${withReceipt}?saved=1`);
    await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toBeVisible();
    await page.goto(`/expenses/${withReceipt}?demo=loading`);
    await expect(page.locator('[data-screen="expense-detail"][aria-busy="true"]')).toBeAttached();
    await expect(page.getByRole("heading", { level: 1, name: "Expense", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
    await page.goto(`/expenses/${withReceipt}?demo=error`);
    await expect(page.getByRole("heading", { level: 1, name: "Expense", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.goto(`/expenses/${withReceipt}?edit=1&demo=loading`);
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await expect(page.getByRole("heading", { level: 1, name: "Edit expense" })).toBeVisible();
    await page.goto(`/expenses/${withReceipt}?edit=1&demo=error`);
    await expect(page.getByRole("heading", { level: 1, name: "Edit expense" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("Expense (foreman and accountant)", () => {
  test("a foreman gets no access and no money", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", `/expenses/${withReceipt}?edit=1`);
    await expect(page.getByRole("heading", { level: 1, name: "No access" })).toBeVisible();
    await expect(page.getByLabel("Total paid")).toHaveCount(0);
    await expectNoMoney(page, [`/expenses/${withReceipt}`, `/expenses/${withReceipt}?edit=1`]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an accountant reads the expense with no Edit and no Save", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "accountant", `/expenses/${withReceipt}`);
    const screen = page.locator('[data-screen="expense-detail"]');
    await expect(screen.getByText("Total paid")).toBeVisible();
    await expect(screen.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "No access" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    // ?edit=1 does not open the form for the accountant: still the read-only detail.
    await page.goto(`/expenses/${withReceipt}?edit=1`);
    await expect(screen.getByText("Total paid")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save/ })).toHaveCount(0);
    await expect(page.getByLabel("Total paid")).toHaveCount(0);
  });

  test("an accountant opens an expense from the list", async ({ page }) => {
    await signInAs(page, "accountant", "/expenses");
    const row = page.locator('[data-screen="expenses"] [data-expense-row]:visible').first();
    await row.click();
    await expect(page).toHaveURL(/\/expenses\/[^/?]+$/);
    await expect(page.locator('[data-screen="expense-detail"]').getByText("Total paid")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "No access" })).toHaveCount(0);
  });
});
