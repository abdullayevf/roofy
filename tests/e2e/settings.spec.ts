import { expect, test, type Page } from "@playwright/test";
import { checkPrimaryActionPlacement, checkSafeAreas, checkToastClearsBars, collectConsole, expectScreenHealthy, waitForHydrated } from "./guards";

const isPhone = (name: string) => name !== "desktop";
const NEEDS_CONNECTION = "Needs connection — try again once you're back online.";
/** Open a page and wait for React to attach to its boxes: a fill made before then shows but never reaches the form's state. */
async function go(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
  await waitForHydrated(page);
}
const h1 = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

test.describe("Settings (screen 23)", () => {
  test("the Owner's hub lists every area, Owner-only rows included", async ({ page }, info) => {
    const log = collectConsole(page);
    await go(page, "owner", "/settings");
    await expect(h1(page, "Settings")).toBeVisible();
    for (const row of ["Business", "Pay period & working days", "On-cost", "Levels & floor rates", "Templates", "Expense categories", "Members & roles", "Foreman assignments", "Two-factor", "Workspace export"])
      await expect(page.getByRole("link", { name: new RegExp(`^${row}`) }).first()).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
  });

  test("the Manager's hub has no members, two-factor or workspace export", async ({ page }) => {
    await go(page, "manager", "/settings");
    await expect(h1(page, "Settings")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Levels & floor rates/ })).toBeVisible();
    for (const row of ["Members & roles", "Two-factor", "Workspace export"]) await expect(page.getByRole("link", { name: new RegExp(`^${row}`) })).toHaveCount(0);
    await go(page, "manager", "/settings/two-factor");
    await expect(page.getByText("You don't have access to this. Ask the owner.")).toBeVisible();
  });

  for (const role of ["accountant", "foreman"])
    test(`the ${role} gets no access and no figures`, async ({ page }) => {
      for (const path of ["/settings", "/settings/levels", "/settings/on-cost"]) {
        await go(page, role, path);
        await expect(page.getByText(/You don't have access to this/)).toBeVisible();
        expect(await page.locator("main").innerText()).not.toMatch(/\$|%/);
      }
    });

  for (const [path, title] of [
    ["/settings/business", "Business"],
    ["/settings/pay-period", "Pay period & working days"],
    ["/settings/on-cost", "On-cost"],
    ["/settings/levels", "Levels & floor rates"],
    ["/settings/two-factor?demo=blocked", "Two-factor"],
  ] as const)
    test(`${title}: renders with Save, then offline says Needs connection once`, async ({ page }, info) => {
      const log = collectConsole(page);
      await go(page, "owner", path);
      await expect(h1(page, title)).toBeVisible();
      const save = page.getByRole("button", { name: /^(Save changes|Turn on two-factor)$/ });
      await expect(save).toBeEnabled();
      await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
      if (path.includes("?")) return;
      await go(page, "owner", `${path}?demo=offline`);
      await expect(page.getByText(NEEDS_CONNECTION)).toHaveCount(1);
      await expect(page.getByText(/will send automatically/), "a page that cannot queue never promises to send later").toHaveCount(0);
      await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
      await expect(page.locator("input").first(), "reading stays available offline").toBeVisible();
    });

  test("More offline: Sign out waits under one Needs connection sentence, the theme still works, no send-later banner", async ({ page }) => {
    for (const role of ["owner", "manager", "foreman", "accountant"]) {
      await go(page, role, "/more?demo=offline");
      await expect(page.getByText(NEEDS_CONNECTION)).toHaveCount(1);
      await expect(page.getByText(/will send automatically/)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Sign out" })).toBeDisabled();
      await expect(page.getByRole("radio", { name: "Dark" }), "the theme is kept on the device, so it works offline").toBeEnabled();
    }
  });

  test("validation errors are per field and nothing saves", async ({ page }) => {
    await go(page, "owner", "/settings/business");
    await page.getByLabel("Business name").fill("");
    await page.getByLabel("ABN").fill("123");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("ABN should be 11 digits.")).toBeVisible();
    await expect(page.getByText("Add your business name.")).toBeVisible();
    await go(page, "owner", "/settings/on-cost");
    await page.getByLabel("On-cost").fill("abc");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Enter a percent, like 18.5.")).toBeVisible();
    await go(page, "owner", "/settings/levels");
    await page.getByLabel("Floor rate for Roofer").fill("0.00");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Add a floor rate before saving.")).toBeVisible();
    await expect(page.getByText("Changes saved.", { exact: true })).toHaveCount(0);
  });

  test("on-cost saves and the hub shows the new percent", async ({ page }) => {
    await go(page, "manager", "/settings/on-cost");
    await page.getByLabel("On-cost").fill("18.25");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /^On-cost/ })).toContainText("18.25% on employee pay");
  });

  test("two-factor off: the Owner turns it on with a 6-digit code", async ({ page }) => {
    await go(page, "owner", "/settings/two-factor?demo=blocked");
    await page.getByRole("button", { name: "Turn on two-factor" }).click();
    await expect(page.getByText("Enter the 6-digit code from your app.")).toHaveCount(1);
    await expect(page.getByText("Two-factor is on.", { exact: true })).toHaveCount(0);
    await page.getByLabel("Code").fill("123 456");
    await page.getByRole("button", { name: "Turn on two-factor" }).click();
    await expect(page.getByText(/^Two-factor is on\. When you sign in/), "the page turns to its on state").toBeVisible();
    await expect(page.getByRole("button", { name: "Turn on two-factor" })).toHaveCount(0);
    await expect(page.getByText("Two-factor is on.", { exact: true }), "no toast that would unmount with the form").toHaveCount(0);
  });

  test("two-factor on: a green On chip with its icon sits 16 px under the title, and there is nothing to tap", async ({ page }) => {
    await go(page, "owner", "/settings/two-factor");
    await expect(page.getByText(/^Two-factor is on\. When you sign in/)).toBeVisible();
    const chip = page.locator("main").getByText("On", { exact: true }).locator("xpath=..");
    await expect(chip.locator("svg"), "the chip carries an icon, not only a colour").toHaveCount(1);
    const title = (await h1(page, "Two-factor").boundingBox())!;
    const box = (await chip.boundingBox())!;
    const gap = box.y - (title.y + title.height);
    expect(gap, "the chip is not stuck to the title").toBeGreaterThanOrEqual(12);
    expect(gap, "and not the old 40 px below it").toBeLessThanOrEqual(20);
    await expect(page.locator("main").getByRole("button"), "no spec names an action for the on state").toHaveCount(0);
  });

  test("levels empty state", async ({ page }) => {
    await go(page, "owner", "/settings/levels?demo=empty");
    await expect(page.getByText("No levels yet.", { exact: false })).toBeVisible();
  });
  // Categories have no page-level Save: each one saves from its own edit sheet (settings-lists.spec.ts).
  // Entry-settings iter1 D8 + F2 (P1): a settings form taller than the first screen pins its Save bar, so Save and its
  // error or Needs connection line are on screen without scrolling; a saved toast sits above the bars.
  for (const [path, role] of [
    ["/settings/levels", "owner"],
    ["/settings/pay-period", "owner"],
    ["/settings/templates?type=metal_reroof", "owner"],
    ["/settings/assignments", "owner"],
  ] as const)
    test(`${path}: Save is pinned inside the first viewport and the saved toast clears the bars`, async ({ page }, info) => {
      await go(page, role, path);
      const save = page.getByRole("button", { name: "Save changes", exact: true });
      await expect(save).toBeVisible();
      await expect(page.locator('[data-slot="primary-action"] [data-variant="primary"]'), "Save lives in the pinned bar").toHaveCount(1);
      const phone = isPhone(info.project.name);
      const placement = await checkPrimaryActionPlacement(page);
      expect(placement.failures, "Save is in the first viewport, above the tab bar").toEqual([]);
      if (phone) {
        const box = await save.boundingBox();
        expect(box!.y + box!.height, "Save ends inside the first viewport").toBeLessThanOrEqual(page.viewportSize()!.height);
      }
      await save.click();
      await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
      if (phone) {
        const toast = await checkToastClearsBars(page);
        expect(toast.failures).toEqual([]);
      }
    });

  for (const [path, label, bad] of [
    ["/settings/pay-period", "Standard day", "0"],
    ["/settings/levels", "Floor rate for Roofer", "0.00"],
  ] as const)
    test(`${path}: a refused save focuses the first bad field and keeps the Save bar clear of the home indicator`, async ({ page }, info) => {
      await go(page, "owner", path);
      await page.getByLabel(label).fill(bad);
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
      const bar = page.locator('[data-slot="primary-action"]');
      if (isPhone(info.project.name)) {
        // The focused field has no keyboard open here, so the bar stays above the tab bar (keyboard mode would drop it
        // into the bottom safe-area inset).
        await expect(bar).not.toHaveAttribute("data-keyboard", "true");
        expect((await checkSafeAreas(page)).failures).toEqual([]);
      }
    });

  test("Members: a role change saves on pick and Send invite is the one primary", async ({ page }) => {
    await go(page, "owner", "/settings/members");
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.locator('[data-variant="primary"]:visible')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Send invite" })).toBeVisible();
  });
});
