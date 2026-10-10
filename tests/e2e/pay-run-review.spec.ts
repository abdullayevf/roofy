import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, checkMoneyFigureFont, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const MONEY = /^\$[\d,]+\.\d{2}$/;
const PATH = `/pay/${meta.payRuns.review}`;
const SCREEN = '[data-screen="pay-run-review"]';

async function signInAs(page: Page, role: string, next = PATH) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("Pay run review (display)", () => {
  test("shows the period, total and flags first, blocking before warnings", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Pay run" })).toBeVisible();
    await expect(page.locator("[data-pay-period]")).toHaveText("Mon 21 Sep to Sun 27 Sep");
    await expect(page.locator(`${SCREEN} .text-figure-xl`)).toHaveText(MONEY);
    const flags = page.locator("[data-pay-flag]");
    await expect(flags.first()).toHaveAttribute("data-pay-flag", "blocking");
    await expect(flags.first()).toContainText("No lm rate for Jake");
    await expect(flags.first()).toContainText("Fix the missing rate before you approve.");
    await expect(flags.nth(1)).toHaveAttribute("data-pay-flag", "warning");
    // A flag taps through to its line on this page, and that line is there.
    const href = await flags.first().locator("a").getAttribute("href");
    expect(href).toMatch(/^#line-/);
    await expect(page.locator(href!)).toContainText("Missing rate");
    expect((await checkMoneyFigureFont(page, SCREEN)).failures).toEqual([]);
    expect((await checkBackRow(page)).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a GST-registered contractor shows subtotal, GST, reimbursement and total (E6.1, E7.1)", async ({ page }) => {
    await signInAs(page, "owner");
    const dima = page.locator('[data-pay-person="contractor"]').filter({ has: page.getByRole("heading", { name: "Dima" }) });
    await expect(dima).toContainText("Registered for GST");
    await expect(dima.locator("[data-pay-reimbursement]")).toContainText("Trade Fasteners");
    const sums = dima.locator("[data-person-totals] > div");
    await expect(sums).toHaveText(["Subtotal$1,520.00", "GST$152.00", "Reimbursements$110.00", "Total$1,782.00"]);
    await expect(dima.locator("[data-person-total]")).toHaveText("$1,782.00");
    // An employee shows pay and total only; every amount sits in the right column as a figure.
    for (const a of await page.locator("[data-line-amount]").all()) await expect(a).toHaveText(MONEY);
    await expect(page.locator("[data-pay-run-totals] [data-pay-sum=total]")).toContainText(/Total\$[\d,]+\.\d{2}/);
  });

  test("late entries and adjustments carry their own date", async ({ page }) => {
    await signInAs(page, "manager");
    await expect(page.locator('[data-pay-line="late"] [data-line-label]')).toHaveText("Late entry for Mon 14 Sep");
    await expect(page.locator('[data-pay-line="adjustment"] [data-line-label]')).toHaveText("Adjustment for Thu 17 Sep");
    await expect(page.locator('[data-pay-line="normal"] [data-line-basis]').first()).toHaveText(/ at \$[\d,]+\.\d{2} (an hour|a day|per .+)$/);
  });

  test("Owner 2FA off is a second blocking flag that goes to Settings", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "owner", `${PATH}?demo=blocked`);
    const twoFactor = page.locator('[data-pay-flag="blocking"]').filter({ hasText: "Turn on two-factor before you approve a pay run." });
    await expect(twoFactor.locator("a")).toHaveAttribute("href", "/settings/members");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the accountant reads the same review", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.locator("[data-pay-person]").first()).toBeVisible();
    await expect(page.locator("[data-pay-flag]").first()).toBeVisible();
  });

  for (const state of ["loading", "error", "offline"] as const) {
    test(`${state} state`, async ({ page }, testInfo) => {
      const consoleLog = collectConsole(page);
      await signInAs(page, "manager", `${PATH}?demo=${state}`);
      await expect(page.getByRole("heading", { level: 1, name: "Pay run" })).toBeVisible();
      if (state === "loading") await expect(page.locator(`${SCREEN}[aria-busy=true]`)).toBeVisible();
      if (state === "error") await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      if (state === "offline") {
        await expect(page.locator("[data-pay-person]").first()).toBeVisible();
        await expect(page.getByText(/send automatically/)).toHaveCount(0);
      }
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }

  test("a foreman gets no access and the page carries no money", async ({ page }) => {
    await signInAs(page, "foreman");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expectNoMoney(page, [PATH, `${PATH}?demo=blocked`, `${PATH}?demo=offline`]);
  });
});
