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
    await expect(rows.nth(1)).toContainText("Sheet install, 40 m²: Sam, Dima");
    await expect(rows.nth(2)).toContainText("No work");
    await expect(rows.nth(2)).toContainText("Rain: Jake");
    await expect(rows.getByText("Waiting", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("link", { name: "3 to send" })).toHaveCount(0); // the page is the list; no badge repeating it
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a status is an icon and a word with no chip border, except Needs attention", async ({ page }) => {
    await signInAs(page, "manager", "/outbox?demo=mixed");
    const border = (name: string) =>
      page.locator('[data-screen="outbox"] li').getByText(name, { exact: true }).first().evaluate((el) => getComputedStyle(el.parentElement!).borderTopWidth);
    for (const word of ["Waiting", "Sending", "Sent"]) expect(await border(word)).toBe("0px");
    expect(await border("Needs attention")).not.toBe("0px");
  });

  test("mixed: all four groups, the chip sits under the label on a phone, the badge is not repeated on the page", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/outbox?demo=mixed");
    for (const title of ["Needs attention", "Sending", "Waiting", "Sent"])
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${title} \\(1\\)`) })).toBeVisible();
    await expect(page.getByRole("link", { name: /to send|needs attention/ })).toHaveCount(0);
    if (isPhone(testInfo.project.name) && page.viewportSize()!.width < 600) {
      const rows = page.locator('[data-screen="outbox"] li');
      const label = (await rows.nth(1).getByText("Progress", { exact: true }).boundingBox())!;
      const status = (await rows.nth(1).getByText("Sending", { exact: true }).boundingBox())!;
      expect(status.y).toBeGreaterThan(label.y + label.height - 1);
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the nav marks Outbox as the current page", async ({ page }) => {
    await signInAs(page, "foreman", "/outbox?demo=waiting");
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Outbox/ })).toHaveAttribute("aria-current", "page");
  });

  test("a rejected entry shows the server's own reason with Edit and resend and Discard in view, no tap to open", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/outbox?demo=attention");
    await expect(page.getByRole("heading", { level: 2, name: /^Needs attention \(1\)/ })).toBeVisible();
    await expect(page.getByText("You don't have access to this job any more. Ask your manager.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit and resend" })).toHaveAttribute("href", /^\/log\?date=2026-09-28&project=.+&stage=.+&crew=.+&ex=.+/);
    await expect(page.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Discard asks first; cancelling keeps the entry, confirming removes it", async ({ page }) => {
    await signInAs(page, "manager", "/outbox?demo=attention");
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Discard this entry?");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("link", { name: "Edit and resend" })).toBeVisible();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await page.getByRole("button", { name: "Discard entry" }).click();
    await expect(page.getByText("Entry discarded. Nothing was sent.")).toBeVisible();
    await expect(page.getByText("Nothing is waiting to send.")).toBeVisible();
  });

  test("a foreman has the Outbox tab and sees the same rows with no money", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", "/outbox?demo=attention");
    await expect(page.getByRole("link", { name: "Edit and resend" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await expectNoMoney(page, ["/outbox", "/outbox?demo=empty", "/outbox?demo=loading", "/outbox?demo=offline", "/outbox?demo=waiting", "/outbox?demo=attention", "/outbox?demo=mixed", "/outbox?demo=noperm"]);
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

  test("?demo=error keeps the title and says so in the list area; ?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/outbox?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "Outbox" })).toBeVisible();
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await signInAs(page, "manager", "/outbox?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
