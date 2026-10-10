import { expect, test, type Page } from "@playwright/test";
import { checkContentClearsFixedBars, checkDatesStayWhole, checkMoneyFigureFont, checkTableEdgeGap, checkTableHeaderAlign, checkTableRowHeight, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
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
    // Past runs follow, newest first, each with its status and total. The seed's current-week draft has no one in it yet, so it is
    // not listed (pay/i1-F15: any draft nobody is in is hidden, whatever its dates), and last week's draft stays the card above: the
    // newest row is the week before.
    await expect(page.getByRole("heading", { level: 2, name: "Other pay runs" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(1);
    await expect(rows(page).first()).toContainText("Approved");
    const firstHref = await rows(page).first().evaluate((el) => el.getAttribute("href") ?? el.querySelector("a")?.getAttribute("href") ?? null);
    expect(firstHref).toBe(`/pay/${meta.payRuns.lastApproved}`);
    await expect(page.locator(`[data-screen="pay-runs"] a[href="/pay/${meta.payRuns.lastApproved}"]:visible`)).toHaveCount(1);
    for (const t of await page.locator("[data-pay-total]:visible").all()) await expect(t).toHaveText(MONEY);
    for (const r of await rows(page).all()) await expect(r).toContainText(/Draft|Approved|Exported/);
    expect((await checkMoneyFigureFont(page, '[data-screen="pay-runs"]')).failures).toEqual([]);
    // Every period keeps each date whole and breaks only at "to" (pay/i1-D7+F6, lesson 23), on iphone, android and desktop.
    expect((await checkDatesStayWhole(page, '[data-screen="pay-runs"] [data-pay-period]')).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("shows the latest 8 other runs, then 'Show older pay runs' for the rest", async ({ page }) => {
    await signInAs(page, "owner");
    const total = seed.payRuns.length;
    const older = page.getByRole("button", { name: "Show older pay runs" });
    await expect(rows(page)).toHaveCount(8);
    await expect(older).toBeVisible();
    await older.click();
    // Every run except the draft to review, and except a draft nobody is in yet (no one has logged on it).
    const listed = total - 1 - seed.payRuns.filter((r) => r.status === "draft" && r.id !== meta.payRuns.review).length;
    expect(listed).toBeGreaterThan(8);
    await expect(rows(page)).toHaveCount(listed);
    await expect(page.getByRole("button", { name: "Show fewer pay runs" })).toBeVisible();
    await page.getByRole("button", { name: "Show fewer pay runs" }).click();
    await expect(rows(page)).toHaveCount(8);
  });

  test("a week with no one in it yet is not listed", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page.locator(`[data-screen="pay-runs"] a[href="/pay/${meta.payRuns.current}"]`)).toHaveCount(0);
    await expect(page.getByText("No one yet")).toHaveCount(0);
    await expect(page.getByText("$0.00")).toHaveCount(0);
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

  test("offline, Review pay run stays open to read; the list says nothing about a connection and no 'will send' banner", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/pay?demo=offline");
    const card = page.locator("[data-pay-review]");
    const review = card.getByRole("link", { name: "Review pay run" });
    await expect(review).toBeVisible();
    await expect(review).toBeEnabled();
    await expect(review).toHaveAttribute("href", `/pay/${meta.payRuns.review}`);
    await expect(card.getByRole("button", { name: "Review pay run" })).toHaveCount(0);
    await expect(page.getByText(/Needs connection/)).toHaveCount(0);
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
    // The heading and sentence sit on the left edge like every other screen's title, not centred (pay/i1-F13).
    const [main, heading, sentence] = await Promise.all([
      page.locator("main").boundingBox(),
      page.getByRole("heading", { level: 1, name: "No access" }).boundingBox(),
      page.getByText("You don't have access to this. Ask your manager.").boundingBox(),
    ]);
    expect(heading!.x).toBeLessThanOrEqual(main!.x + 17);
    expect(sentence!.x).toBeLessThanOrEqual(main!.x + 17);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    await expectNoMoney(page, ["/pay", "/pay?demo=empty", "/pay?demo=loading", "/pay?demo=error", "/pay?demo=offline", "/pay?demo=noperm"]);
  });

  test("noperm demo shows the no-permission page to a manager too", async ({ page }) => {
    await signInAs(page, "manager", "/pay?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});

test("a tablet: at the end of the list nothing sits under the tab bar (pay iter2 D16)", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await signInAs(page, "manager");
  const r = await checkContentClearsFixedBars(page);
  expect(r.failures).toEqual([]);
});
