import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "Progress 120 m² split two ways": from Home, at most 8 taps (designed: 7). */
for (const role of ["manager", "foreman"]) {
  test(`Progress 120 m² split two ways as ${role} is 7 taps`, async ({ page }) => {
    await page.goto(`/prototype/role?as=${role}&next=%2F`);
    const taps = new Taps("Progress 120 m² split two ways");
    await taps.tap(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log" }));
    await taps.tap(page.getByRole("radio", { name: "Progress" }));
    await expect(page).toHaveURL(/\/log\/progress/);
    await page.waitForLoadState("networkidle"); // the page is interactive before the first tap
    await taps.tap(page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first());
    await expect(page.getByText(/Budgeted 400 m², measured so far 120 m²\./)).toBeVisible();
    const quantity = page.getByLabel("Quantity done");
    await taps.tap(quantity);
    await quantity.fill("120");
    await taps.tap(page.getByRole("button", { name: /^Sam\s/ }));
    await taps.tap(page.getByRole("button", { name: /^Dima\s/ }));
    await expect(page.getByText("Sam 60 m², Dima 60 m²")).toBeVisible();
    await taps.tap(page.getByRole("button", { name: "Save progress" }));
    const status = page.getByRole("status").filter({ hasText: "Logged" });
    await expect(status.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    expect(taps.count).toBe(7);
    taps.assertWithin(8);
  });
}
