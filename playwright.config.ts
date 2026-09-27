import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } } },
    { name: "android", use: { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
