import { expect, test } from "@playwright/test";
import { waitForHydrated } from "../guards";
import { Taps } from "../taps";

/** flows.md "Settings changes": Home -> More -> Settings -> Levels & floor rates -> the floor -> Save changes, within 5 taps. */
test("Settings changes: a level's floor rate saved within 5 taps from Home; $0.00 refused", async ({ page }) => {
  await page.goto(`/prototype/role?as=owner&next=${encodeURIComponent("/")}`);
  await waitForHydrated(page);
  const taps = new Taps("Settings changes");
  await taps.tap(page.getByRole("link", { name: "More", exact: true }).locator("visible=true").first());
  await taps.tap(page.getByRole("link", { name: /^Settings/ }).locator("visible=true").first());
  await taps.tap(page.getByRole("link", { name: /^Levels & floor rates/ }));
  await expect(page).toHaveURL(/\/settings\/levels$/);
  await waitForHydrated(page);
  const roofer = page.getByLabel("Floor rate for Roofer");
  await taps.fill(roofer, "34.50");
  await taps.tap(page.getByRole("button", { name: "Save changes" }));
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  taps.assertWithin(5);

  await page.reload();
  await waitForHydrated(page);
  await expect(page.getByLabel("Floor rate for Roofer"), "the new floor is kept").toHaveValue("34.50");

  for (const bad of ["0.00", ""]) {
    // outside the count: the refusal check runs after the budget is asserted.
    await page.getByLabel("Floor rate for Roofer").fill(bad);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Add a floor rate before saving.")).toBeVisible();
  }
  await page.reload();
  await waitForHydrated(page);
  await expect(page.getByLabel("Floor rate for Roofer"), "a refused floor is never saved as $0.00").toHaveValue("34.50");
});
