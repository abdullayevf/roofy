import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, checkFirstRowTop, checkMoneyFigureFont, checkSidebarSpansPage, checkTableEdgeGap, checkTableHeaderAlign, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const isPhone = (name: string) => name !== "desktop";
const dimaName = seed.crewMembers.find((c) => c.id === meta.crew.dima)!.name;

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}
const rows = (page: Page) => page.locator("[data-history-row]:visible");
/** Each visible row's sentence and (when shown) its job name. */
const readRows = (page: Page) =>
  rows(page).evaluateAll((els) =>
    els.map((el) => ({
      what: (el.querySelector("[data-history-what]") as HTMLElement).innerText.replace(/\u00a0/g, " ").trim(),
      job: (el.querySelector("[data-history-job]") as HTMLElement | null)?.innerText.replace(/\u00a0/g, " ").trim() ?? "",
    })),
  );

test.describe("Record history (screen 25)", () => {
  test("lists changes in plain words with who and when, never table or field names", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/history");
    await expect(page.getByRole("heading", { level: 1, name: "Record history" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(5);
    const all = await readRows(page);
    const receipt = all.find((r) => r.what.includes("receipt"))!;
    expect(receipt.what).toMatch(/^Changed total from \$[\d,]+\.\d{2} to \$[\d,]+\.\d{2} on Harbour Steel Supply receipt$/);
    expect(all.filter((r) => /\bof \$[\d,]+\.\d{2}/.test(r.what) && !/\b(advance|rate) of \$/.test(r.what)), 'D20/F7: an amount says what it is for ("advance of $300.00", "$12.00 pay adjustment"), never a bare "of $12.00"').toEqual([]);
    expect(all.filter((r) => /\S Pay run/.test(r.what)), "D20: pay run is lower case inside a sentence").toEqual([]);
    expect(all.filter((r) => /pause reason|status from \w+ to (paused|active|done)/.test(r.what)), "N11: a pause or restart reads as a sentence").toEqual([]);
    expect((await checkMoneyFigureFont(page, '[data-screen="history"]')).failures, "N17: money in a sentence is in figure style").toEqual([]);
    const text = (await rows(page).allInnerTexts()).join("\n");
    expect(text, "no raw table or field names").not.toMatch(/[a-z]+_[a-z]+|[a-z][A-Z][a-z]|\b(Cents|undefined|null)\b/);
    // Who and when: three short lines under the sentence on a phone, the Who and When columns on desktop.
    const first = rows(page).first();
    const phone = isPhone(testInfo.project.name);
    const who = phone ? first.locator("p").nth(1) : first.locator("td").nth(1);
    const when = phone ? first.locator("p").nth(2) : first.locator("td").nth(0);
    await expect(who).toContainText("Dan Holt");
    await expect(when).toContainText(/\d{1,2}:\d{2}\s[ap]m$/);
    if (!phone) {
      const heads = await page.locator("table thead th").allInnerTexts();
      expect(heads.slice(0, 3), "desktop columns").toEqual(["When", "Who", "What changed"]);
    }
    if (isPhone(testInfo.project.name)) expect((await checkBackRow(page)).failures).toEqual([]);
    else {
      expect((await checkTableEdgeGap(page)).failures).toEqual([]);
      expect((await checkTableHeaderAlign(page)).failures).toEqual([]);
      expect((await checkSidebarSpansPage(page)).failures, "D18: the sidebar background runs the whole page").toEqual([]);
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an Owner reads it too; the Showing line only appears under a filter", async ({ page }) => {
    await signInAs(page, "owner", "/history");
    expect(await rows(page).count()).toBeGreaterThan(5);
    await expect(page.locator("[data-history-showing]")).toHaveCount(0);
  });

  for (const state of ["loading", "error", "offline", "empty"] as const) {
    test(`${state} state renders healthy`, async ({ page }, testInfo) => {
      await signInAs(page, "manager", `/history?demo=${state}`);
      await expect(page.getByRole("heading", { level: 1, name: "Record history" })).toBeVisible();
      if (state === "error") await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      if (state === "offline") {
        await expect(page.getByText(/^Lists updated .+ ago\.$/)).toBeVisible();
        expect(await rows(page).count(), "reads stay available offline").toBeGreaterThan(5);
        await expect(page.getByText(/will send automatically/), "D2: a read-only screen has nothing to send later").toHaveCount(0);
      }
      if (state === "empty") await expect(page.getByText(/^No changes yet\./)).toBeVisible();
      if (state !== "loading") await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    });
  }

  test("an Accountant and a Foreman get no permission, and no rows or money", async ({ page }) => {
    for (const role of ["accountant", "foreman"]) {
      await signInAs(page, role, "/history");
      await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
      await expect(page.locator("[data-history-row]")).toHaveCount(0);
    }
    await expectNoMoney(page, ["/history", `/history?job=${meta.projects.smith}`, `/history?crew=${meta.crew.dima}`]);
  });

  test("on a phone on its side the no-access page sits in the same column as the screens (N5)", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    await page.setViewportSize({ width: 844, height: 390 });
    const title = (name: string) => page.getByRole("heading", { level: 1, name });
    await signInAs(page, "manager", "/history");
    const screenX = (await title("Record history").boundingBox())!.x;
    await signInAs(page, "foreman", "/history");
    const noAccessX = (await title("No access").boundingBox())!.x;
    expect(noAccessX, "left edge is the screens' left edge, which is clear of the safe-area inset").toBeCloseTo(screenX, 0);
    expect(noAccessX).toBeGreaterThanOrEqual(16);
  });
});

test.describe("Record history filters (from job detail and crew detail)", () => {
  test("the filters collapse to one row, so the first change is in the first screen on a phone and on its side (F2/D26)", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    await signInAs(page, "manager", "/history");
    expect((await checkFirstRowTop(page, 300)).failures).toEqual([]);
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "manager", "/history");
    expect((await checkFirstRowTop(page, 390 - 100)).failures).toEqual([]);
  });

  test("a job's link shows only that job's changes, with Showing and Clear", async ({ page }, testInfo) => {
    // The full list says which job each change is about.
    await signInAs(page, "manager", "/history");
    const everything = await readRows(page);
    const expected = everything.filter((r) => r.job.startsWith("Smith job")).map((r) => r.what);
    expect(expected.length, "the Smith job has changes").toBeGreaterThan(0);
    expect(expected.length, "other jobs have some too").toBeLessThan(everything.length);

    await page.goto(`/jobs/${meta.projects.smith}`);
    await page.locator(`[data-screen="job-detail"] a[href="/history?job=${meta.projects.smith}"]:visible`).first().click();
    await expect(page).toHaveURL(new RegExp(`/history\\?job=${meta.projects.smith}$`));
    const showing = page.locator("[data-history-showing]");
    await expect(showing).toContainText(/^Showing Smith job/);
    expect((await readRows(page)).map((r) => r.what)).toEqual(expected);
    await expect(page.locator("[data-history-job]:visible"), "the job column is dropped: it is the same job").toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });

    await showing.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/history$/);
    expect(await rows(page).count()).toBe(everything.length);
  });

  test("a crew member's link shows only that person's changes", async ({ page }, testInfo) => {
    await page.goto("/");
    await signInAs(page, "manager", `/crew/${meta.crew.dima}`);
    await page.locator(`a[href="/history?crew=${meta.crew.dima}"]:visible`).first().click();
    await expect(page).toHaveURL(new RegExp(`/history\\?crew=${meta.crew.dima}$`));
    await expect(page.locator("[data-history-showing]")).toContainText(`Showing ${dimaName}`);
    const whats = (await readRows(page)).map((r) => r.what);
    expect(whats.length).toBeGreaterThan(0);
    expect(whats.some((w) => /^Added Dima's advance of \$[\d,]+\.\d{2}$/.test(w)), "Dima's advance").toBe(true);
    expect(whats.filter((w) => w.includes("Sam's")), "nothing about Sam").toEqual([]);
    expect(whats.filter((w) => w.includes("receipt")), "no receipt of someone else's").toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("the Job and Crew filters are on the page, Show applies them and Clear is a 48 px target (N14)", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/history");
    const filters = page.locator("[data-history-filters]");
    await expect(filters).toBeVisible();
    await expect(filters.getByLabel("Job"), "D26: the filters rest as one Change row").toBeHidden();
    await expect(filters.getByText("All jobs, everyone")).toBeVisible();
    await filters.getByText("Change", { exact: true }).click();
    await expect(filters.getByLabel("Job")).toBeVisible();
    await expect(filters.getByLabel("Crew")).toBeVisible();
    const everything = await readRows(page);
    await filters.getByLabel("Job").selectOption(meta.projects.smith);
    await filters.getByRole("button", { name: "Show" }).click();
    await expect(page).toHaveURL(new RegExp(`job=${meta.projects.smith}`));
    const showing = page.locator("[data-history-showing]");
    await expect(showing).toContainText(/^Showing Smith job/);
    await expect(filters.getByLabel("Job"), "the choice stays chosen").toHaveValue(meta.projects.smith);
    expect((await readRows(page)).length, "fewer changes under a filter").toBeLessThan(everything.length);

    const clear = (await showing.getByRole("link", { name: "Clear" }).boundingBox())!;
    expect(clear.height, "Clear is a 48 px target").toBeGreaterThanOrEqual(48);
    expect(clear.width, "Clear is a 48 px target").toBeGreaterThanOrEqual(48);
    // No hole under the filter row: the list starts one section gap below it.
    const list = (await rows(page).first().boundingBox())!;
    const head = (await showing.boundingBox())!;
    const header = isPhone(testInfo.project.name) ? 0 : ((await page.locator("table thead").boundingBox())?.height ?? 0);
    expect(list.y - header - (head.y + head.height), "N14: the gap under the filter row is one section gap (32 or 40 px, plus a border)").toBeLessThanOrEqual(48);

    await filters.getByText("Change", { exact: true }).click();
    await filters.getByLabel("Job").selectOption("");
    await filters.getByLabel("Crew").selectOption(meta.crew.dima);
    await filters.getByRole("button", { name: "Show" }).click();
    await expect(showing).toContainText(`Showing ${dimaName}`);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("a job with nothing yet is still named, and says so", async ({ page }) => {
    await signInAs(page, "manager", `/history?job=${meta.fixtures.longNames}`);
    await expect(page.locator("[data-history-showing]")).toContainText(/^Showing /);
    await expect(page.getByText(/^No changes yet\.$/), "D16: the name is said once, in the Showing line").toBeVisible();
    await expect(page.getByText(/^No changes for /)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Show all changes" })).toBeVisible();
  });
});
