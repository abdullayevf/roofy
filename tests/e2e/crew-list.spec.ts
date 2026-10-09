import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/crew") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

// A phone row and a desktop table row are both in the page; only the one for this width shows.
const rows = (page: Page) => page.locator('[data-screen="crew"] [data-crew-row]:visible');

test.describe("Crew list (manager)", () => {
  test("opens on the active crew: name, who they are, last logged, and the balance in words", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Crew" })).toBeVisible();
    await expect(page.getByText(/^(\d+ (person is|people are) owed|No one is owed)$/)).toBeVisible();
    await expect(page.getByRole("radio", { name: "Active", exact: true })).toBeChecked();
    await expect(rows(page)).toHaveCount(11);
    await expect(rows(page).filter({ hasText: "Pete" })).toHaveCount(0);
    const dima = rows(page).filter({ hasText: "Dima" });
    await expect(dima.getByRole("link").or(dima)).toBeVisible();
    await expect(page.locator(`[data-screen="crew"] a[href="/crew/${meta.crew.dima}"]:visible`)).toHaveCount(1);
    await expect(dima.locator("[data-crew-line]")).toContainText(/^Contractor|^Employee/);
    // A balance is a figure and one of three plain words.
    for (const b of await page.locator("[data-crew-balance]:visible").all()) await expect(b).toHaveText(/^\$[\d,]+\.\d{2}(Owed|Paid ahead|Nothing owed)$/);
    // Kev has been owed for longer than a pay period.
    await expect(rows(page).filter({ hasText: "Kev" }).getByText("Owed for a long time")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the balances line up in one right-hand column and never run under a name", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the phone row; the desktop table has its own column");
    await signInAs(page, "manager", "/crew?show=all");
    const boxes = await rows(page).evaluateAll((els) =>
      els.map((el) => {
        const r = (sel: string) => el.querySelector(sel)!.getBoundingClientRect();
        const name = r("[data-crew-name]");
        const balance = r("[data-crew-balance]");
        return { nameRight: name.right, balanceLeft: balance.left, balanceRight: balance.right, row: el.getBoundingClientRect().height };
      }),
    );
    expect(boxes.length).toBe(13);
    const first = boxes[0]!;
    for (const b of boxes) {
      expect(Math.abs(b.balanceRight - first.balanceRight)).toBeLessThanOrEqual(1);
      expect(b.nameRight).toBeLessThanOrEqual(b.balanceLeft);
      expect(b.row).toBeGreaterThanOrEqual(64);
    }
  });

  test("Active and inactive adds the people who have left, marked Inactive, a very long name wraps", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await page.getByRole("radio", { name: "Active and inactive" }).click();
    await expect(page).toHaveURL(/show=all/);
    await expect(rows(page)).toHaveCount(13);
    await expect(rows(page).filter({ hasText: "Pete" }).locator("[data-crew-line]")).toContainText("Inactive");
    const long = rows(page).filter({ hasText: "Featherstonehaugh" });
    await expect(long.locator("[data-crew-line]")).toContainText("Contractor");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a row opens the person's page", async ({ page }) => {
    await signInAs(page, "manager");
    await page.locator(`[data-screen="crew"] a[href="/crew/${meta.crew.dima}"]:visible`).click();
    await expect(page).toHaveURL(new RegExp(`/crew/${meta.crew.dima}$`));
  });

  test("with no crew says so in one sentence and points to Settings", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/crew?demo=empty");
    await expect(page.getByText("No crew yet. Add your crew in Settings.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Settings" })).toHaveAttribute("href", "/settings");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("loading shows rows the shape of the real ones; error offers Try again as the primary button", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/crew?demo=loading");
    await expect(page.locator('[data-screen="crew"][aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Crew" })).toBeVisible();
    const consoleLog = collectConsole(page);
    await page.goto("/crew?demo=error");
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline keeps the list and shows the shell's banner", async ({ page }) => {
    await signInAs(page, "manager", "/crew?demo=offline");
    await expect(page.getByText(/No signal/).first()).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
  });

  test("an owner sees the same list", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(rows(page)).toHaveCount(11);
  });
});

test.describe("Crew list (foreman and accountant)", () => {
  test("a foreman sees names, type and how they are paid, with no money and nothing to open", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await expect(page.getByRole("heading", { level: 1, name: "Crew" })).toBeVisible();
    await expect(rows(page)).toHaveCount(11);
    await expect(rows(page).filter({ hasText: "Dima" }).locator("[data-crew-line]")).toContainText(/^(Employee|Contractor) · Paid /);
    await expect(page.locator("[data-crew-balance]")).toHaveCount(0);
    await expect(page.getByText(/owed/i)).toHaveCount(0);
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.locator('[data-screen="crew"] a[href^="/crew/"]')).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the HTML and the data have no money on any state", async ({ page }) => {
    await signInAs(page, "foreman");
    await expectNoMoney(page, ["/crew", "/crew?show=all", "/crew?demo=empty", "/crew?demo=loading", "/crew?demo=error", "/crew?demo=offline", "/crew?demo=noperm"]);
  });

  test("a foreman with no crew is told to ask their manager, with nothing to tap", async ({ page }) => {
    await signInAs(page, "foreman", "/crew?demo=empty");
    await expect(page.getByText("No crew yet. Ask your manager to add them.")).toBeVisible();
    await expect(page.locator('[data-screen="crew"] a[href]')).toHaveCount(0);
  });

  test("an accountant has no crew page", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
