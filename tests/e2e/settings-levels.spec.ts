import { expect, test, type Page } from "@playwright/test";
import { checkErrorLineInView, checkPinnedBarMatchesColumn } from "./guards";

/** Open a page and wait for React to attach to its boxes: a fill made before then shows but never reaches the form's state. */
async function go(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
  await page.waitForFunction(() => {
    const controls = [...document.querySelectorAll("main input:not([type=radio]):not([type=checkbox]):not([type=hidden]), main select")];
    return controls.every((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$")));
  });
}

// Entry-settings iteration 2, run 2a: the levels page and the pinned Save bar. The tablet and desktop checks resize one
// browser, so they run on the desktop project only.
const PINNED = ["/settings/levels", "/settings/pay-period", "/settings/templates?type=metal_reroof", "/settings/assignments"];

test.describe("pinned Save bar (entry-settings i2 D25)", () => {
  for (const [label, width, height] of [
    ["tablet", 768, 1024],
    ["narrow tablet", 620, 900],
    ["desktop", 1440, 900],
  ] as const)
    for (const path of PINNED)
      test(`${path} at ${label}: the bar is exactly the form column's width and centred with it`, async ({ page }, info) => {
        test.skip(info.project.name !== "desktop", "resizes one browser; the desktop project runs it");
        await page.setViewportSize({ width, height });
        await go(page, "owner", path);
        await expect(page.locator('[data-slot="primary-action"]:visible')).toHaveCount(1);
        const result = await checkPinnedBarMatchesColumn(page);
        expect(result.failures).toEqual([]);
      });
});

test.describe("levels (entry-settings i2 D8, F2, D26, D27, F17)", () => {
  test("a refused save puts the line in the bar, in the first viewport, and focuses the bad field", async ({ page }) => {
    await go(page, "owner", "/settings/levels");
    await page.getByLabel("Floor rate for Roofer").fill("0.00");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.locator('[data-slot="primary-action"]').getByText("Add a floor rate for Roofer.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Floor rate for Roofer")).toBeFocused();
    expect((await checkErrorLineInView(page)).failures).toEqual([]);
  });

  test("pay period: a refused save also puts one line in the bar", async ({ page }) => {
    await go(page, "owner", "/settings/pay-period");
    await page.getByLabel("Standard day").fill("0");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.locator('[data-slot="primary-action"]').getByText("Fix the standard day before saving.", { exact: true })).toBeVisible();
    expect((await checkErrorLineInView(page)).failures).toEqual([]);
  });

  test("the rate reads as an hourly rate and the crew count has no '0 crew'", async ({ page }) => {
    await go(page, "owner", "/settings/levels");
    await expect(page.getByText("an hour", { exact: true }).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText("An hour.");
    await expect(page.locator("main")).not.toContainText(/(^|\s)0\s*crew on this level/);
  });

  for (const [label, width, height] of [
    ["tablet", 768, 1024],
    ["desktop", 1440, 900],
  ] as const)
    test(`at ${label} a level is a row: name left, a narrow right-aligned rate, in a 1 px edge outline`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "resizes one browser; the desktop project runs it");
      await page.setViewportSize({ width, height });
      await go(page, "owner", "/settings/levels");
      const input = page.getByLabel("Floor rate for Roofer");
      const box = (await input.boundingBox())!;
      const form = (await page.locator("form.pin-pad").boundingBox())!;
      expect(box.width, "a narrow rate box, not a stacked full-width one").toBeLessThan(300);
      expect(box.x + box.width, "right-aligned in the row").toBeGreaterThan(form.x + form.width - 24);
      const name = (await page.getByText("Roofer", { exact: true }).first().boundingBox())!;
      expect(name.x, "the name is on the left").toBeLessThan(form.x + 24);
      expect(name.y + name.height / 2, "the name and the rate share a row").toBeLessThan(box.y + box.height);
      const outline = await page.locator("form.pin-pad > div").first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return { width: cs.borderTopWidth, style: cs.borderTopStyle };
      });
      expect(outline, "the list has the 1 px edge outline of every level-1 group").toEqual({ width: "1px", style: "solid" });
      const rows = await page.locator("form.pin-pad > div > *").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(Math.min(...rows), "rows are at least 48 px").toBeGreaterThanOrEqual(48);
      expect(Math.max(...rows), "and not the old 67 px").toBeLessThanOrEqual(60);
    });
});
