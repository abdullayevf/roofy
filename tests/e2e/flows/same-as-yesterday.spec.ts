import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "Same as yesterday": from Home, at most 3 taps. */
for (const role of ["manager", "foreman"]) {
  test(`Same as yesterday as ${role}: Log, Same as yesterday, Save day is 3 taps`, async ({ page }) => {
    await page.goto(`/prototype/role?as=${role}&next=%2F`);
    const taps = new Taps("Same as yesterday");
    await taps.tap(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log" }));
    await taps.tap(page.getByRole("button", { name: "Same as yesterday" }));
    await expect(page.getByLabel("Job", { exact: true })).toHaveValue(/.+/);
    await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
    await taps.tap(page.getByRole("button", { name: "Save day" }));
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
    await expect(page.getByTestId("chalk-line")).toHaveClass(/w-full/);
    expect(taps.count).toBe(3);
    taps.assertWithin(3);
  });
}
