import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "No-work marker": from Home, at most 5 taps. */
for (const role of ["manager", "foreman"]) {
  test(`No-work marker as ${role}: Log, No work, Jake, Rain, Save is 5 taps`, async ({ page }) => {
    await page.goto(`/prototype/role?as=${role}&next=%2F`);
    const taps = new Taps("No-work marker");
    await taps.tap(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log" }));
    await taps.tap(page.getByRole("radio", { name: "No work" }));
    // "Today, Mon 28 Sep" is on the crew-day page too, so wait for the no-work page itself: a tap on Jake made before
    // the switch lands on the old page and is lost when the new one replaces it.
    await expect(page).toHaveURL(/\/log\/no-work/);
    await expect(page.getByRole("heading", { name: "Why" })).toBeVisible();
    await expect(page.getByText("Today, Mon 28 Sep")).toBeVisible();
    await page.waitForLoadState("networkidle"); // the page is interactive before the first tap
    await taps.tap(page.getByRole("button", { name: /^Jake\b/ }));
    await taps.tap(page.getByRole("radio", { name: "Rain" }));
    await taps.tap(page.getByRole("button", { name: "Save no work", exact: true }));
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toContainText("Jake marked as rain");
    expect(taps.count).toBe(5);
    taps.assertWithin(5);
  });
}
