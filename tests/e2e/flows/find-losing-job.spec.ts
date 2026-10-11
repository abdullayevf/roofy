// Flow: Find the job losing money and why (flows.md 194–207): from Home's Needs attention, open the stage trending over
// and then the lines behind its forecast labour, in at most 3 taps.
import { expect, test } from "@playwright/test";
import { getSeed } from "../../../src/data/fake/store";
import { Taps } from "../taps";
import { collectConsole, expectScreenHealthy } from "../guards";
import { expectNoMoney } from "../money-scan";

const { meta } = getSeed();

test("from Home, a manager finds the Smith job trending over and the lines behind it within 3 taps", async ({
  page,
}, testInfo) => {
  const consoleLog = collectConsole(page);
  await page.goto(`/prototype/role?as=manager&next=${encodeURIComponent("/")}`);
  const taps = new Taps("Find the job losing money");
  const row = page.getByRole("link", {
    name: /^Smith job is trending\s\S+\sover\sbudget\son\ssheet\sinstall\.$/,
  });
  await expect(row).toHaveCount(1);
  await taps.tap(row);
  await expect(page).toHaveURL(new RegExp(`/jobs/${meta.projects.smith}/stages/[^/?]+$`));
  await expect(page.getByText("Forecast labour")).toBeVisible();
  await taps.tap(page.getByRole("link", { name: /^Forecast labour/ }));
  await expect(page).toHaveURL(new RegExp(`/jobs/${meta.projects.smith}/stages/${meta.stages.smithSheetInstall}/forecast$`));
  taps.assertWithin(3);
  await expectScreenHealthy(page, { phone: testInfo.project.name !== "desktop", console: consoleLog });

  // What tap 2 shows (flows.md 202, pay rules E11.1/E12.1): Sam's and Dima's per-unit lines from the 120 m² entry, which make
  // the $1,432.50 so far, and the working: $1,432.50 ÷ 30% done = $4,775.00 against the $4,000.00 budget and $4,200.00 trigger.
  const lines = page.locator("[data-forecast-lines] [data-line-cents]");
  await expect(lines).toHaveCount(2);
  const cents = (await lines.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-line-cents"))))).sort((a, b) => a - b);
  expect(cents, "Dima $720.00 and Sam $570.00 × 1.25 = $712.50").toEqual([71_250, 72_000]);
  expect(cents[0]! + cents[1]!, "the two lines make the labour so far").toBe(143_250);
  const linesText = (await page.locator("[data-forecast-lines]").innerText()).replace(/\u00a0/g, " ");
  expect(linesText).toContain("Sam, Fri 25 Sep");
  expect(linesText).toContain("Dima, Fri 25 Sep");
  // Each line adds up by hand: the pay, then what the job pays on top and the line's cost (review P2-1, P3-2).
  expect(linesText).toContain("60 m² at $9.50 = $570.00, plus 25% on-cost = $712.50");
  expect(linesText).toContain("60 m² at $12.00 = $720.00");
  expect(linesText).toMatch(/Labour so far[\s\S]*\$1,432\.50/);
  await expect(page.locator("[data-forecast-working]")).toHaveText("$1,432.50 ÷ 30% done = $4,775.00");
  // lessons.md: money values use the figure style, never bold body text.
  const working = page.locator("[data-forecast-working]");
  expect(Number(await working.evaluate((e) => getComputedStyle(e).fontWeight)), "working sentence is not bold").toBeLessThan(600);
  await expect(working.locator(".text-figure")).toHaveText(["$1,432.50", "$4,775.00"]);
  const main = (await page.locator('[data-screen="stage-forecast"]').innerText()).replace(/\u00a0/g, " ");
  for (const t of ["$4,000.00", "$4,200.00", "Trending $775.00 over budget"]) expect(main).toContain(t);
});

test("the forecast breakdown is for Owner, Manager and Accountant; a foreman gets no access and no money", async ({ page }) => {
  const route = `/jobs/${meta.projects.smith}/stages/${meta.stages.smithSheetInstall}/forecast`;
  for (const role of ["owner", "manager", "accountant"] as const) {
    await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(route)}`);
    await expect(page.locator("[data-forecast-working]"), role).toHaveText("$1,432.50 ÷ 30% done = $4,775.00");
  }
  await page.goto(`/prototype/role?as=foreman&next=${encodeURIComponent(route)}`);
  await expect(page.locator('[data-screen="stage-forecast"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoMoney(page, [route]);
});
