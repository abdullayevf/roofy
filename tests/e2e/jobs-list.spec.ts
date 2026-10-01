import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/jobs") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

// A phone row and a desktop table row are both in the page; only the one for this width shows.
const cards = (page: Page) => page.locator('[data-screen="jobs"] a[href^="/jobs/"]:not([href="/jobs/new"]):visible');
const jobRows = (page: Page) => page.locator('[data-screen="jobs"] [data-job-row]:visible');

test.describe("Jobs list (manager)", () => {
  test("opens on Active jobs with a row each: name, one status line, tape bar and the labour figure", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Active" })).toBeChecked();
    await expect(cards(page)).toHaveCount(5);
    const smith = cards(page).filter({ hasText: "Smith job" });
    await expect(smith).toHaveAttribute("href", `/jobs/${meta.projects.smith}`);
    // Smith is trending over on one stage: the line names the stage that owns the amount (i1-F1).
    await expect(jobRows(page).filter({ hasText: "Smith job" }).getByText("Sheet install is trending $775.00 over")).toBeVisible();
    if (isPhone(testInfo.project.name)) await expect(smith.getByRole("progressbar")).toBeVisible();
    await expect(jobRows(page).filter({ hasText: "Smith job" }).getByText(/^of \$[\d,]+\.\d{2}$/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Add job" })).toHaveAttribute("href", "/jobs/new");
    // The lead line counts the jobs already over budget (D5).
    await expect(page.getByText(/^(\d+ jobs? over budget|No jobs over budget)$/)).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a row stays short: at most 120 px on a phone when its name and status fit on a line, 160 when they wrap; 56 px in the desktop table (i1-F5)", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/jobs?status=all");
    const desktop = testInfo.project.name === "desktop";
    const rows = await jobRows(page).evaluateAll((els) =>
      els.map((el) => {
        const h = (sel: string) => Math.round(el.querySelector(sel)?.getBoundingClientRect().height ?? 0);
        return { row: Math.round(el.getBoundingClientRect().height), name: h("[data-job-name]"), status: h("[data-job-status]") };
      }),
    );
    expect(rows.length).toBeGreaterThan(5);
    if (desktop) {
      for (const r of rows) expect(r.row).toBeLessThanOrEqual(56);
      // The table uses the content width, not a phone column (D1).
      const table = (await page.locator('[data-screen="jobs"] table').boundingBox())!;
      expect(table.width).toBeGreaterThan(900);
      return;
    }
    const oneLine = rows.filter((r) => r.name <= 28 && r.status <= 28);
    expect(oneLine.length).toBeGreaterThan(5);
    for (const r of oneLine) expect(r.row).toBeLessThanOrEqual(120);
    for (const r of rows) expect(r.row).toBeLessThanOrEqual(160);
  });

  test("Add job is under the thumb on a phone: in the bottom third of the screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "a button beside the title from 1024 px");
    await signInAs(page, "manager");
    const box = (await page.getByRole("link", { name: "Add job" }).boundingBox())!;
    const height = page.viewportSize()!.height;
    expect(box.y).toBeGreaterThan(height * 0.66);
    expect(box.height).toBeGreaterThanOrEqual(48);
  });

  test("a finished job says all its stages are done, not that none started (i1-F4)", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?status=complete");
    await expect(jobRows(page).first()).toContainText("All stages done");
    await expect(page.getByText("No stage started")).toHaveCount(0);
  });

  test("the filter changes the list and the address, and says so when there are none", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("radio", { name: "On hold" }).click();
    await expect(page).toHaveURL(/\/jobs\?status=on_hold$/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Kelly");
    await expect(cards(page).first().getByText("On hold", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Quoted" }).click();
    await expect(page.getByText("No quoted jobs.")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole("radio", { name: "Complete" }).click();
    // A long history: the first 20 show, the rest open in place.
    await expect(cards(page)).toHaveCount(20);
    await page.getByRole("button", { name: "Show 12 more" }).click();
    await expect(cards(page)).toHaveCount(32);
    await page.getByRole("button", { name: "Show fewer" }).click();
    await expect(cards(page)).toHaveCount(20);
    await page.getByRole("radio", { name: "Active" }).click();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(cards(page)).toHaveCount(5);
  });

  test("a filter in the address is honoured and keeps a demo state across a pick", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?status=complete&demo=offline");
    await expect(page.getByRole("radio", { name: "Complete" })).toBeChecked();
    await expect(cards(page)).toHaveCount(20);
    await page.getByRole("radio", { name: "All" }).click();
    await expect(page).toHaveURL(/status=all/);
    await expect(page).toHaveURL(/demo=offline/);
    await expect(page.getByRole("status")).toContainText("No signal");
  });

  test("a status that isn't real falls back to Active", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?status=nonsense");
    await expect(page.getByRole("radio", { name: "Active" })).toBeChecked();
    await expect(cards(page)).toHaveCount(5);
  });

  test("a new workspace says so and offers the first job", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs?demo=empty");
    await expect(page.getByText("No jobs yet. Add your first job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your first job" })).toHaveAttribute("href", "/jobs/new");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("loading shows blocks shaped like the cards, with the real title and filter", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs?demo=loading");
    await expect(page.locator('[data-screen="jobs"]')).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an error keeps the title and filter and offers Try again", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    await expect(page.locator('[data-screen="jobs"] [role="alert"]')).toContainText("Couldn't load this. Try again.");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Active" })).toBeVisible();
    // Add job stays within reach on the error state too (pinned on a phone, beside the title on desktop).
    await expect(page.getByRole("link", { name: "Add job" })).toHaveAttribute("href", "/jobs/new");
  });

  test("no permission says so plainly with a way back", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();
  });

  test("is healthy with the offline banner and in the long names' column at 200% text", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs?status=all&demo=offline");
    await expect(page.getByRole("status")).toContainText("No signal");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("job names keep their hyphenated words whole: no line break inside re-roof", async ({ page }) => {
    await signInAs(page, "manager");
    const lines = await cards(page)
      .filter({ hasText: "Smith job" })
      .first()
      .evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const at = n.textContent?.indexOf("re-roof") ?? -1;
          if (at < 0) continue;
          const range = document.createRange();
          range.setStart(n, at);
          range.setEnd(n, at + "re-roof".length);
          return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        }
        return -1;
      });
    expect(lines).toBe(1);
  });

  test("a long list has a search by name or address; a short one has none (i1-D14)", async ({ page }) => {
    await signInAs(page, "manager");
    await expect(page.getByRole("searchbox", { name: "Search jobs" })).toHaveCount(0);
    await page.getByRole("radio", { name: "All" }).click();
    const search = page.getByRole("searchbox", { name: "Search jobs" });
    await expect(search).toBeVisible();
    await search.fill("Smith job");
    await expect(jobRows(page).filter({ hasText: "Smith job" })).toHaveCount(1);
    expect(await jobRows(page).count()).toBeLessThan(20);
    await search.fill("zzzz");
    await expect(page.getByText("No job matches")).toBeVisible();
    await expect(jobRows(page)).toHaveCount(0);
  });
});

