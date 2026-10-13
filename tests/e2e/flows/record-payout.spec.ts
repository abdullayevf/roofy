import { expect, test, type Page } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";
import { formatDate } from "../../../src/lib/format";

const { meta } = getSeed();
const dima = `/crew/${meta.crew.dima}`;

/** The ledger's rows, newest first (List rows are the direct children of its divided group). */
const ledger = (page: Page) =>
  page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Pay and payments" }) }).locator(".divide-y > *");

/**
 * flows.md "Record a payout" (E15.1): with last week's pay run approved, Dima is owed $1,482.00;
 * Home, Crew, Dima, Record payout, amount, Payment, Save payout is 6 taps and leaves nothing owed,
 * with the payment at the top of the ledger dated today (the workspace's date, the form's default).
 */
for (const role of ["manager", "owner"]) {
  test(`Record a $1,482.00 payment to Dima as ${role} in 6 taps`, async ({ page }) => {
    await page.goto(`/prototype/role?as=${role}&next=%2F`);
    // Last week's pay run is a draft in the seed; approve it in this browser's own demo session.
    await page.goto("/prototype/approve-pay-run?next=%2F");
    const taps = new Taps("Record a payout");
    await taps.tap(page.locator('a[href="/crew"]').locator("visible=true").first());
    await taps.tap(page.locator(`a[href="${dima}"]`).locator("visible=true").first());
    await expect(page.getByRole("heading", { level: 1, name: "Dima" })).toBeVisible();
    await expect(page.locator('[data-crew-balance="owed"]')).toContainText(/^Owed\$1,482\.00/);
    await taps.tap(page.getByRole("link", { name: "Record payout" }).locator("visible=true"));
    await expect(page.getByRole("heading", { level: 1, name: "Record payout" })).toBeVisible();
    // The workspace's today (Australia/Sydney in the seed), never the test machine's date.
    const today = meta.today;
    await expect(page.getByLabel("Date paid")).toHaveValue(today);
    const amount = page.getByLabel("Amount", { exact: true });
    await taps.fill(amount, "1482.00");
    await taps.tap(page.getByRole("radio", { name: "Payment" }));
    await taps.tap(page.getByRole("button", { name: "Save payout" }).locator("visible=true"));
    await expect(page.getByText("Payment saved.", { exact: true })).toBeVisible();
    await expect(page.locator('[data-crew-balance="clear"]')).toContainText(/^Nothing owed\$0\.00/);
    const top = ledger(page).first();
    await expect(top).toContainText(/^Payment/);
    await expect(top).toContainText(`${formatDate(today, today)}. Balance after: nothing owed`);
    await expect(top).toContainText("$1,482.00");
    // The saved flag leaves the address once the toast shows; a reload does not show it again.
    await expect(page).toHaveURL(new RegExp(`${dima}$`));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Dima" })).toBeVisible();
    await expect(page.getByText("Payment saved.", { exact: true })).toHaveCount(0);
    expect(taps.count).toBe(6);
    taps.assertWithin(6);
  });
}
