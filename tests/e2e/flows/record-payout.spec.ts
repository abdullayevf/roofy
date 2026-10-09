import { expect, test, type Page } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const { meta } = getSeed();
const dima = `/crew/${meta.crew.dima}`;

/** A shown dollar figure as integer cents (digits only, no float). */
const cents = (text: string) => Number.parseInt(text.replace(/[^\d]/g, ""), 10);

async function signedBalance(page: Page): Promise<number> {
  const box = page.locator("[data-crew-balance]");
  const kind = await box.getAttribute("data-crew-balance");
  const figure = (await box.textContent())?.match(/\$[\d,]+\.\d{2}/)?.[0] ?? "";
  return kind === "ahead" ? -cents(figure) : cents(figure);
}

/** flows.md "Record a payout": Home, Crew, Dima, Record payout, amount, Payment, Save payout is 6 taps; the balance drops by it. */
for (const role of ["manager", "owner"]) {
  test(`Record a $1,482.00 payment to Dima as ${role} in 6 taps`, async ({ page }) => {
    await page.goto(`/prototype/role?as=${role}&next=%2F`);
    const taps = new Taps("Record a payout");
    await taps.tap(page.locator('a[href="/crew"]').locator("visible=true").first());
    await taps.tap(page.locator(`a[href="${dima}"]`).locator("visible=true").first());
    await expect(page.getByRole("heading", { level: 1, name: "Dima" })).toBeVisible();
    const before = await signedBalance(page);
    await taps.tap(page.getByRole("link", { name: "Record payout" }).locator("visible=true"));
    await expect(page.getByRole("heading", { level: 1, name: "Record payout" })).toBeVisible();
    await expect(page.getByLabel("Date paid")).toHaveValue("2026-09-28");
    const amount = page.getByLabel("Amount", { exact: true });
    await taps.tap(amount);
    await amount.fill("1482.00");
    await taps.tap(page.getByRole("radio", { name: "Payment" }));
    await taps.tap(page.getByRole("button", { name: "Save payout" }).locator("visible=true"));
    await expect(page).toHaveURL(new RegExp(`${dima}\\?saved=payment$`));
    await expect(page.getByText("Payment saved.", { exact: true })).toBeVisible();
    expect(await signedBalance(page)).toBe(before - 148200);
    await expect(page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Pay and payments" }) })).toContainText("$1,482.00");
    expect(taps.count).toBe(6);
    taps.assertWithin(6);
  });
}
