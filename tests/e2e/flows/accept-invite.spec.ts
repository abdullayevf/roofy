import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "Accept invite": from the invite link, at most 2 taps. */
test("Accept invite: the page names the team and role, then Join team is 1 tap", async ({ page }) => {
  await page.goto("/invite/good-invite");
  await expect(page.getByText("Harbour Roofing")).toBeVisible();
  await expect(page.getByText("as foreman")).toBeVisible();
  const taps = new Taps("Accept invite");
  await taps.tap(page.getByRole("button", { name: "Join team", exact: true }));
  await expect(page).toHaveURL(/\/$/);
  expect(taps.count).toBe(1);
  taps.assertWithin(2);
});
