import { defineConfig, devices } from "@playwright/test";

const noWebkit = process.env.ROOFY_NO_WEBKIT === "1";

// Opt-in escape hatch for a container whose cached Chromium build doesn't match
// the revision this Playwright version expects (and downloading a new one isn't
// possible): point at the browser binary that is actually installed.
const chromiumExecutable = process.env.ROOFY_CHROMIUM_EXECUTABLE;
const chromiumLaunchOptions = chromiumExecutable ? { executablePath: chromiumExecutable } : undefined;

// Containers without WebKit installed (no download available) opt in to running
// the "iphone" project on Chromium instead, keeping the iPhone 14 device shape:
// viewport, isMobile, hasTouch, deviceScaleFactor and user agent.
const iphone = noWebkit
  ? {
      ...devices["Desktop Chrome"],
      userAgent: devices["iPhone 14"].userAgent,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: devices["iPhone 14"].deviceScaleFactor,
      isMobile: devices["iPhone 14"].isMobile,
      hasTouch: devices["iPhone 14"].hasTouch,
      launchOptions: chromiumLaunchOptions,
    }
  : { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "iphone", use: iphone },
    {
      name: "android",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 412, height: 915 },
        launchOptions: chromiumLaunchOptions,
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: chromiumLaunchOptions,
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3100",
    // Off by default so a stale server is never reused silently; opt in explicitly.
    reuseExistingServer: process.env.ROOFY_REUSE_SERVER === "1",
    timeout: 240_000,
    env: { ROOFY_DATA: "fake" },
  },
});
