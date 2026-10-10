import { expect, test, type Page } from "@playwright/test";
import { checkMoneyFigureFont, checkTableEdgeGap, checkTableHeaderAlign, checkTableRowHeight, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const MONEY = /^\$[\d,]+\.\d{2}$/;

async function signInAs(page: Page, role: string, next = "/pay") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

// Phone rows and the desktop table are both in the DOM; `:visible` keeps only this width's rows.
const rows = (page: Page) => page.locator('[data-screen="pay-runs"] [data-pay-row]:visible');

test.describe("Pay runs list (owner and manager)", () => {
  test("shows last week's draft first with its total, people and flags, then the other runs", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Pay runs" })).toBeVisible();
    const card = page.locator("[data-pay-review]");
    await expect(card.locator("[data-pay-period]")).toHaveText("Mon 21 Sep to Sun 27 Sep");
    await expect(card.getByText("Draft")).toBeVisible();
    await expect(card.locator(".text-figure-xl")).toHaveText(MONEY);
    await expect(card.locator("[data-pay-people]")).toHaveText(/^\d+ (person|people) in this pay run$/);
    await expect(card.locator("[data-pay-flags]")).toHaveText(/^(Nothing to check|\d+ things? to check) before you approve\./);
    const review = card.getByRole("link", { name: "Review pay run" });
    await expect(review).toHaveAttribute("href", `/pay/${meta.payRuns.review}`);
    // This week's draft and past runs follow, each with its status and total.
    await expect(page.getByRole("heading", { level: 2, name: "Other pay runs" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(1);
    await expect(rows(page).first()).toContainText("Draft");
    await expect(page.locator(`[data-screen="pay-runs"] a[href="/pay/${meta.payRuns.lastApproved}"]:visible`)).toHaveCount(1);
    for (const t of await page.locator("[data-pay-total]:visible").all()) await expect(t).toHaveText(MONEY);
    for (const r of await rows(page).all()) await expect(r).toContainText(/Draft|Approved|Exported/);
    expect((await checkMoneyFigureFont(page, '[data-screen="pay-runs"]')).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("totals line up in one right-hand column and never run under the period", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the phone row; the desktop table has its own column");
    await signInAs(page, "owner");
    const boxes = await rows(page).evaluateAll((els) =>
      els.map((el) => {
        const r = (sel: string) => el.querySelector(sel)!.getBoundingClientRect();
        return { periodRight: r("[data-pay-period]").right, totalLeft: r("[data-pay-total]").left, totalRight: r("[data-pay-total]").right, row: el.getBoundingClientRect().height };
      }),
    );
    for (const b of boxes) {
      expect(Math.abs(b.totalRight - boxes[0]!.totalRight)).toBeLessThanOrEqual(1);
      expect(b.periodRight).toBeLessThanOrEqual(b.totalLeft);
      expect(b.row).toBeGreaterThanOrEqual(64);
    }
  });

  test("desktop puts the draft and the table side by side, with table edges and rows to the rules", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "desktop layout");
    await signInAs(page, "manager");
    const card = await page.locator("[data-pay-review]").boundingBox();
    const table = await page.locator('[data-screen="pay-runs"] table').boundingBox();
    expect(card!.x + card!.width).toBeLessThan(table!.x);
    expect(Math.abs(card!.y - table!.y)).toBeLessThan(80);
    expect((await checkTableEdgeGap(page, 16)).failures).toEqual([]);
    expect((await checkTableHeaderAlign(page, 16)).failures).toEqual([]);
    expect((await checkTableRowHeight(page, 48)).failures).toEqual([]);
  });

  test("with no pay runs yet it says so, with the one way to start", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/pay?demo=empty");
    await expect(page.getByText("No pay runs yet. A pay run starts when the crew logs work.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log a crew-day" })).toHaveAttribute("href", "/log");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("loading shows the title and blocks shaped like the card and rows", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/pay?demo=loading");
    await expect(page.locator('[data-screen="pay-runs"][aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Pay runs" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("error keeps the title and makes Try again the primary button", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/pay?demo=error");
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), skip: { console: true } });
  });

  test("offline disables Review pay run with one Needs connection line and no 'will send' banner", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/pay?demo=offline");
    const card = page.locator("[data-pay-review]");
    await expect(card.getByRole("button", { name: "Review pay run" })).toBeDisabled();
    await expect(page.getByText("Needs connection — try again once you're back online.")).toHaveCount(1);
    await expect(page.getByText(/send automatically/)).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });
});

test.describe("Pay runs list (accountant and foreman)", () => {
  test("an accountant reads the same list and opens the draft, with nothing to approve here", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "accountant");
    const card = page.locator("[data-pay-review]");
    await expect(card.getByRole("link", { name: "Open pay run" })).toHaveAttribute("href", `/pay/${meta.payRuns.review}`);
    await expect(card.locator("[data-pay-flags]")).toHaveText(/(in this pay run|Nothing to check in this pay run)\.$/);
    await expect(page.getByText("Review pay run")).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a foreman gets no permission, and no page they can reach carries money", async ({ page }, testInfo) => {
    await signInAs(page, "foreman");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.locator('[data-screen="pay-runs"]')).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    await expectNoMoney(page, ["/pay", "/pay?demo=empty", "/pay?demo=loading", "/pay?demo=error", "/pay?demo=offline", "/pay?demo=noperm"]);
  });

  test("noperm demo shows the no-permission page to a manager too", async ({ page }) => {
    await signInAs(page, "manager", "/pay?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
