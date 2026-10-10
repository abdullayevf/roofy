import { expect, test, type Page } from "@playwright/test";
import { checkTableEdgeGap, checkTableHeaderAlign, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/expenses") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

// Both layouts (phone rows and the desktop table) are in the DOM; keep `:visible` so only this width's rows count.
const rows = (page: Page) => page.locator('[data-screen="expenses"] [data-expense-row]:visible');
const smithCount = seed.expenses.filter((e) => e.projectId === meta.projects.smith).length;
const stageCount = seed.expenses.filter((e) => e.stageId === meta.stages.smithSheetInstall).length;

test.describe("Expenses list (manager)", () => {
  test("opens on the newest expenses: totals ex GST and GST, then date, supplier, job, category, who paid, receipt, total", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible();
    await expect(page.locator("[data-expense-totals]")).toContainText(/^\$[\d,]+\.\d{2}ex GST, plus \$[\d,]+\.\d{2}\sGST$/);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.locator("[data-expense-more]")).toContainText(/^Showing the newest 50 of \d+\sexpenses\./);
    // Each row: a total in dollars, a receipt marker, and a plain paid-by line.
    const first = rows(page).first();
    await expect(first.locator("[data-expense-total]")).toHaveText(/^\$[\d,]+\.\d{2}$/);
    await expect(first.locator("[data-expense-receipt]")).toHaveText(/^(Receipt attached|No receipt)$/);
    for (const p of await page.locator("[data-expense-paid-by]:visible").all()) await expect(p).toHaveText(/^Paid (by company card|in cash|by [^.]+)/);
    await expect(page.getByRole("link", { name: "Add expense" }).first()).toBeVisible();
    await expect(page.locator("[data-expense-filter]")).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a crew-paid expense says who paid and when they are reimbursed", async ({ page }) => {
    await signInAs(page, "manager", `/expenses?job=${meta.projects.smith}`);
    const crewPaid = rows(page).filter({ has: page.locator("[data-expense-paid-by]", { hasText: "Paid by Dima" }) }).first();
    await expect(crewPaid.locator("[data-expense-paid-by]")).toHaveText(/^Paid by Dima — reimbursed( next pay run| in the draft pay run)?$/);
    await expect(crewPaid.locator("[data-expense-paid-by]")).toContainText(" ".length ? "Paid by Dima" : "");
  });

  test("a job link narrows the list to that job, with a chip that takes the filter off", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `/jobs/${meta.projects.smith}`);
    await page.locator(`a[href="/expenses?job=${meta.projects.smith}"]:visible`).first().click();
    await expect(page).toHaveURL(new RegExp(`/expenses\\?job=${meta.projects.smith}$`));
    const chip = page.locator('[data-expense-filter="job"]');
    await expect(chip).toBeVisible();
    await expect(rows(page)).toHaveCount(smithCount);
    for (const j of await page.locator("[data-expense-job]:visible").all()) await expect(j).toContainText(await chip.innerText());
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await chip.click();
    await expect(page).toHaveURL(/\/expenses$/);
    await expect(page.locator("[data-expense-filter]")).toHaveCount(0);
    await expect(page.locator("[data-expense-more]")).toBeVisible();
  });

  test("a stage's Expenses link narrows to that stage; its chip takes off the stage and keeps the job", async ({ page }) => {
    await signInAs(page, "manager", `/jobs/${meta.projects.smith}/stages/${meta.stages.smithSheetInstall}`);
    const link = page.locator(`a[href="/expenses?job=${meta.projects.smith}&stage=${meta.stages.smithSheetInstall}"]:visible`).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`stage=${meta.stages.smithSheetInstall}$`));
    await expect(page.locator('[data-expense-filter="stage"]')).toBeVisible();
    await expect(rows(page)).toHaveCount(stageCount);
    await page.locator('[data-expense-filter="stage"]').click();
    await expect(page).toHaveURL(new RegExp(`/expenses\\?job=${meta.projects.smith}$`));
    await expect(rows(page)).toHaveCount(smithCount);
  });

  test("a job with no expenses says so in one sentence and keeps the chip", async ({ page }) => {
    await signInAs(page, "manager", `/expenses?job=${meta.fixtures.noStages}`);
    await expect(page.locator("[data-expense-empty]")).toHaveText("No expenses on this job yet.");
    await expect(page.locator('[data-expense-filter="job"]')).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });

  test("a job or stage that is not found drops the filter instead of breaking", async ({ page }) => {
    await signInAs(page, "manager", "/expenses?job=not-a-job&stage=nope");
    await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible();
    await expect(page.locator("[data-expense-filter]")).toHaveCount(0);
    await expect(rows(page).first()).toBeVisible();
  });

  test("a very long supplier and job name wrap and leave the total in its column", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", `/expenses?job=${meta.fixtures.longNames}`);
    await expect(rows(page)).toHaveCount(1);
    const box = await rows(page).first().evaluate((el) => {
      const visibleTotal = Array.from(el.querySelectorAll("[data-expense-total]")).find((t) => t.getBoundingClientRect().width > 0)!;
      const r = visibleTotal.getBoundingClientRect();
      return { right: r.right, vw: window.innerWidth, sw: document.documentElement.scrollWidth };
    });
    expect(box.right).toBeLessThanOrEqual(box.vw);
    expect(box.sw).toBeLessThanOrEqual(box.vw);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("with no expenses says so in one sentence and offers Add expense", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/expenses?demo=empty");
    await expect(page.getByText("No expenses yet. Add your first receipt.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add expense" }).first()).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("loading shows rows the shape of the real ones; error offers Try again as the primary button", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/expenses?demo=loading");
    await expect(page.locator('[data-screen="expenses"][aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible();
    const consoleLog = collectConsole(page);
    await page.goto("/expenses?demo=error");
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline keeps the list and shows the one shell banner, since Add expense still saves on the device", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/expenses?demo=offline");
    await expect(page.getByRole("status")).toContainText("No signal");
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(1);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an owner sees the same list", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(rows(page).first()).toBeVisible();
    await expect(page.locator("[data-expense-totals]")).toBeVisible();
  });

  test("the total column lines up, and no middle dot or arrow joins a fact", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the phone row; the desktop table has its own column");
    await signInAs(page, "manager");
    const rights = await page.locator("[data-expense-row]:visible [data-expense-total]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
    expect(rights.length).toBeGreaterThan(5);
    expect(new Set(rights).size).toBe(1);
    await expect(page.locator("main")).not.toContainText("·");
    await expect(page.locator("main")).not.toContainText(/[→←]/);
  });

  test("desktop table: text ends 16 px inside the border and the header lines up with the cells", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the desktop table");
    await signInAs(page, "manager");
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    expect((await checkTableEdgeGap(page, 16)).failures).toEqual([]);
    expect((await checkTableHeaderAlign(page, 16)).failures).toEqual([]);
    await expect(page.locator("table th")).toHaveText(["Date", "Supplier", "Job", "Paid by", "Total"]);
  });
});

test.describe("Expenses list (foreman and accountant)", () => {
  test("a foreman sees what was bought and who paid, with no amounts and nothing to open", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
    await expect(page.locator("[data-expense-total]")).toHaveCount(0);
    await expect(page.locator("[data-expense-totals]")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/\$|GST|reimburse/i);
    await expect(page.locator('[data-screen="expenses"] a[href^="/expenses/"]:not([href^="/expenses/new"])')).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the HTML and the data have no money for a foreman on any state", async ({ page }) => {
    await signInAs(page, "foreman");
    await expectNoMoney(page, [
      "/expenses",
      `/expenses?job=${meta.projects.smith}`,
      `/expenses?job=${meta.projects.smith}&stage=${meta.stages.smithSheetInstall}`,
      "/expenses?demo=empty",
      "/expenses?demo=loading",
      "/expenses?demo=error",
      "/expenses?demo=offline",
    ]);
  });

  test("an accountant reads the list but has no Add expense", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
    await expect(page.locator("[data-expense-totals]")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add expense" })).toHaveCount(0);
  });
});
