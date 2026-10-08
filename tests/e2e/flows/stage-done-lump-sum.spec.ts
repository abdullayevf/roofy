import { expect, test } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const { meta } = getSeed();

/** flows.md "Stage done with lump sum": Home, Jobs, Harris job, ridge stage, Mark stage done, Confirm done is 5 taps. */
test("Stage done with lump sum as manager: 5 taps, the stage is then Done", async ({ page }) => {
  await page.goto(`/prototype/role?as=manager&next=%2F`);
  const taps = new Taps("Stage done with lump sum");
  await taps.tap(page.getByRole("link", { name: "Jobs", exact: true }).first());
  await taps.tap(page.locator(`a[href="/jobs/${meta.projects.harris}"]`).first());
  await taps.tap(page.locator("[data-stage-row]").filter({ hasText: "Ridge bedding & pointing" }));
  await taps.tap(page.getByRole("link", { name: "Mark stage done", exact: true }));
  await expect(page.getByLabel("Sam's share", { exact: true })).toHaveValue("33.34");
  await taps.tap(page.getByRole("button", { name: "Confirm done", exact: true }));
  await expect(page.locator("[data-stage-controls]")).toHaveAttribute("data-status", "done");
  expect(taps.count).toBe(5);
  taps.assertWithin(5);
});
