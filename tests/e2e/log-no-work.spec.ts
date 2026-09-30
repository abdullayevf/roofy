import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";

const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/log/no-work") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("No-work marker", () => {
  test("opens on today with nobody chosen and Save off", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("radio", { name: "No work" })).toBeChecked();
    await expect(page.getByText("Today, Mon 28 Sep")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Today" })).toBeChecked();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(page.getByText("Choose who didn't work and why.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("marks Jake as rain and says so", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: /^Jake\s/ }).click();
    await page.getByRole("radio", { name: "Rain" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toContainText("Jake marked as rain on Mon 28 Sep");
    await expect(page.getByTestId("chalk-line")).toHaveClass(/w-full/);
    await page.getByRole("button", { name: "Mark someone else" }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  });

  test("Yesterday moves the day and keeps who and why", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: /^Jake\s/ }).click();
    await page.getByRole("radio", { name: "Sick" }).click();
    await page.getByRole("radio", { name: "Yesterday" }).click();
    await expect(page.getByText("Yesterday, Sun 27 Sep")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Jake\s/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: "Sick" })).toBeChecked();
  });

  test("someone who already has a log that day cannot be marked", async ({ page }) => {
    await signInAs(page, "manager", "/log");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await page.getByRole("button", { name: "Save day" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
    await page.goto("/log/no-work");
    const sam = page.getByRole("button", { name: /^Sam\s/ });
    await expect(sam).toBeDisabled();
    await expect(page.getByText("Sam already has a log today. Remove it first to mark no work.")).toBeVisible();
  });

  test("a foreman sees the same screen with no money", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await page.getByRole("button", { name: /^Jake\s/ }).click();
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

  test("?demo=error reaches the error screen and ?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/log/no-work?demo=error");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await signInAs(page, "manager", "/log/no-work?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });

  test("?demo=waiting shows 3 to send above the screen", async ({ page }) => {
    await signInAs(page, "manager", "/log/no-work?demo=waiting");
    await expect(page.getByRole("link", { name: "3 to send" })).toBeVisible();
  });
});
