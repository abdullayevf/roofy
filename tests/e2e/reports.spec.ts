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

test.describe("Productivity, Pauses and Pay history reports; Export CSV and Print", () => {
  const patelSheet = getSeed().stages.find((s) => s.projectId === meta.projects.patel && s.name === "Sheet install")!;

  test("productivity shows each stage's pace per crew-day", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/reports/productivity");
    await expect(page.getByRole("heading", { level: 1, name: "Productivity" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(0);
    for (const f of await page.locator("[data-report-row]:visible [data-pace]").all()) await expect(f).toHaveText(/a crew-day$/);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("pauses lists working days lost and opens the paused stage", async ({ page }, testInfo) => {
    await signInAs(page, "owner", "/reports/pauses?from=2026-09-01&to=2026-09-27");
    await expect(page.getByRole("heading", { level: 1, name: "Pauses" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    const row = page.locator(`[data-report-screen] a[href="/jobs/${meta.projects.patel}/stages/${patelSheet.id}"]:visible`);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("3 working days");
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${meta.projects.patel}/stages/${patelSheet.id}$`));
  });

  test("pay history shows each pay run's total and opens the pay run", async ({ page }, testInfo) => {
    await signInAs(page, "accountant", "/reports/pay-history");
    await expect(page.getByRole("heading", { level: 1, name: "Pay history" })).toBeVisible();
    for (const f of await page.locator("[data-report-row]:visible [data-total]").all()) await expect(f).toHaveText(MONEY);
    expect((await checkMoneyFigureFont(page, '[data-screen="report"]')).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    const first = page.locator('[data-report-screen] a[href^="/pay/"]:visible').first();
    await first.click();
    await expect(page).toHaveURL(/\/pay\/[^/?]+$/);
  });

  for (const kind of ["job-profitability", "crew", "productivity", "pauses", "pay-history"]) {
    test(`${kind}: Export CSV downloads the range on screen and Print is offered`, async ({ page }) => {
      await signInAs(page, "accountant", `/reports/${kind}?from=2026-09-01&to=2026-09-27`);
      const csv = page.getByRole("link", { name: "Export CSV" });
      await expect(csv).toHaveAttribute("href", `/reports/${kind}/csv?from=2026-09-01&to=2026-09-27`);
      await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
      const res = await page.request.get(`/reports/${kind}/csv?from=2026-09-01&to=2026-09-27`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/csv");
      expect(res.headers()["content-disposition"]).toContain(`attachment; filename="${kind}-2026-09-01-to-2026-09-27.csv"`);
      expect((await res.text()).split("\r\n").length).toBeGreaterThan(2);
    });
  }

  test("offline, a report still reads and prints; Export CSV says it needs a connection", async ({ page }, testInfo) => {
    await signInAs(page, "owner", "/reports/pauses?demo=offline");
    await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(0);
    await expect(page.getByText("Export CSV needs a connection.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("printed at A4 width, the report has no app chrome, no buttons and no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1123 });
    await signInAs(page, "manager", "/reports/job-profitability");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("heading", { level: 1, name: "Job profitability" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Show range" })).toBeHidden();
    await expect(page.getByRole("navigation")).toHaveCount(await page.getByRole("navigation").and(page.locator(":not(:visible)")).count());
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("a foreman can't download a report", async ({ page }) => {
    await signInAs(page, "foreman", "/");
    const res = await page.request.get("/reports/job-profitability/csv");
    expect(res.status()).toBe(403);
    expect(await res.text()).not.toMatch(/\$|\d+\.\d{2}/);
  });
});
