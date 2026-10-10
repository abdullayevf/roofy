import { expect, test } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
/** A company-card expense on the Smith job: no receipt, no pay run, so the edit moves only the job's costs. */
const target = seed.expenses.find((e) => e.receiptFileId === null && e.paidBy === "company_card" && e.projectId === meta.projects.smith)!;

/**
 * flows.md "Expense edit": More, Expenses, the expense, Edit, the total (typing not counted), Save changes is 6 taps.
 * After saving the new figure shows on the expense and in the list, and Record history links to its changes.
 */
test("Correct the total on a saved expense in 6 taps", async ({ page }) => {
  await page.goto(`/prototype/role?as=manager&next=%2F`);
  const taps = new Taps("Expense edit");
  await taps.tap(page.locator('a[href="/more"]').locator("visible=true").first());
  await taps.tap(page.locator('a[href="/expenses"]').locator("visible=true").first());
  await taps.tap(page.locator(`a[href="/expenses/${target.id}"]`).locator("visible=true").first());
  await taps.tap(page.getByRole("link", { name: "Edit", exact: true }));
  await expect(page.getByRole("heading", { level: 1, name: "Edit expense" })).toBeVisible();
  const total = page.getByLabel("Total paid");
  // A different figure each run, since the fake server keeps the last one.
  const next = (await total.inputValue()) === "123.45" ? "123.40" : "123.45";
  await taps.tap(total);
  await total.fill(next);
  await taps.tap(page.getByRole("button", { name: "Save changes" }));
  await expect(page).toHaveURL(new RegExp(`/expenses/${target.id}\\?saved=1$`));
  await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toBeVisible();
  await expect(page.locator('[data-screen="expense-detail"]').getByText(`$${next}`).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Record history" })).toHaveAttribute("href", `/history?table=expense&rowId=${target.id}`);
  taps.assertWithin(6);
  await page.goto("/expenses");
  // The row is a link on a phone and a table row on a desktop; the id marks it on both.
  await expect(page.locator(`[data-screen="expenses"] [data-expense-row][data-expense-id="${target.id}"]:visible`).locator("[data-expense-total]")).toHaveText(`$${next}`);
});
