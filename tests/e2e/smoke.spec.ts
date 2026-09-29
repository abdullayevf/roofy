import { expect, test } from "@playwright/test";
import { runAxe } from "./axe";

test("home renders inside the shell with the product title and no serious a11y issues", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Roofy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
  const results = await runAxe(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious).toEqual([]);
});

test("both self-hosted fonts (Barlow Semi Condensed, Atkinson Hyperlegible Next) load", async ({ page }) => {
  await page.goto("/");

  // Read the actual family names next/font/local generated (--font-barlow,
  // --font-atkinson on <html>) rather than hard-coding a name, since the
  // exact generated identifier isn't part of the public contract.
  const families = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const firstFamily = (value: string) =>
      value
        .split(",")[0]
        ?.trim()
        .replace(/^["']|["']$/g, "") ?? "";
    return {
      barlow: firstFamily(style.getPropertyValue("--font-barlow")),
      atkinson: firstFamily(style.getPropertyValue("--font-atkinson")),
    };
  });
  expect(families.barlow.length).toBeGreaterThan(0);
  expect(families.atkinson.length).toBeGreaterThan(0);

  await page.evaluate(() => document.fonts.ready);

  const loaded = await page.evaluate(
    ([barlowFamily, atkinsonFamily]) => ({
      barlow: document.fonts.check(`600 20px "${barlowFamily}"`),
      atkinson: document.fonts.check(`400 16px "${atkinsonFamily}"`),
    }),
    [families.barlow, families.atkinson] as const,
  );
  expect(loaded.barlow).toBe(true);
  expect(loaded.atkinson).toBe(true);

  // The title uses font-display (Barlow SC) and the body copy uses the
  // font-body default (Atkinson); confirm the computed styles pick up the
  // families next/font generated, not a fallback.
  const heading = page.getByRole("heading", { level: 1 });
  const headingFamily = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(headingFamily).toContain(families.barlow);

  const bodyFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFamily).toContain(families.atkinson);
});

test("a .num element uses tabular figures", async ({ page }) => {
  await page.goto("/design");
  const money = page.locator(".num").first();
  await expect(money).toBeVisible();
  const variant = await money.evaluate((el) => getComputedStyle(el).fontVariantNumeric);
  expect(variant).toContain("tabular-nums");
});
