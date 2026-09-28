import { expect, test } from "@playwright/test";
import { checkScreenHealthy, collectConsole, expectScreenHealthy } from "./guards";

/**
 * Self-test for guards.ts (docs/plans/03-design-prototype.md Task 4): a
 * deliberately broken fixture must fail every guard it violates, and a
 * fixed version of the same page must pass all of them. Runs on all three
 * Playwright projects (iphone/android/desktop) so the DOM/style math is
 * exercised on both WebKit and Chromium.
 */

const BAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Guards fixture (bad)</title>
<style>
  body { margin: 0; font-family: sans-serif; background: #ffffff; }
  /* Overflows any of the three viewports (390/412/1440), not just phone. */
  .too-wide { width: 150vw; height: 10px; background: #eeeeee; }
  .tiny-button { width: 40px; height: 40px; }
  .low-contrast { color: #999999; background: #ffffff; font-size: 16px; }
</style>
</head>
<body>
  <div class="too-wide">too wide for any viewport</div>
  <button type="button" class="tiny-button">Tap</button>
  <p class="low-contrast">Hard to read in full sun.</p>
  <script>console.error("boom: something broke");</script>
</body>
</html>`;

const GOOD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Guards fixture (good)</title>
<style>
  body {
    margin: 0;
    padding: 80px 24px;
    font-family: sans-serif;
    background: #ffffff;
    color: #2f3133;
  }
  button {
    display: block;
    width: 200px;
    height: 56px;
    font-size: 17px;
    color: #ffffff;
    background: #1f4fb5;
    border: none;
    border-radius: 10px;
  }
</style>
</head>
<body>
  <h1>Guards fixture</h1>
  <button type="button">Save day</button>
</body>
</html>`;

test.describe("expectScreenHealthy / checkScreenHealthy self-test", () => {
  test("a page with known violations fails the guards it violates", async ({ page }) => {
    const consoleCollector = collectConsole(page);
    await page.setContent(BAD_HTML);

    const results = await checkScreenHealthy(page, { phone: true, console: consoleCollector });
    const byName = new Map(results.map((r) => [r.name, r]));

    expect(byName.get("no-horizontal-overflow")?.ok).toBe(false);
    expect(byName.get("touch-targets")?.ok).toBe(false);
    expect(byName.get("dom-contrast")?.ok).toBe(false);
    expect(byName.get("console-clean")?.ok).toBe(false);

    // At least one failure message per violated guard, so the report is
    // actually useful (not just a pass/fail flag).
    expect(byName.get("touch-targets")?.failures.length).toBeGreaterThan(0);
    expect(byName.get("dom-contrast")?.failures.length).toBeGreaterThan(0);

    await expect(expectScreenHealthy(page, { phone: true, console: consoleCollector })).rejects.toThrow(
      /guard\(s\) failed/,
    );
  });

  test("the fixed page passes every guard", async ({ page }) => {
    const consoleCollector = collectConsole(page);
    await page.setContent(GOOD_HTML);

    const results = await checkScreenHealthy(page, { phone: true, console: consoleCollector });
    const failed = results.filter((r) => !r.ok);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);

    await expect(
      expectScreenHealthy(page, { phone: true, console: consoleCollector }),
    ).resolves.toBeUndefined();
  });

  test("touch-target check is skipped on desktop (phone: false)", async ({ page }) => {
    await page.setContent(BAD_HTML);
    const results = await checkScreenHealthy(page, { phone: false, skip: { console: true } });
    const touchTargets = results.find((r) => r.name === "touch-targets");
    expect(touchTargets?.ok).toBe(true);
    expect(touchTargets?.failures).toEqual([]);
  });
});
