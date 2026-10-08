import { expect, test } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const { meta } = getSeed();

/** flows.md "Pause for rain": from Home, job, stage, Pause, Weather is 4 taps; the stage then shows Paused, Weather. */
for (const role of ["manager", "foreman"]) {
  test(`Pause for rain as ${role}: job, stage, Pause stage, Weather is 4 taps`, async ({ page }) => {
    await page.goto(`/prototype/role?as=${role}&next=%2F`);
    const taps = new Taps("Pause for rain");
    await taps.tap(page.locator(`a[href="/jobs/${meta.projects.smith}"]`).first());
    await expect(page.getByRole("heading", { level: 1, name: /Smith/ })).toBeVisible();
    await taps.tap(page.locator("[data-stage-row]").filter({ hasText: "Sheet install" }));
    await expect(page.getByRole("heading", { level: 1, name: "Sheet install" })).toBeVisible();
    await expect(page.locator("[data-stage-controls]")).toHaveAttribute("data-status", "active");
    await taps.tap(page.getByRole("button", { name: "Pause stage", exact: true }));
    const sheet = page.getByRole("dialog", { name: "Pause stage" });
    await taps.tap(sheet.getByRole("button", { name: "Weather", exact: true }));
    await expect(sheet).toBeHidden();
    const controls = page.locator("[data-stage-controls]");
    await expect(controls).toHaveAttribute("data-status", "paused");
    await expect(controls.getByText("Paused", { exact: false }).first()).toBeVisible();
    await expect(controls.getByText("Weather")).toBeVisible();
    expect(taps.count).toBe(4);
    taps.assertWithin(4);
  });
}
