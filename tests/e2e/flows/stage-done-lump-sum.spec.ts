import { expect, test } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const { meta } = getSeed();

/** flows.md "Stage done with lump sum": Home, Jobs, Harris job, ridge stage, Mark stage done, Confirm done is 5 taps. */
test("Stage done with lump sum as manager: 5 taps, the stage is then Done", async ({ page }) => {
  await page.goto(`/prototype/role?as=manager&next=%2F`);
  const taps = new Taps("Stage done with lump sum");
  await taps.tap(page.getByRole("link", { name: "Jobs", exact: true }).first());
  // The Jobs list holds the job twice (a phone row hidden from 1024 px, a table row shown there), so take the one on show,
  // and only on the Jobs screen: not the Home row that is still on screen while the page changes.
  await taps.tap(page.locator(`[data-screen="jobs"] a[href="/jobs/${meta.projects.harris}"]:visible`).first());
  await taps.tap(page.locator("[data-stage-row]").filter({ hasText: "Ridge bedding & pointing" }));
  await taps.tap(page.getByRole("link", { name: "Mark stage done", exact: true }));
  await expect(page.getByLabel("Sam's share", { exact: true })).toHaveValue("33.34");
  await taps.tap(page.getByRole("button", { name: "Confirm done", exact: true }));
  await expect(page.locator("[data-stage-controls]")).toHaveAttribute("data-status", "done");
  expect(taps.count).toBe(5);
  taps.assertWithin(5);
});

/** The spec keeps Mark stage done for managers: a foreman sees the stage but is stopped at the done page. */
test("Stage done as a foreman: no Mark stage done on the stage, and the done page says No access", async ({ page }) => {
  await page.goto(`/prototype/role?as=foreman&next=%2F`);
  await page.locator(`a[href="/jobs/${meta.projects.smith}"]`).first().click();
  await page.locator("[data-stage-row]").filter({ hasText: "Sheet install" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sheet install" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mark stage done", exact: true })).toHaveCount(0);
  await page.goto(`${page.url()}/done`);
  await expect(page.getByRole("heading", { level: 1, name: "No access" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm done", exact: true })).toHaveCount(0);
});