test.describe("Jobs list (foreman)", () => {
  test("shows only their jobs, with progress and no money, and no Add job", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    const n = await cards(page).count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(5);
    if (isPhone(testInfo.project.name)) await expect(cards(page).first().getByRole("progressbar")).toBeVisible();
    await expect(page.getByText("Forecast margin")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Margin" })).toHaveCount(0);
    // Two assigned jobs need no filter (i1-F12).
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Add job" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the HTML and the data have no money on any state", async ({ page }) => {
    await signInAs(page, "foreman");
    await expectNoMoney(page, ["/jobs", "/jobs?status=all", "/jobs?status=complete", "/jobs?demo=empty", "/jobs?demo=loading", "/jobs?demo=error", "/jobs?demo=offline", "/jobs?demo=noperm"]);
  });

  test("with no jobs says they can see jobs once a manager adds them, with no Add job", async ({ page }) => {
    await signInAs(page, "foreman", "/jobs?demo=empty");
    await expect(page.getByText("You can see jobs once a manager adds you to one.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Add (your first )?job/ })).toHaveCount(0);
    // One sentence and nothing to tap: the log it would lead to has no job in it.
    await expect(page.locator('[data-screen="jobs"] a[href]')).toHaveCount(0);
  });

  test("cannot open New job or Edit job", async ({ page }) => {
    await signInAs(page, "foreman", "/jobs/new");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await page.goto(`/jobs/${meta.projects.smith}/edit`);
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});

test.describe("Jobs list (accountant)", () => {
  test("can read the list but not add a job", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Add job" })).toHaveCount(0);
    await page.goto("/jobs/new");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
