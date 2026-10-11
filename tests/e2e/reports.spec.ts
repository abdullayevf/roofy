import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, checkMoneyFigureFont, checkNegativeFiguresShareColour, checkOneLine, checkReportFirstScreen, checkTableEdgeGap, checkTableHeaderAlign, checkTableHeadersOneLine, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const MONEY = /^−?\$[\d,]+\.\d{2}$/;

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}
const rows = (page: Page) => page.locator("[data-report-row]:visible");
/** "−$1,234.56" → -123456 cents. */
const cents = (t: string) => Math.round(Number(t.replace("−", "-").replace(/[$,]/g, "")) * 100);

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

  test("hub figures are real: pace for productivity, pay counts only approved and exported runs", async ({ page }) => {
    await signInAs(page, "manager", "/reports");
    const card = (name: string) => page.locator("[data-report-card]").filter({ has: page.getByRole("link", { name: new RegExp(`^${name}`) }) });
    await expect(card("Productivity").locator("[data-figure]")).toHaveText(/ (m²|lm)$|^\d/);
    await expect(card("Productivity")).toContainText(/a crew-day/);
    const paidLine = (await card("Pay history").innerText()).match(/Paid in (\d+) pay runs?/);
    expect(paidLine).not.toBeNull();
    await signInAs(page, "manager", "/reports/pay-history");
    const all = await rows(page).count();
    const drafts = await rows(page).filter({ hasText: "Draft" }).count();
    expect(drafts).toBeGreaterThan(0);
    expect(Number(paidLine![1])).toBe(all - drafts);
  });

  for (const state of ["loading", "error", "offline", "empty"] as const) {
    test(`${state} state renders healthy`, async ({ page }, testInfo) => {
      await signInAs(page, "owner", `/reports?demo=${state}`);
      await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
      if (state === "error") await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      if (state === "offline") await expect(page.getByText(/^Lists updated .+ ago\.$/)).toBeVisible();
      if (state === "empty") {
        await expect(page.getByText("Nothing to report yet. Reports fill in once the crew logs work.")).toBeVisible();
        await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();
        await expect(page.locator("[data-report-list]")).toHaveCount(0);
      }
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

test.describe("Report page layout (Task 18 fix 1b)", () => {
  const KINDS = ["job-profitability", "crew", "productivity", "pauses", "pay-history"] as const;
  for (const kind of KINDS) {
    test(`${kind}: one key figure under the title, data in the first screen, figures on one line`, async ({ page }) => {
      await signInAs(page, "manager", `/reports/${kind}`);
      await expect(page.locator("[data-key-figure]")).toHaveCount(1);
      await expect(page.locator("[data-report-range]")).toBeVisible();
      await expect(page.getByRole("link", { name: "Export CSV" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Print" })).toBeEnabled();
      expect((await checkReportFirstScreen(page, { keyFigure: true })).failures).toEqual([]);
      expect((await checkOneLine(page, "[data-screen=report]")).failures).toEqual([]);
      expect((await checkNegativeFiguresShareColour(page)).failures).toEqual([]);
    });
  }

  test("the range is one Change row that opens the filter", async ({ page }) => {
    await signInAs(page, "manager", "/reports/crew");
    await expect(page.getByLabel("From")).toBeHidden();
    await page.getByText("Change", { exact: true }).click();
    await expect(page.getByLabel("From")).toBeVisible();
  });

  test("the hub is one grouped list, not a grid of cards, with figures on one line", async ({ page }) => {
    await signInAs(page, "manager", "/reports");
    await expect(page.locator("[data-report-list]")).toHaveCount(1);
    await expect(page.locator("[data-report-card] a").first()).toHaveCSS("border-top-width", "0px");
    expect((await checkReportFirstScreen(page, { keyFigure: false })).failures).toEqual([]);
    expect((await checkOneLine(page, "[data-screen=reports]")).failures).toEqual([]);
  });

  test("pay history lists approved and exported runs before drafts", async ({ page }) => {
    await signInAs(page, "manager", "/reports/pay-history");
    const isDraft = await rows(page).evaluateAll((els) => els.map((e) => /Draft/.test(e.textContent ?? "")));
    expect(isDraft.includes(true)).toBe(true);
    expect(isDraft.lastIndexOf(false)).toBeLessThan(isDraft.indexOf(true));
  });

  test("pauses give the reason in plain words", async ({ page }) => {
    await signInAs(page, "manager", "/reports/pauses");
    for (const text of await rows(page).allInnerTexts())
      expect(text).toMatch(/Held up by weather|Waiting on materials|Waiting on the client|Crew on another job|Another reason/);
  });

  test("on desktop the headers stay on one line and each drillable row ends in a chevron", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "table layout is desktop only");
    for (const kind of ["job-profitability", "crew", "pauses", "pay-history"]) {
      await signInAs(page, "manager", `/reports/${kind}`);
      expect((await checkTableHeadersOneLine(page)).failures).toEqual([]);
      expect((await checkTableHeaderAlign(page)).failures).toEqual([]);
      expect((await checkTableEdgeGap(page)).failures).toEqual([]);
      const count = await rows(page).count();
      await expect(page.locator("table tbody tr:visible td:last-child svg")).toHaveCount(count);
    }
    await signInAs(page, "manager", "/reports/job-profitability");
    await expect(page.getByRole("columnheader", { name: "To date" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Forecast" })).toBeVisible();
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

  test("a job with a very long name wraps in its row and the page stays healthy", async ({ page }, testInfo) => {
    await signInAs(page, "accountant", "/reports/job-profitability?from=2026-08-01&to=2026-08-31");
    const long = rows(page).filter({ hasText: "Featherstonehaugh-Montgomery estate" });
    await expect(long).toHaveCount(1);
    await expect(long.locator("[data-margin]")).toHaveText(MONEY);
    // The whole name is there (wrapped, not cut) and the row does not push the page sideways.
    expect((await long.innerText()).replace(/\u00a0/g, " ")).toContain("heritage slate and copper roof restoration, east and west wings");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("a Foreman gets no permission on the index and on every report, with no money", async ({ page }) => {
    const paths = ["/reports", ...["job-profitability", "crew", "productivity", "pauses", "pay-history"].map((k) => `/reports/${k}`)];
    await signInAs(page, "foreman", "/reports");
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
      await expect(page.locator("[data-report-row], [data-report-card]")).toHaveCount(0);
    }
    await expectNoMoney(page, paths);
  });

  test("a chosen range filters the rows and offers the default back", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/reports/crew?from=2026-09-21&to=2026-09-27");
    await expect(page.locator("[data-report-range]")).toHaveText("Mon 21 Sep to Sun 27 Sep");
    await expect(page.getByRole("link", { name: "Show the last 3 months" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("job profitability follows the range: empty range has no rows, another range other figures", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/reports/job-profitability?from=2020-01-01&to=2020-01-31");
    await expect(page.getByText("Nothing in this range. Try a longer range.")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator("[data-key-figure]")).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    await signInAs(page, "manager", "/reports/job-profitability?from=2026-09-21&to=2026-09-27");
    const week = await page.locator("[data-key-figure]").innerText();
    const weekRows = await rows(page).count();
    await signInAs(page, "manager", "/reports/job-profitability?from=2026-01-01&to=2026-09-27");
    await expect(page.locator("[data-key-figure]")).toHaveCount(1);
    expect(await page.locator("[data-key-figure]").innerText()).not.toBe(week);
    expect(await rows(page).count()).toBeGreaterThan(weekRows);
  });

  test("job profitability puts the lowest margin first", async ({ page }) => {
    await signInAs(page, "manager", "/reports/job-profitability?from=2026-01-01&to=2026-09-27");
    const margins = (await page.locator("[data-report-row]:visible [data-margin]").allInnerTexts()).map(cents);
    expect(margins.length).toBeGreaterThan(1);
    expect(margins[0]).toBe(Math.min(...margins));
    expect(margins).toEqual([...margins].sort((a, b) => a - b));
  });

  test("crew shows labour cost per unit by stage", async ({ page }) => {
    await signInAs(page, "manager", "/reports/crew?from=2026-09-01&to=2026-09-27");
    const first = page.locator("[data-report-row]:visible [data-cost-per-unit]").first();
    await expect(first).toHaveText(/\s\$[\d,]+\.\d{2}\s(a\s(m²|lm)|each)$/);
    expect((await checkOneLine(page, "[data-screen=report]")).failures).toEqual([]);
  });

  test("a range with nothing in it says so and keeps the filter", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/reports/crew?from=2020-01-01&to=2020-01-31");
    await expect(page.getByText("Nothing in this range. Try a longer range.")).toBeVisible();
    await expect(page.getByLabel("From")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Print" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Show the last 3 months" })).toHaveCount(1);
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
    for (const f of await page.locator("[data-report-row]:visible [data-pace]").all()) await expect(f).toHaveText(/^[\d,.]+(\s(m²|lm))?$/);
    for (const r of await rows(page).all()) await expect(r).toContainText(/a crew-day/);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("productivity over one week labels rows with the week, not the month, under one key figure", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/reports/productivity?from=2026-09-21&to=2026-09-27");
    expect(await rows(page).count()).toBeGreaterThan(0);
    await expect(page.locator("[data-report-row]:visible", { hasText: "September 2026" })).toHaveCount(0);
    await expect(page.locator("[data-key-figure]")).toHaveCount(1);
    await expect(page.locator("[data-key-figure]")).toContainText(/a crew-day/);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("pauses lists working days lost and opens the paused stage", async ({ page }, testInfo) => {
    await signInAs(page, "owner", "/reports/pauses?from=2026-09-01&to=2026-09-27");
    await expect(page.getByRole("heading", { level: 1, name: "Pauses" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    const row = page.locator(`[data-report-screen] a[href="/jobs/${meta.projects.patel}/stages/${patelSheet.id}"]:visible`);
    await expect(row).toHaveCount(1);
    if (isPhone(testInfo.project.name)) await expect(row).toContainText("3 working days");
    else {
      // Desktop is a table: the unit sits in the column header, the figure alone in its cell.
      const tr = row.locator("xpath=ancestor::tr[@data-report-row]");
      await expect(page.locator("[data-report-screen] table thead th").last()).toHaveText("Working days lost");
      await expect(tr.locator("td").last()).toHaveText("3");
    }
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
