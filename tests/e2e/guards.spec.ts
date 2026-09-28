import { expect, test } from "@playwright/test";
import {
  checkAxe,
  checkKeyboard,
  checkSafeAreas,
  checkScreenHealthy,
  checkTextZoom,
  collectConsole,
  expectScreenHealthy,
} from "./guards";

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

// ---------------------------------------------------------------------------
// Per-guard failing fixtures: each isolates one guard's own violation so a
// failure here points straight at that guard, not at the general BAD_HTML
// grab-bag above.
// ---------------------------------------------------------------------------

const AXE_BAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Guards fixture (axe, bad)</title>
</head>
<body>
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
  <button type="button"></button>
</body>
</html>`;

const SAFE_AREA_BAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Guards fixture (safe area, bad)</title>
<style>
  body { margin: 0; }
  .top-fixed {
    position: fixed;
    top: 0;
    left: 0;
    width: 200px;
    height: 56px;
    background: #1f4fb5;
    color: #ffffff;
    border: none;
  }
</style>
</head>
<body>
  <button type="button" class="top-fixed">Too close to the notch</button>
</body>
</html>`;

// A literal fixed-px container (the real-world bug this reproduces: a
// hard-coded width that doesn't respect Dynamic Type / text zoom) holding
// rem-sized text. At the default 16px root it's narrower than the box; at
// 200% zoom (32px effective) it's roughly double the width and overflows
// both the box and the phone/tablet viewports. A 380px-wide box can never
// overflow the 1440px desktop viewport even doubled, so that project is
// skipped below — this reproduces a phone/tablet bug pattern, not a
// universal one (DESIGN.md's desktop breakpoint uses its own wider scale).
const TEXT_ZOOM_BAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Guards fixture (text zoom, bad)</title>
<style>
  html { font-size: 16px; }
  body { margin: 0; }
  .fixed-box {
    width: 380px;
    white-space: nowrap;
    font-family: monospace;
    font-size: 1rem;
  }
</style>
</head>
<body>
  <div class="fixed-box">${"m".repeat(37)}</div>
</body>
</html>`;

const KEYBOARD_BAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Guards fixture (keyboard, bad)</title>
<style>
  html { font-size: 16px; }
  body { margin: 0; padding: 24px; font-family: sans-serif; background: #ffffff; color: #2f3133; }
  input {
    display: block;
    width: 100%;
    height: 52px;
    font-size: 1rem;
    border: 1.5px solid #7d8580;
    border-radius: 10px;
    box-sizing: border-box;
  }
  .primary {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: 8px;
    height: 56px;
    background: #1f4fb5;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
  }
  /* Pinned above the home bar (DESIGN.md §4) — but here it covers the
     primary action once the keyboard's vertical space is gone. */
  .covering-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 80px;
    background: #2f3133;
    z-index: 5;
  }
</style>
</head>
<body>
  <label>Quantity
    <input type="text" />
  </label>
  <div class="covering-bar"></div>
  <button type="button" class="primary" data-primary-action>Save progress</button>
</body>
</html>`;

const KEYBOARD_GOOD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Guards fixture (keyboard, good)</title>
<style>
  html { font-size: 16px; }
  body { margin: 0; padding: 24px 24px 96px; font-family: sans-serif; background: #ffffff; color: #2f3133; }
  input {
    display: block;
    width: 100%;
    height: 52px;
    font-size: 1rem;
    border: 1.5px solid #7d8580;
    border-radius: 10px;
    box-sizing: border-box;
  }
  .primary {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: 8px;
    height: 56px;
    background: #1f4fb5;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
  }
</style>
</head>
<body>
  <label>Quantity
    <input type="text" />
  </label>
  <button type="button" class="primary" data-primary-action>Save progress</button>
</body>
</html>`;

test.describe("per-guard failing fixtures", () => {
  test("checkAxe fails on an unlabelled image and an unlabelled button", async ({ page }) => {
    await page.setContent(AXE_BAD_HTML);
    const result = await checkAxe(page);
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  test("checkSafeAreas fails on a fixed button pinned at top:0", async ({ page }) => {
    await page.setContent(SAFE_AREA_BAD_HTML);
    const result = await checkSafeAreas(page);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("top safe-area inset"))).toBe(true);
  });

  test("checkTextZoom fails when a fixed-width box's rem text overflows at 200%", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "desktop",
      "a 380px-wide box can't overflow the 1440px desktop viewport even doubled — this reproduces the phone/tablet bug pattern",
    );
    await page.setContent(TEXT_ZOOM_BAD_HTML);
    const result = await checkTextZoom(page);
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});

test.describe("checkKeyboard self-test", () => {
  test("fails when the primary action is covered once the keyboard opens", async ({ page }) => {
    await page.setContent(KEYBOARD_BAD_HTML);
    const result = await checkKeyboard(page, { phone: true });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("primary action"))).toBe(true);
    // The guard must restore the viewport it shrank.
    expect(page.viewportSize()).not.toBeNull();
  });

  test("passes when the input and primary action both stay reachable", async ({ page }) => {
    await page.setContent(KEYBOARD_GOOD_HTML);
    const before = page.viewportSize();
    const result = await checkKeyboard(page, { phone: true });
    expect(result.ok, JSON.stringify(result.failures)).toBe(true);
    expect(result.failures).toEqual([]);
    expect(page.viewportSize()).toEqual(before);
  });

  test("is skipped on desktop (phone: false) and when there's no text input", async ({ page }) => {
    await page.setContent(KEYBOARD_BAD_HTML);
    const desktopResult = await checkKeyboard(page, { phone: false });
    expect(desktopResult.ok).toBe(true);

    await page.setContent("<!doctype html><html><body><button>No input here</button></body></html>");
    const noInputResult = await checkKeyboard(page, { phone: true });
    expect(noInputResult.ok).toBe(true);
  });
});
