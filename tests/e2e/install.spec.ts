import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, collectConsole, expectScreenHealthy } from "./guards";

const isPhone = (name: string) => name !== "desktop";

async function open(page: Page, role: string, path: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(path)}`);
}

const stepsHeading = (page: Page, title: RegExp) => page.getByRole("heading", { level: 2, name: title });

test.describe("Install guide (screen 3)", () => {
  test("this device's steps come first and the other devices sit behind a disclosure", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, "owner", "/install");
    await expect(page.getByRole("heading", { level: 1, name: "Install guide" })).toBeVisible();
    const own = { iphone: /iPhone or iPad/, android: /Android/, desktop: /computer/ }[testInfo.project.name as "iphone" | "android" | "desktop"];
    await expect(stepsHeading(page, own)).toBeVisible();
    const details = page.locator("details");
    await expect(details).not.toHaveAttribute("open", "");
    await details.getByText("Steps for other devices").click();
    await expect(details.getByRole("heading", { level: 2 })).toHaveCount(2);
    if (isPhone(testInfo.project.name)) expect((await checkBackRow(page)).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  for (const [platform, title, first] of [
    ["ios", /iPhone or iPad/, "Open Roofy in Safari."],
    ["android", /Android/, "Open Roofy in Chrome."],
    ["desktop", /computer/, "Open Roofy in Chrome or Edge."],
  ] as const) {
    test(`?platform=${platform} shows that device's steps first`, async ({ page }, testInfo) => {
      await open(page, "owner", `/install?platform=${platform}`);
      await expect(stepsHeading(page, title).first()).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: first }).first()).toBeVisible();
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    });
  }

  test("the steps box is one column of readable lines, with the other devices' link under it", async ({ page }) => {
    await open(page, "owner", "/install?platform=android");
    const steps = (await page.getByRole("list").first().boundingBox())!;
    const link = (await page.getByText("Steps for other devices").boundingBox())!;
    expect(steps.width).toBeLessThanOrEqual(700);
    expect(link.y).toBeGreaterThan(steps.y + steps.height);
    expect(link.x - steps.x).toBeLessThanOrEqual(1);
    expect((await page.getByText("Put Roofy on your home screen").boundingBox())!.width).toBeLessThanOrEqual(700);
  });

  test("opened from the home screen it says Roofy is installed, with one button to Home", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await open(page, "owner", "/install?installed=1");
    await expect(page.getByRole("heading", { level: 1, name: "Roofy is installed" })).toBeVisible();
    await expect(page.locator("details")).toHaveCount(0);
    const home = page.getByRole("link", { name: "Go to Home" });
    await expect(home).toHaveAttribute("href", "/");
    // Full width of the guide's column, not a small left-aligned button.
    const [box, intro] = [(await home.boundingBox())!, (await page.getByText("You are using Roofy").boundingBox())!];
    expect(box.width).toBeGreaterThanOrEqual(intro.width - 1);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a foreman and an accountant can read it too", async ({ page }, testInfo) => {
    for (const role of ["foreman", "accountant"]) {
      await open(page, role, "/install");
      await expect(page.getByRole("heading", { level: 1, name: "Install guide" })).toBeVisible();
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("?demo=error keeps the back row and title, says so once and logs nothing to the console", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    for (const role of ["owner", "manager", "foreman", "accountant"]) {
      await open(page, role, "/install?demo=error");
      await expect(page.getByRole("heading", { level: 1, name: "Install guide" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to More" })).toHaveAttribute("href", "/more");
      await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    }
    // A thrown error would log a 500 and React error 441 here; the page draws its own error instead.
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });
});
