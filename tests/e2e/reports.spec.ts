import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, checkMoneyFigureFont, checkTableEdgeGap, checkTableHeaderAlign, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const MONEY = /^−?\$[\d,]+\.\d{2}$/;

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}
const rows = (page: Page) => page.locator("[data-report-row]:visible");

test.describe("Reports index (screen 22)", () => {
  test("shows the five report cards, each with its key figure, and opens Job profitability", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    const cards = page.locator("[data-report-card]");
    await expect(cards).toHaveCount(5);
    for (const name of ["Job profitability", "Crew", "Productivity", "Pauses", "Pay history"])
      await expect(cards.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
    for (const f of await page.locator("[data-report-card] [data-figure]").all()) await expect(f).not.toBeEmpty();
    await expect(page.locator("[data-report-range]")).toHaveText("Mon 29 Jun to Mon 28 Sep");
    expect((await checkMoneyFigureFont(page, '[data-screen="reports"]')).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await cards.getByRole("link", { name: /^Job profitability/ }).click();
    await expect(page).toHaveURL(/\/reports\/job-profitability$/);
  });

  for (const state of ["loading", "error", "offline", "empty"] as const) {
    test(`${state} state renders healthy`, async ({ page }, testInfo) => {
      await signInAs(page, "owner", `/reports?demo=${state}`);
      await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
      if (state === "error") await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      if (state === "offline") await expect(page.getByText(/^Lists updated .+ ago\.$/)).toBeVisible();
      if (state === "empty") await expect(page.getByText("Nothing to report yet. Reports fill in once the crew logs work.")).toBeVisible();
      if (state !== "loading") await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    });
  }

  test("an accountant reads reports; a foreman gets no permission and no money", async ({ page }) => {
    await signInAs(page, "accountant", "/reports");
    await expect(page.locator("[data-report-card]")).toHaveCount(5);
    await signInAs(page, "foreman", "/reports");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expectNoMoney(page, ["/reports", "/reports/job-profitability", "/reports/crew"]);
  });
});

test.describe("Job profitability and Crew reports", () => {
  test("job profitability lists jobs with margins and drills into the job", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/reports/job-profitability");
    await expect(page.getByRole("heading", { level: 1, name: "Job profitability" })).toBeVisible();
    expect((await checkBackRow(page)).failures).toEqual([]);
    await expect(page.getByLabel("From")).toHaveValue("2026-06-29");
    await expect(page.getByLabel("To")).toHaveValue("2026-09-28");
    expect(await rows(page).count()).toBeGreaterThan(0);
    for (const f of await page.locator("[data-report-row]:visible [data-margin]").all()) await expect(f).toHaveText(MONEY);
    expect((await checkMoneyFigureFont(page, '[data-screen="report"]')).failures).toEqual([]);
    if (!isPhone(testInfo.project.name)) {
      expect((await checkTableEdgeGap(page)).failures).toEqual([]);
      expect((await checkTableHeaderAlign(page)).failures).toEqual([]);
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    const smith = page.locator(`[data-report-screen] a[href="/jobs/${meta.projects.smith}"]:visible`);
    await expect(smith).toHaveCount(1);
    await smith.click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${meta.projects.smith}$`));
  });

  test("crew lists each person's days, hours and earnings and drills into crew detail", async ({ page }, testInfo) => {
    await signInAs(page, "owner", "/reports/crew");
    await expect(page.getByRole("heading", { level: 1, name: "Crew" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(0);
    for (const f of await page.locator("[data-report-row]:visible [data-earned]").all()) await expect(f).toHaveText(MONEY);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    const dima = page.locator(`[data-report-screen] a[href="/crew/${meta.crew.dima}"]:visible`);
    await expect(dima).toHaveCount(1);
    await dima.click();
    await expect(page).toHaveURL(new RegExp(`/crew/${meta.crew.dima}$`));
  });

  test("a chosen range filters the rows and offers the default back", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/reports/crew?from=2026-09-21&to=2026-09-27");
    await expect(page.locator("[data-report-range]")).toHaveText("Mon 21 Sep to Sun 27 Sep");
    await expect(page.getByRole("link", { name: "Show the last 3 months" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("a range with nothing in it says so and keeps the filter", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/reports/crew?from=2020-01-01&to=2020-01-31");
    await expect(page.getByText("Nothing in this range. Try a longer range.")).toBeVisible();
    await expect(page.getByLabel("From")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  for (const state of ["loading", "error", "offline"] as const) {
    test(`job profitability ${state} state renders healthy`, async ({ page }, testInfo) => {
      await signInAs(page, "owner", `/reports/job-profitability?demo=${state}`);
      await expect(page.getByRole("heading", { level: 1, name: "Job profitability" })).toBeVisible();
      if (state === "error") await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      if (state === "offline") await expect(rows(page).first()).toBeVisible();
      if (state !== "loading") await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    });
  }

  test("an unknown kind is not found", async ({ page }) => {
    await signInAs(page, "manager", "/reports/margins");
    await expect(page.getByRole("heading", { level: 1, name: "Job profitability" })).toHaveCount(0);
    expect((await page.request.get("/reports/margins")).status()).toBe(404);
  });
});
