import { expect, test } from "@playwright/test";
import { Taps } from "./taps";

test.describe("tap counter", () => {
  test("Same as yesterday from Home is 3 taps: Log, Same as yesterday, Save day", async ({ page }) => {
    await page.goto("/prototype/role?as=manager&next=%2F");
    const taps = new Taps("Same as yesterday");
    await taps.tap(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log" }));
    await taps.tap(page.getByRole("button", { name: "Same as yesterday" }));
    await taps.tap(page.getByRole("button", { name: "Save day" }));
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
    expect(taps.count).toBe(3);
    taps.assertWithin(3);
  });

  test("a foreman's Log today is one tap from Home", async ({ page }) => {
    await page.goto("/prototype/role?as=foreman&next=%2F");
    const taps = new Taps("Open Log");
    await taps.tap(page.getByRole("link", { name: "Log today" }));
    await expect(page).toHaveURL(/\/log/);
    taps.assertWithin(1);
  });

  test("assertWithin fails when the budget is exceeded and names the taps", async ({ page }) => {
    await page.setContent("<button>One</button><button>Two</button>");
    const taps = new Taps("Two buttons");
    await taps.tap(page.getByRole("button", { name: "One" }));
    await taps.tap(page.getByRole("button", { name: "Two" }));
    expect(() => taps.assertWithin(1)).toThrow(/"Two buttons" took 2 taps; the budget is 1\./);
    expect(() => taps.assertWithin(2)).not.toThrow();
  });
});
