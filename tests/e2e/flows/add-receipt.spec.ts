import { expect, test } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const smith = meta.projects.smith;
const smithName = seed.projects.find((p) => p.id === smith)!.nickname;
// A 1×1 PNG: the receipt photo the camera hands back.
const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

/**
 * flows.md "Add a receipt": More, Expenses, Add expense, Take photo, total (typed), job, Materials,
 * Crew member, Dima, Save expense is 10 taps. The supplier is optional and left blank. After saving,
 * the job's expenses list shows the row "Paid by Dima — reimbursed next pay run".
 */
test("Add a $110.00 receipt paid by Dima in 10 taps", async ({ page }) => {
  await page.goto(`/prototype/role?as=manager&next=%2F`);
  const taps = new Taps("Add a receipt");
  await taps.tap(page.locator('a[href="/more"]').locator("visible=true").first());
  await taps.tap(page.locator('a[href="/expenses"]').locator("visible=true").first());
  await taps.tap(page.getByRole("link", { name: "Add expense" }).locator("visible=true").first());
  await expect(page.getByRole("heading", { level: 1, name: "Add expense" })).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await taps.tap(page.getByRole("button", { name: "Take photo" }));
  await (await chooser).setFiles({ name: "receipt.png", mimeType: "image/png", buffer: PHOTO });
  await expect(page.getByRole("img", { name: "Receipt photo" })).toBeVisible();
  await page.getByLabel("Total paid").fill("110.00");
  await taps.tap(page.locator('[data-field="expense-job"]').getByRole("radio", { name: smithName, exact: true }));
  await taps.tap(page.locator('[data-field="expense-category"]').getByRole("radio", { name: "Materials", exact: true }));
  await taps.tap(page.locator('[data-field="expense-paid-by"]').getByRole("radio", { name: "Crew member", exact: true }));
  await taps.tap(page.locator('[data-field="expense-crew"]').getByRole("radio", { name: "Dima", exact: true }));
  await expect(page.locator("[data-reimbursement]")).toHaveText("Paid by Dima — reimbursed next pay run");
  await taps.tap(page.getByRole("button", { name: "Save expense" }));
  await expect(page).toHaveURL(new RegExp(`/expenses\\?job=${smith}$`));
  const row = page
    .locator('[data-screen="expenses"] [data-expense-row]:visible')
    .filter({ has: page.locator("[data-expense-supplier]", { hasText: "No supplier" }) })
    .first();
  // flows.md 186: the row reads the same as the form's note.
  await expect(row.locator("[data-expense-paid-by]")).toHaveText("Paid by Dima — reimbursed next pay run");
  // The picked photo stays with the expense: the row shows the receipt marker (a stand-in id until uploads, Phase 5).
  await expect(row.locator("[data-expense-receipt]")).toHaveAttribute("data-expense-receipt", "yes");
  taps.assertWithin(10);
});
