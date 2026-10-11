import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, checkTableEdgeGap, checkTableHeaderAlign, collectConsole, expectScreenHealthy } from "./guards";
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
});

test.describe("Record history filters (from job detail and crew detail)", () => {
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

  test("a job with nothing yet is still named, and says so", async ({ page }) => {
    await signInAs(page, "manager", `/history?job=${meta.fixtures.longNames}`);
    await expect(page.locator("[data-history-showing]")).toContainText(/^Showing /);
    await expect(page.getByText(/^No changes for .+ yet\.$/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Show all changes" })).toBeVisible();
  });
});
