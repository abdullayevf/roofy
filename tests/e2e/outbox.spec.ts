import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";

const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/outbox") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("Outbox", () => {
  test("with nothing queued says so and points back to Log", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Outbox" })).toBeVisible();
    await expect(page.getByText("Nothing is waiting to send.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Log" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("waiting entries are listed with a Waiting chip: crew day, progress, no work", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/outbox?demo=waiting");
    await expect(page.getByRole("heading", { level: 2, name: /^Waiting \(3\)/ })).toBeVisible();
    const rows = page.locator('[data-screen="outbox"] li');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Crew day");
    await expect(rows.nth(0)).toContainText("Smith job — Ryde re-roof, Sheet install: Sam, Dima");
    await expect(rows.nth(1)).toContainText("Progress");
    await expect(rows.nth(2)).toContainText("No work");
    await expect(rows.nth(2)).toContainText("Rain: Jake");
    await expect(rows.getByText("Waiting", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("link", { name: "3 to send" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a rejected entry opens to the server's own reason with Edit and resend and Discard", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/outbox?demo=attention");
    await expect(page.getByRole("heading", { level: 2, name: /^Needs attention \(1\)/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "1 entry needs attention" })).toBeVisible();
    const row = page.getByRole("button", { name: /Crew day/ });
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await row.click();
    await expect(page.getByText("You don't have access to this job any more. Ask your manager.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit and resend" })).toHaveAttribute("href", /^\/log\?project=.+&stage=.+&crew=.+/);
    await expect(page.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Discard asks first; cancelling keeps the entry, confirming removes it", async ({ page }) => {
    await signInAs(page, "manager", "/outbox?demo=attention");
    await page.getByRole("button", { name: /Crew day/ }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Discard this entry?");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: /Crew day/ })).toBeVisible();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await page.getByRole("button", { name: "Discard entry" }).click();
    await expect(page.getByText("Entry discarded. Nothing was sent.")).toBeVisible();
    await expect(page.getByText("Nothing is waiting to send.")).toBeVisible();
  });

  test("a foreman has the Outbox tab and sees the same rows with no money", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/outbox?demo=attention");
    await expect(page.getByRole("button", { name: /Crew day/ })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await expectNoMoney(page, ["/outbox", "/outbox?demo=empty", "/outbox?demo=loading", "/outbox?demo=offline", "/outbox?demo=waiting", "/outbox?demo=attention", "/outbox?demo=noperm"]);
  });

  test("?demo=offline shows the banner and the screen still reads", async ({ page }) => {
    await signInAs(page, "manager", "/outbox?demo=offline");
    await expect(page.getByText("No signal — entries are saved on this device and will send automatically.")).toBeVisible();
    await expect(page.getByText("Nothing is waiting to send.")).toBeVisible();
  });

  test("?demo=loading shows the skeleton", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/outbox?demo=loading");
    await expect(page.locator('[data-screen="outbox"][aria-busy="true"]')).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=error reaches the error screen and ?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/outbox?demo=error");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await signInAs(page, "manager", "/outbox?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
