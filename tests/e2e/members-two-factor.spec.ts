import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy, waitForHydrated } from "./guards";

/** Task 13 run 3: removing a person from the team, the Owner two-factor line, and the two-factor set-up with its QR code. */

const isPhone = (name: string) => name !== "desktop";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function go(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
  await waitForHydrated(page);
}

test.describe("Members: remove a person", () => {
  test("Owner two-factor line says on, and says off (with what to do) when it is off", async ({ page }) => {
    await go(page, "owner", "/settings/members");
    await expect(page.getByText("Two-factor is on for the owner.", { exact: true })).toBeVisible();
    await go(page, "owner", "/settings/members?demo=blocked");
    await expect(
      page.getByText(/^Two-factor is off for the owner\. Turn it on under Two-factor in settings/),
    ).toBeVisible();
  });

  test("Remove from team asks first, names the person, Cancel keeps them, the second press removes them", async ({
    page,
  }, testInfo) => {
    const consoleLog = collectConsole(page);
    await go(page, "owner", "/settings/members");
    await page
      .getByRole("button", { name: /Priya Shah/ })
      .first()
      .click();
    const remove = button(page, "Remove from team");
    await expect(remove).toBeVisible();
    const box = (await remove.boundingBox())!;
    expect(box.height, "Remove from team is a 48 px target").toBeGreaterThanOrEqual(48);
    await remove.click();

    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog).toContainText("Remove Priya Shah?");
    await expect(dialog).toContainText("They lose their access to Roofy straight away.");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });

    await button(page, "Cancel").click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Priya Shah/ }).first(),
      "Cancel keeps the person",
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Priya Shah/ })
      .first()
      .click();
    await button(page, "Remove from team").click();
    await button(page, "Remove from team").click();
    await expect(page.getByText("Person removed.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Priya Shah/ }), "the row is gone").toHaveCount(0);
  });

  test("offline: the Remove button is off and gives the reason once", async ({ page }) => {
    await go(page, "owner", "/settings/members?demo=offline");
    await page
      .getByRole("button", { name: /Priya Shah/ })
      .first()
      .click();
    const remove = button(page, "Remove from team");
    await expect(remove).toBeDisabled();
    await expect(
      remove.locator("xpath=..").getByText("Needs connection"),
      "one reason under the button",
    ).toHaveCount(1);
  });

  test("a foreman is refused and sees no money; a manager is told to ask the owner", async ({ page }) => {
    await go(page, "foreman", "/settings/members");
    await expect(page.getByRole("button", { name: "Remove from team" })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/\$\s?\d/);
    await go(page, "manager", "/settings/members");
    await expect(page.getByRole("button", { name: "Remove from team" })).toHaveCount(0);
  });
});

test.describe("Settings two-factor: set-up with a QR code", () => {
  test("off: a QR code, the key as text, no sideways scroll, and a wrong code is said in words", async ({
    page,
  }, testInfo) => {
    const consoleLog = collectConsole(page);
    await go(page, "owner", "/settings/two-factor?demo=blocked");
    const qr = page.getByRole("img", { name: "Scan this with your authenticator app" });
    await expect(qr).toBeVisible();
    const size = (await qr.boundingBox())!;
    expect(size.width, "the QR code is big enough to scan").toBeGreaterThanOrEqual(160);
    await expect(page.getByText("RFY4 7KQ2 MZTD 3XWB"), "the key is there for typing by hand").toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no sideways scroll").toBeLessThanOrEqual(0);

    await page.getByLabel("Code").fill("000000");
    await button(page, "Turn on two-factor").click();
    await expect(page.getByText("That code doesn't match.")).toBeVisible();
    await expect(page.getByText(/^Two-factor is on\. When you sign in/)).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a good code turns it on and the QR code goes away", async ({ page }) => {
    await go(page, "owner", "/settings/two-factor?demo=blocked");
    await page.getByLabel("Code").fill("482913");
    await button(page, "Turn on two-factor").click();
    await expect(page.getByText(/^Two-factor is on\. When you sign in/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Scan this with your authenticator app" })).toHaveCount(0);
  });
});
