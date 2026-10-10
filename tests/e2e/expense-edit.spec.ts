import { expect, test, type Page } from "@playwright/test";
import { checkMoneyFigureFont, checkSegmentedRows, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const isPhone = (name: string) => name !== "desktop";
const runStatus = new Map(seed.payRuns.map((r) => [r.id, r.status]));
/** Smith's sheets: a company-card expense with its receipt kept. */
const withReceipt = meta.expenses.smithSheets;
/** A crew member's receipt already paid back in an approved (here exported) pay run. */
const approved = seed.expenses.find(
  (e) => e.reimbursedInPayRunId && runStatus.get(e.reimbursedInPayRunId) !== "draft",
)!.id;
/** A company-card expense with no receipt and no pay run. */
const noReceipt = seed.expenses.find(
  (e) => e.receiptFileId === null && e.paidBy === "company_card" && e.projectId === meta.projects.smith,
)!.id;
const WARNING =
  "This expense is in an approved pay run. Saving will adjust next week's pay run, not this one.";
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
    await expect(page.getByRole("link", { name: "Record history" })).toHaveAttribute(
      "href",
      `/history?table=expense&rowId=${withReceipt}`,
    );
    // D3/F6: what it cost the job is the key figure under the title.
    const cost = page.locator("[data-expense-cost]");
    await expect(cost).toContainText(/^\$[\d,]+\.\d{2}\s*cost to the job/);
    expect((await cost.boundingBox())!.y).toBeGreaterThan(
      (await page.locator('[data-screen="expense-detail"] h1').boundingBox())!.y,
    );
    // D21/F19 (guard): every money value on the page (key figure, total, GST) is in the figure font, and it is Card, as on the form.
    expect((await checkMoneyFigureFont(page, '[data-screen="expense-detail"]')).failures).toEqual([]);
    await expect(screen.locator('[data-fact="paid-by"]')).toContainText(/^Paid by(Card|Cash|\w+)/);
    await expect(screen.getByText("Company card")).toHaveCount(0);
    // D22/F16 (guard): on a phone and tablet Edit is pinned in a bar clear of the tab bar; on a desktop it sits in the title row.
    const edit = page.getByRole("link", { name: "Edit", exact: true });
    const editBox = (await edit.boundingBox())!;
    const vpSize = page.viewportSize()!;
    if (isPhone(testInfo.project.name)) {
      expect(editBox.y + editBox.height).toBeLessThanOrEqual(vpSize.height - 56);
      expect(editBox.height).toBeGreaterThanOrEqual(48);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect((await edit.boundingBox())!.y).toBe(editBox.y);
    } else {
      expect(editBox.y).toBeLessThan(
        (await page.locator('[data-screen="expense-detail"] h1').boundingBox())!.y + 80,
      );
    }
    // F9: Record history is a 48 px row target.
    expect(
      (await page.getByRole("link", { name: "Record history" }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(48);
    // D5/F7: the receipt row opens the photo full screen; Close brings the page back.
    await page.locator("[data-receipt-open]").click();
    const full = page.locator("[data-receipt-full]");
    await expect(full).toBeVisible();
    const vp = page.viewportSize()!;
    const fb = (await full.boundingBox())!;
    expect(Math.round(fb.width)).toBe(vp.width);
    expect(Math.round(fb.height)).toBe(vp.height);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(full).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveAttribute(
      "href",
      `/expenses/${withReceipt}?edit=1`,
    );
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
    await expect(page.locator("[data-receipt-kept]")).toHaveText("Receipt — Harbour Steel.jpg");
    // D15/F20 (guard): the thumbnail and the file name share one line (no prefix, no wrap); Replace and Remove sit under that line.
    const line = (await page.locator("[data-receipt-line]").boundingBox())!;
    expect((await page.locator("[data-receipt-kept]").boundingBox())!.height).toBeLessThanOrEqual(24);
    expect(line.height).toBeLessThanOrEqual(64);
    for (const name of ["Replace photo", "Remove photo"])
      expect((await page.getByRole("button", { name }).boundingBox())!.y).toBeGreaterThanOrEqual(
        line.y + line.height,
      );
    await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
    await expect(page.locator("[data-job-chosen]")).toBeVisible();
    await expect(page.locator("[data-approved-warning]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    expect((await checkSegmentedRows(page)).failures).toEqual([]);
  });

  test("no receipt offers the same photo buttons as Add; Remove takes a kept receipt off", async ({
    page,
  }) => {
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
