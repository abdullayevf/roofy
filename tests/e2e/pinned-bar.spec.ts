import { expect, test, type Page } from "@playwright/test";

/**
 * The pinned Save bar below 1024 px: one fixed bar flush on the tab bar, the same at every scroll position, as wide as the
 * content column; nothing of the form sits under it or under the raised Log circle at rest.
 */
const SCREENS = [
  { name: "Log crew-day", path: "/log" },
  { name: "Progress", path: "/log/progress" },
  { name: "No work", path: "/log/no-work" },
];
const SIZES = [
  { name: "phone", width: 390, height: 780 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "landscape", width: 844, height: 390 },
];

async function boxes(page: Page) {
  const bar = (await page.locator('[data-slot="primary-action"]').boundingBox())!;
  const tabs = (await page.getByRole("navigation", { name: "Primary" }).boundingBox())!;
  const circle = (await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log" }).locator("span.rounded-full").boundingBox())!;
  return { bar, tabs, circle };
}

for (const screen of SCREENS) {
  test(`${screen.name} on its side: one row of about 68 px, the button clear of the raised Log circle, and most of the screen left for the form`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "below 1024 px only");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`/prototype/role?as=manager&next=${encodeURIComponent(screen.path)}`);
    await page.waitForLoadState("networkidle");
    const { bar, tabs, circle } = await boxes(page);
    expect(bar.height).toBeLessThanOrEqual(70);
    expect(bar.height).toBeGreaterThanOrEqual(60);
    // The bar and the tab bar together take well under half the screen (they took 45% before).
    expect(bar.height + tabs.height).toBeLessThan(390 * 0.4);
    expect(await page.locator('[data-slot="primary-action"]').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    );
    const button = (await page.locator('[data-slot="primary-action"] button').first().boundingBox())!;
    expect(button.height).toBeGreaterThanOrEqual(48);
    const clear = button.x >= circle.x + circle.width || button.x + button.width <= circle.x;
    expect(clear).toBe(true);
    // The form scrolls above the bar to its last control.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = await page.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>("main button, main input, main select")].filter((el) => !el.closest('[data-slot="primary-action"]'));
      return Math.max(...els.map((el) => el.getBoundingClientRect().bottom));
    });
    expect(last).toBeLessThanOrEqual(bar.y + 1);
  });


  for (const size of SIZES) {
    test(`${screen.name} at ${size.name}: the bar is flush on the tab bar at the top and the end of the page, and nothing sits under it`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "desktop", "below 1024 px only");
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`/prototype/role?as=manager&next=${encodeURIComponent(screen.path)}`);
      await page.waitForLoadState("networkidle");
      const top = await boxes(page);
      expect(Math.abs(top.bar.y + top.bar.height - top.tabs.y)).toBeLessThanOrEqual(1);
      // On its side the bar is one row across the whole screen; otherwise it is as wide as the content column.
      const columnWidth = size.name === "landscape" ? size.width : Math.min(size.width, 600);
      expect(Math.abs(top.bar.width - columnWidth)).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const end = await boxes(page);
      expect(Math.abs(end.bar.y - top.bar.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(end.bar.y + end.bar.height - end.tabs.y)).toBeLessThanOrEqual(1);
      // At the end of the page no control of the form sits under the bar or the Log circle.
      const hits = await page.evaluate(
        ({ bar, circle }) => {
          const overlaps = (r: DOMRect, b: { x: number; y: number; width: number; height: number }) =>
            r.left < b.x + b.width && r.right > b.x && r.top < b.y + b.height && r.bottom > b.y;
          return [...document.querySelectorAll<HTMLElement>("main button, main input, main select, main a")]
            .filter((el) => !el.closest('[data-slot="primary-action"]'))
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && r.height > 0 && (overlaps(r, bar) || overlaps(r, circle)))
            .map(({ el }) => el.textContent?.trim().slice(0, 30) ?? "");
        },
        { bar: end.bar, circle: end.circle },
      );
      expect(hits).toEqual([]);
    });
  }
}
