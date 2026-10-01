import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { getSeed } from "../../src/data/fake/store";
import { expectNoMoney } from "./money-scan";

const { meta } = getSeed();

const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/log/progress") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const chip = (page: Page, name: RegExp | string) => page.getByRole("button", { name });

test.describe("Progress entry", () => {
  test("opens on today with recent stages as chips, the keypad field and Save progress off", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Progress" })).toBeChecked();
    await expect(page.getByText("Today, Mon 28 Sep")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Recent stages" })).toBeVisible();
    await expect(page.getByLabel("Quantity done")).toHaveAttribute("inputmode", "decimal");
    await expect(page.getByRole("button", { name: "Save progress" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Choose another stage" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("choosing a recent stage shows how far along it is: 120 of 400 m² on the tape", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first().click();
    await expect(page.getByText("120 of 400 m²")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  });

  test("the unit stays blank until a stage is chosen, and the tape previews the total once a quantity is typed", async ({ page }) => {
    await signInAs(page, "manager");
    await expect(page.getByText("m²", { exact: true })).toHaveCount(0);
    await page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first().click();
    await expect(page.getByText("m²", { exact: true })).toBeVisible();
    await page.getByLabel("Quantity done").fill("120");
    await expect(page.getByText("240 of 400 m² after this")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  });

  test("the disabled Save names only what is missing", async ({ page }) => {
    await signInAs(page, "manager");
    const bar = page.locator('[data-slot="primary-action"]');
    await expect(bar).toContainText("Choose a stage, type how much was done and tick at least one person.");
    await page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first().click();
    await expect(bar).toContainText("Type how much was done and tick at least one person.");
    await page.getByLabel("Quantity done").fill("120");
    await expect(bar).toContainText("Tick at least one person.");
  });

  test("the crew order is fixed once the job is chosen: ticking people does not move rows", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first().click();
    const names = () => page.locator('[data-screen="log-progress"] button[aria-pressed]').allInnerTexts();
    const before = await names();
    await chip(page, /^Sam\b/).click();
    await chip(page, /^Dima\b/).click();
    expect(await names()).toEqual(before);
  });

  test("120 m² split equally between two people shows 60 m² each and saves; the tape moves to 60%", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first().click();
    await page.getByLabel("Quantity done").fill("120");
    await chip(page, /^Sam\b/).click();
    await chip(page, /^Dima\b/).click();
    await expect(page.getByText("60 m²", { exact: true })).toHaveCount(2);
    await page.getByRole("button", { name: "Save progress" }).click();
    const status = page.getByRole("status").filter({ hasText: "Logged" });
    await expect(status).toContainText("120 m² on Sheet install, Sam and Dima");
    await expect(status.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    await expect(status).toContainText("now at 240 m² (60%)");
    await expect(page.getByTestId("chalk-line")).toHaveClass(/w-full/);
    await page.getByRole("button", { name: "Log more progress" }).click();
    await expect(page.getByLabel("Quantity done")).toHaveValue("");
    await expect(page.getByText("240 of 400 m²")).toBeVisible();
  });

  test("a custom split must add up to 100%, and says what it adds up to now", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first().click();
    await page.getByLabel("Quantity done").fill("120");
    await chip(page, /^Sam\b/).click();
    await chip(page, /^Dima\b/).click();
    await page.getByRole("radio", { name: "Custom split" }).click();
    await expect(page.getByLabel("Sam's share")).toHaveValue("50");
    await page.getByLabel("Sam's share").fill("60");
    await page.getByLabel("Dima's share").fill("32");
    await expect(page.getByText("Shares must add up to 100%. Currently 92%.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save progress" })).toBeDisabled();
    // The bar's line states it, and both share boxes take the `over` border.
    await expect(page.locator('[data-slot="primary-action"]')).toContainText("Shares must add up to 100%. Currently 92%.");
    await expect(page.getByLabel("Sam's share")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Dima's share")).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("Dima's share").fill("40");
    await expect(page.getByText("Shares must add up to 100%.")).toHaveCount(0);
    await expect(page.getByText("72 m²", { exact: true })).toBeVisible();
    await expect(page.getByText("48 m²", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save progress" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
  });

  test("the crew rows show names only: pay type belongs to the crew-day grid", async ({ page }) => {
    await signInAs(page, "manager");
    const list = page.getByRole("button", { name: /^Sam\b/ });
    await expect(list).toBeVisible();
    await expect(page.getByText(/^(Day|Hourly|Hours only)$/)).toHaveCount(0);
  });

  test("an address with the day, stage, quantity, crew and shares opens the form filled in and sends that day", async ({ page }) => {
    const { sam, dima } = meta.crew;
    await signInAs(page, "manager", `/log/progress?date=2026-09-27&stage=${meta.stages.smithSheetInstall}&qty=12000&crew=${sam},${dima}&shares=6000,4000`);
    await expect(page.getByText("Yesterday, Sun 27 Sep")).toBeVisible();
    await expect(page.getByLabel("Quantity done")).toHaveValue("120");
    await expect(page.getByRole("button", { name: /^Sam\b/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: "Custom split" })).toBeChecked();
    await expect(page.getByLabel("Sam's share")).toHaveValue("60");
    await expect(page.getByLabel("Dima's share")).toHaveValue("40");
    const push = page.waitForRequest((r) => r.url().endsWith("/api/sync/push"));
    await page.getByRole("button", { name: "Save progress" }).click();
    expect((await push).postData()).toContain('"date":"2026-09-27"');
  });

  test("an address with a date that is not a date falls back to today", async ({ page }) => {
    await signInAs(page, "manager", "/log/progress?date=2026-02-30");
    await expect(page.getByText("Today, Mon 28 Sep")).toBeVisible();
  });

  test("with the keyboard up the Save progress bar sits on the visible screen, not mid-page", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the on-screen keyboard is a phone thing");
    await signInAs(page, "manager");
    await page.getByLabel("Quantity done").focus();
    const bar = page.locator('[data-slot="primary-action"]');
    await expect(bar).toHaveAttribute("data-keyboard", "true");
    const box = (await bar.boundingBox())!;
    const height = page.viewportSize()!.height;
    expect(Math.abs(box.y + box.height - height)).toBeLessThanOrEqual(1);
  });

  test("a quantity that is not a number says how to fix it", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByLabel("Quantity done").fill("abc");
    await expect(page.getByText("Type a number, like 120 or 12.5.")).toBeVisible();
  });

  test("another stage can be chosen from the job and stage lists", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: "Choose another stage" }).click();
    await expect(page.getByLabel("Stage", { exact: true })).toBeDisabled();
    await page.getByLabel("Job", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Stage", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Quantity done").fill("10");
    await chip(page, /^Sam\b/).click();
    await expect(page.getByRole("button", { name: "Save progress" })).toBeEnabled();
  });

  test("a foreman sees quantities and percentages, never money", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await page.getByRole("radiogroup", { name: "Recent stages" }).getByRole("radio", { name: /Sheet install/ }).first().click();
    await page.getByLabel("Quantity done").fill("120");
    await chip(page, /^Sam\b/).click();
    await chip(page, /^Dima\b/).click();
    await expect(page.getByText("60 m²", { exact: true })).toHaveCount(2);
    await page.getByRole("button", { name: "Save progress" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/\$\d|\brate\b/i);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { keyboard: true } });
    await expectNoMoney(page, ["/log/progress", "/log/progress?demo=empty", "/log/progress?demo=loading", "/log/progress?demo=offline", "/log/progress?demo=waiting", "/log/progress?demo=attention", "/log/progress?demo=noperm"]);
  });

  test("?demo=loading shows the skeleton", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/log/progress?demo=loading");
    await expect(page.locator('[data-screen="log-progress"][aria-busy="true"]')).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=empty tells a manager to add a job, and a foreman to wait to be added", async ({ page }) => {
    await signInAs(page, "manager", "/log/progress?demo=empty");
    await expect(page.getByText("No jobs to measure yet. Add your first job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your first job" })).toBeVisible();
    await signInAs(page, "foreman", "/log/progress?demo=empty");
    await expect(page.getByText("You can log once a manager adds you to a job.")).toBeVisible();
    await expect(page.getByRole("link")).not.toContainText(["Add your first job"]);
  });

  test("?demo=error keeps the title and switch and says so in the form area; ?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/log/progress?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Progress" })).toBeChecked();
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByText("Check your signal")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await signInAs(page, "manager", "/log/progress?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });

  test("?demo=offline shows the banner and a save is kept on the phone", async ({ page }) => {
    await signInAs(page, "manager", "/log/progress?demo=offline");
    await expect(page.getByText("No signal — entries are saved on this device and will send automatically.")).toBeVisible();
  });

  test("the accountant cannot open it", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
