// Flow: Reports drill-down (flows.md "Reports drill-down", 387–402): from Home, open Job profitability and drill into one
// job's numbers in at most 5 taps.
import { expect, test } from "@playwright/test";
import { getSeed } from "../../../src/data/fake/store";
import { Taps } from "../taps";

const { meta } = getSeed();

test("from Home, a manager opens Job profitability and drills into the Smith job within 5 taps", async ({ page }) => {
  await page.goto(`/prototype/role?as=manager&next=${encodeURIComponent("/")}`);
  const taps = new Taps("Reports drill-down");
  await taps.tap(page.locator('a[href="/more"]:visible').first());
  await expect(page).toHaveURL(/\/more$/);
  await taps.tap(page.locator('main a[href="/reports"]:visible').first());
  await expect(page.locator("[data-report-card]")).toHaveCount(5);
  await taps.tap(page.locator("[data-report-card]").getByRole("link", { name: /^Job profitability/ }));
  await expect(page).toHaveURL(/\/reports\/job-profitability$/);
  const smith = page.locator(`[data-report-screen] a[href="/jobs/${meta.projects.smith}"]:visible`);
  await expect(smith).toContainText("Smith job");
  await taps.tap(smith);
  await expect(page).toHaveURL(new RegExp(`/jobs/${meta.projects.smith}$`));
  taps.assertWithin(5);
});
