/**
 * Installability and installed-app checks (Task 22, DESIGN.md section 8). Two projects run this file: `visual-pwa`
 * (Chromium, 412 wide) and `visual-pwa-iphone` (WebKit, 390 wide, or Chromium with ROOFY_NO_WEBKIT=1). The installability
 * check needs the DevTools protocol (`Page.getInstallabilityErrors`) in a Chromium of its own (see
 * `installabilityErrors`), so it runs under Chromium only; WebKit has no installability API. The manifest, icon and standalone tests run on both: standalone is simulated by wrapping
 * `matchMedia` (see `emulateStandalone`), which works in any engine.
 * Run with `--output=<private dir>` when another run shares the checkout: parallel runs clear test-results/.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { checkSafeAreas, waitForHydrated } from "../e2e/guards";

type Icon = { src: string; sizes: string; type: string; purpose?: string };

test.describe("installable app", () => {
  test("Chromium finds nothing that stops the app being installed", async ({ baseURL, browserName }) => {
    test.skip(browserName !== "chromium", "installability errors come from Chromium's DevTools protocol; WebKit has none");
    expect(await installabilityErrors(baseURL!)).toEqual([]);
  });

  // Without this, a check that can never fail would pass for ever: see installabilityErrors for the two ways it can.
  test("the installability check does report a manifest that cannot be installed", async ({ baseURL, browserName }) => {
    test.skip(browserName !== "chromium", "installability errors come from Chromium's DevTools protocol; WebKit has none");
    const errors = await installabilityErrors(baseURL!, { manifest: { name: "Roofy" } });
    expect(errors).toEqual(expect.arrayContaining(["start-url-not-valid", "no-acceptable-icon"]));
  });

  test("the manifest names the app and its 192, 512 and maskable icons load at their declared size", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest).toMatchObject({ name: "Roofy", short_name: "Roofy", display: "standalone", start_url: "/" });

    const icons = manifest.icons as Icon[];
    const find = (sizes: string, purpose: string) => icons.find((i) => i.sizes === sizes && (i.purpose ?? "any") === purpose);
    for (const [sizes, purpose] of [["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]] as const) {
      const icon = find(sizes, purpose);
      expect(icon, `${sizes} ${purpose} icon`).toBeDefined();
      const png = await request.get(icon!.src);
      expect(png.status(), icon!.src).toBe(200);
      expect(png.headers()["content-type"]).toBe("image/png");
      // A PNG's width and height are the two big-endian 32-bit numbers right after its 8-byte signature and "IHDR".
      const bytes = await png.body();
      const [w, h] = sizes.split("x").map(Number);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], `${icon!.src} pixel size`).toEqual([w, h]);
    }
  });

  test("installed (standalone) Home keeps its content clear of the status bar and home bar", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "roofy_role", value: "manager", url: baseURL! }]);
    await emulateStandalone(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForHydrated(page);
    expect(await page.evaluate(() => matchMedia("(display-mode: standalone)").matches), "standalone is emulated").toBe(true);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

    // The simulated iPhone insets (47 px top, 34 px bottom): no control sits under either, at the top or the end.
    const safe = await checkSafeAreas(page);
    expect(safe.failures, "controls under an inset").toEqual([]);
    // The page title is not a control, but it must still start below the status bar.
    const title = await page.getByRole("heading", { level: 1, name: "Home" }).boundingBox();
    expect(title!.y, "page title top").toBeGreaterThanOrEqual(47);
  });

  test("opened from the home screen, the install guide says Roofy is installed (the app reads the display mode)", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "roofy_role", value: "owner", url: baseURL! }]);
    await emulateStandalone(page);
    await page.goto("/install", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Roofy is installed" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();
  });
});

/**
 * Chromium's installability errors for the home page, by error id (`[]` = installable). Run in a persistent, new-headless
 * Chromium (`channel: "chromium"`) because the other launches cannot answer: the headless shell Playwright uses by
 * default always returns `[]`, and a normal Playwright context (incognito) always returns `["in-incognito"]`; either
 * would make the check pass or fail whatever the manifest says. `manifest` swaps in a different manifest document to
 * prove the check can fail. Set ROOFY_CHROMIUM_EXECUTABLE to a full (not headless-shell) Chromium to use another build.
 */
async function installabilityErrors(baseURL: string, opts: { manifest?: object } = {}): Promise<string[]> {
  const executablePath = process.env.ROOFY_CHROMIUM_EXECUTABLE;
  const dir = await mkdtemp(join(tmpdir(), "roofy-installable-"));
  const context = await chromium.launchPersistentContext(dir, {
    headless: true,
    ...(executablePath ? { executablePath } : { channel: "chromium" }),
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const client = await context.newCDPSession(page);
    await client.send("Page.enable");
    if (opts.manifest) {
      await page.route("**/manifest.webmanifest", (route) =>
        route.fulfill({ contentType: "application/manifest+json", body: JSON.stringify(opts.manifest) }),
      );
    }
    await page.goto(new URL("/", baseURL).toString(), { waitUntil: "networkidle" });
    // Chromium evaluates installability a moment after the manifest is parsed and has no event to wait for; the
    // broken-manifest test above shows this wait is long enough for the answer to arrive.
    await page.waitForTimeout(3000);
    const { installabilityErrors } = await client.send("Page.getInstallabilityErrors");
    return installabilityErrors.map((e) => e.errorId);
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Makes the page report `display-mode: standalone`, as it does when opened from the home screen. The usual route,
 * `Emulation.setEmulatedMedia` with a display-mode feature, is accepted by Chromium but changes nothing (the page still
 * matches `browser`), so the script wraps `matchMedia` for that one query before any page script runs. The app's only
 * display-mode reader is the install guide (`isStandalone`), which goes through `matchMedia`.
 */
async function emulateStandalone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const list = real(query);
      if (!/\(display-mode:\s*standalone\)/.test(query)) return list;
      return new Proxy(list, {
        get(target, prop) {
          if (prop === "matches") return true;
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    };
  });
}
