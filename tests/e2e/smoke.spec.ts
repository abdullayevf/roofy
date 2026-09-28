import { expect, test } from "@playwright/test";
import { runAxe } from "./axe";

test("home renders with the product name and no serious a11y issues", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Roofy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Roofy");
  const results = await runAxe(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious).toEqual([]);
});
