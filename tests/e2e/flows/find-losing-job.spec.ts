// Flow: Find the job losing money and why (flows.md 194–207): from Home's Needs attention, open the stage trending over
// and then the lines behind its forecast labour, in at most 3 taps.
import { expect, test } from "@playwright/test";
import { getSeed } from "../../../src/data/fake/store";
import { Taps } from "../taps";

const { meta } = getSeed();

test("from Home, a manager finds the Smith job trending over and the lines behind it within 3 taps", async ({ page }) => {
  await page.goto(`/prototype/role?as=manager&next=${encodeURIComponent("/")}`);
  const taps = new Taps("Find the job losing money");
  const row = page.getByRole("link", { name: /^Smith job is trending\s\S+\sover\sbudget\son\ssheet\sinstall\.$/ });
  await expect(row).toHaveCount(1);
  await taps.tap(row);
  await expect(page).toHaveURL(new RegExp(`/jobs/${meta.projects.smith}/stages/[^/?]+$`));
  await expect(page.getByText("Forecast labour")).toBeVisible();
  await taps.tap(page.getByRole("link", { name: /^Forecast labour/ }));
  await expect(page).toHaveURL(new RegExp(`/history\\?job=${meta.projects.smith}$`));
  taps.assertWithin(3);
});
