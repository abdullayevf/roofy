import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { getSeed } from "../../src/data/fake/store";
import { expectNoMoney } from "./money-scan";

const { meta } = getSeed();

const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/log/no-work") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("No-work marker", () => {
  test("opens on today with nobody chosen and Save off", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("radio", { name: "No work" })).toBeChecked();
    await expect(page.getByLabel("Date")).toHaveValue("today");
    await expect(page.getByLabel("Date").locator("option:checked")).toHaveText("Today, Mon 28 Sep");
    await expect(page.getByRole("radio", { name: "Yesterday" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(page.getByText("Choose who didn't work and why.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Why comes above Who didn't work, and the date is one control", async ({ page }) => {
    await signInAs(page, "manager");
    const why = await page.getByRole("heading", { level: 2, name: "Why" }).boundingBox();
    const who = await page.getByRole("heading", { level: 2, name: "Who didn't work" }).boundingBox();
    expect(why!.y).toBeLessThan(who!.y);
    await expect(page.getByLabel("Note (optional)")).toBeVisible();
    await expect(page.getByText("Optional", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^(Day|Hourly|Hours only)$/)).toHaveCount(0);
  });

  test("an address with the day, people, reason and note opens the form filled in and sends that day", async ({ page }) => {
    await signInAs(page, "manager", `/log/no-work?date=2026-09-27&crew=${meta.crew.jake}&reason=sick&note=Site+flooded`);
    await expect(page.getByLabel("Date").locator("option:checked")).toHaveText("Yesterday, Sun 27 Sep");
    await expect(page.getByRole("button", { name: /^Jake\b/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: "Sick" })).toBeChecked();
    await expect(page.getByLabel("Note (optional)")).toHaveValue("Site flooded");
    const push = page.waitForRequest((r) => r.url().endsWith("/api/sync/push"));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const body = (await push).postData() ?? "";
    expect(body).toContain('"date":"2026-09-27"');
    expect(body).toContain('"note":"Site flooded"');
  });

  test("marks Jake as rain and says so", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: /^Jake\b/ }).click();
    await page.getByRole("radio", { name: "Rain" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toContainText("Jake marked as rain on Mon 28 Sep");
    await expect(page.getByTestId("chalk-line")).toHaveClass(/w-full/);
    await page.getByRole("button", { name: "Mark someone else" }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  });

  test("Yesterday moves the day and keeps who and why", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: /^Jake\b/ }).click();
    await page.getByRole("radio", { name: "Sick" }).click();
    await page.getByLabel("Note (optional)").fill("Site flooded");
    await page.getByLabel("Date").selectOption("yesterday");
    await expect(page.getByLabel("Date").locator("option:checked")).toHaveText("Yesterday, Sun 27 Sep");
    await expect(page.getByLabel("Note (optional)")).toHaveValue("Site flooded");
    await expect(page.getByRole("button", { name: /^Jake\b/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: "Sick" })).toBeChecked();
  });

  test("someone who already has a log that day cannot be marked", async ({ page }) => {
    await signInAs(page, "manager", "/log");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await page.getByRole("button", { name: "Save day" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
    await page.goto("/log/no-work");
    const sam = page.getByRole("button", { name: /^Sam\b/ });
    await expect(sam).toBeDisabled();
    await expect(page.getByText("Sam already has a log today. Remove it first to mark no work.")).toBeVisible();
  });

  test("a foreman sees the same screen with no money", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await page.getByRole("button", { name: /^Jake\b/ }).click();
    await page.getByRole("radio", { name: "Rain" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { keyboard: true } });
    await expectNoMoney(page, ["/log/no-work", "/log/no-work?demo=empty", "/log/no-work?demo=loading", "/log/no-work?demo=offline", "/log/no-work?demo=waiting", "/log/no-work?demo=noperm"]);
  });

  test("?demo=loading shows the skeleton", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/log/no-work?demo=loading");
    await expect(page.locator('[data-screen="log-no-work"][aria-busy="true"]')).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=empty tells a manager to add crew, and a foreman to wait to be added", async ({ page }) => {
    await signInAs(page, "manager", "/log/no-work?demo=empty");
    await expect(page.getByText("No crew yet. Add your first crew member.")).toBeVisible();
    await signInAs(page, "foreman", "/log/no-work?demo=empty");
    await expect(page.getByText("You can log once a manager adds you to a job.")).toBeVisible();
  });

  test("?demo=error keeps the title and switch and says so in the form area; ?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/log/no-work?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "No work" })).toBeChecked();
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await signInAs(page, "manager", "/log/no-work?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });

  test("?demo=waiting shows 3 to send above the screen", async ({ page }) => {
    await signInAs(page, "manager", "/log/no-work?demo=waiting");
    await expect(page.getByRole("link", { name: "3 to send" })).toBeVisible();
  });
});
