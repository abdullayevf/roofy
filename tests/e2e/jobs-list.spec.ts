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
    // One exact form per layout: the phone figure names the pair, the table's header does it on desktop (i2-F3).
    const figure = isPhone(testInfo.project.name) ? /^spent of \$[\d,]+\.\d{2} budget$/ : /^of \$[\d,]+\.\d{2}$/;
    await expect(jobRows(page).filter({ hasText: "Smith job" }).getByText(figure)).toBeVisible();
    await expect(page.getByRole("link", { name: "Add job" })).toHaveAttribute("href", "/jobs/new");
    // The lead line counts the jobs already over budget (D5).
    await expect(page.getByText(/^(\d+ jobs? over budget|No jobs over budget)$/)).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a row stays short: at most 120 px on a phone when its name and status fit on a line, 160 when they wrap; 56 px in the desktop table (i1-F5)", async ({ page }, testInfo) => {
    await signInAs(page, "manager", "/jobs?status=all");
    const desktop = testInfo.project.name === "desktop";
    const longId = meta.fixtures.longNames;
    const all = await jobRows(page).evaluateAll((els, id) => {
      const h = (el: Element, sel: string) => Math.round(el.querySelector(sel)?.getBoundingClientRect().height ?? 0);
      return els.map((el) => ({
        row: Math.round(el.getBoundingClientRect().height),
        // The phone row has a name block; in the table the name is the row's link.
        name: h(el, "[data-job-name]") || h(el, 'a[href^="/jobs/"]'),
        status: h(el, "[data-job-status]"),
        long: el.getAttribute("href") === `/jobs/${id}` || el.querySelector(`a[href="/jobs/${id}"]`) !== null,
      }));
    }, longId);
    // The one fixture whose name runs to ~110 characters wraps as far as its name needs (names wrap, never truncate); it is held to
    // "the wrapped name plus the same fixed parts" below, not to the ordinary-row heights.
    const rows = all.filter((r) => !r.long);
    const long = all.filter((r) => r.long);
    expect(long).toHaveLength(1);
    expect(rows.length).toBeGreaterThan(5);
    if (desktop) {
      for (const r of rows) expect(r.row).toBeLessThanOrEqual(56);
      expect(long[0]!.row - long[0]!.name - long[0]!.status).toBeLessThanOrEqual(16);
      // The table uses the content width, not a phone column (D1).
      const table = (await page.locator('[data-screen="jobs"] table').boundingBox())!;
      expect(table.width).toBeGreaterThan(900);
      return;
    }
    const oneLine = rows.filter((r) => r.name <= 28 && r.status <= 28);
    expect(oneLine.length).toBeGreaterThan(5);
    for (const r of oneLine) expect(r.row).toBeLessThanOrEqual(120);
    for (const r of rows) expect(r.row).toBeLessThanOrEqual(160);
    // The long name wraps, and nothing else on its row grows: padding, status line, bar and figure stay the size of any row's.
    expect(long[0]!.row - long[0]!.name - long[0]!.status).toBeLessThanOrEqual(96);
  });

  test("on its side the phone shows Add job in the header row, not pinned, and at least one job on the first screen (i2-F4)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "below 1024 px only");
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "manager");
    await expect(cards(page).first()).toBeVisible();
    await expect(page.locator('[data-slot="primary-action"]:visible')).toHaveCount(0);
    const add = (await page.getByRole("link", { name: "Add job" }).boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1, name: "Jobs" }).boundingBox())!;
    expect(Math.abs(add.y + add.height / 2 - (title.y + title.height / 2))).toBeLessThanOrEqual(16);
    expect(add.height).toBeGreaterThanOrEqual(48);
    // At least 48 px of the first job shows above the tab bar.
    const tabs = (await page.getByRole("navigation", { name: "Primary" }).boundingBox())!;
    const row = (await jobRows(page).first().boundingBox())!;
    expect(row.y + 48).toBeLessThanOrEqual(tabs.y);
  });

  test("the Add job bar is as wide as the list column on a phone and a tablet (i2-D6)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "below 1024 px only");
    for (const size of [{ width: 390, height: 780 }, { width: 820, height: 1180 }]) {
      await page.setViewportSize(size);
      await signInAs(page, "manager");
      await expect(cards(page).first()).toBeVisible();
      const list = (await jobRows(page).first().locator('xpath=ancestor::div[contains(@class,"rounded-group")][1]').boundingBox())!;
      const button = (await page.getByRole("link", { name: "Add job" }).boundingBox())!;
      expect(Math.abs(button.x - list.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(button.width - list.width)).toBeLessThanOrEqual(1);
    }
  });

  test("a phone row's chevron is centred on the row (i2-D10)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "the table has no chevron");
    await signInAs(page, "manager");
    for (const row of await jobRows(page).all()) {
      const box = (await row.boundingBox())!;
      const chevron = (await row.locator(":scope > svg").boundingBox())!;
      expect(Math.abs(chevron.y + chevron.height / 2 - (box.y + box.height / 2))).toBeLessThanOrEqual(2);
    }
  });

  test("the desktop table has a compact tape bar in Done, and every row is the same height (i2-D4, i2-D12)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a table from 1024 px");
    await signInAs(page, "manager", "/jobs?status=all");
    const bars = page.locator('[data-screen="jobs"] table [data-job-row] [role="progressbar"]');
    expect(await bars.count()).toBeGreaterThan(5);
    expect((await bars.first().boundingBox())!.width).toBeGreaterThanOrEqual(80);
    // Every row but the long-name fixture, whose name wraps onto more lines (names wrap, never truncate).
    const longId = meta.fixtures.longNames;
    const heights = await jobRows(page).evaluateAll(
      (els, id) => els.filter((el) => el.querySelector(`a[href="/jobs/${id}"]`) === null).map((el) => Math.round(el.getBoundingClientRect().height)),
      longId,
    );
    expect(heights.length).toBeGreaterThan(5);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  });

  test("Add job is under the thumb on a phone: in the bottom third of the screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "a button beside the title from 1024 px");
    await signInAs(page, "manager");
    const box = (await page.getByRole("link", { name: "Add job" }).boundingBox())!;
    const height = page.viewportSize()!.height;
    expect(box.y).toBeGreaterThan(height * 0.66);
    expect(box.height).toBeGreaterThanOrEqual(48);
  });

  test("a finished job says all its stages are done, or that it went over; never that none started (i1-F4, R9)", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?status=complete");
    await expect(page.getByText("No stage started")).toHaveCount(0);
    for (const row of await jobRows(page).all()) await expect(row).toContainText(/All stages done|over/);
  });

  test("one rule says over: the headline counts the rows that carry an over line (R9: Wong by stage)", async ({ page }) => {
    await signInAs(page, "manager");
    await expect(page.getByText("1 job over budget", { exact: true })).toBeVisible();
    await expect(jobRows(page).filter({ hasText: / is \$[\d,]+\.\d{2} over/ })).toHaveCount(1);
    await expect(jobRows(page).filter({ hasText: "Wong job" }).getByText("Clean-up is $100.00 over")).toBeVisible();
  });

  test("a finished job over its labour budget gets its line (R9: Hunter, $2,120.00 of $2,000.00)", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?status=complete");
    await page.getByRole("searchbox", { name: "Search jobs" }).fill("Hunter job");
    const hunter = jobRows(page).filter({ hasText: "Avalon leak repair" });
    await expect(hunter.getByText("Labour is $120.00 over budget")).toBeVisible();
    await expect(hunter.getByText("Complete", { exact: true })).toBeVisible();
  });

  test("the filter changes the list and the address, and says so when there are none", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("radio", { name: "On hold" }).click();
    await expect(page).toHaveURL(/\/jobs\?status=on_hold$/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Kelly");
    await expect(jobRows(page).first().getByText("On hold: client", { exact: true })).toBeVisible();
    // The two screen fixtures (no stages yet; a very long name) are the quoted jobs.
    await page.getByRole("radio", { name: "Quoted" }).click();
    await expect(page).toHaveURL(/\/jobs\?status=quoted$/);
    await expect(cards(page)).toHaveCount(2);
    // Nothing is closed, so Closed is the filter that says so.
    await page.getByRole("radio", { name: "Closed" }).click();
    await expect(page.getByText("No closed jobs.")).toBeVisible();
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
    if (isPhone(testInfo.project.name)) {
      // The button is pinned like on every other state, not left in the middle of the screen (i2-F14).
      const add = page.getByRole("link", { name: "Add your first job" });
      await expect(add).toHaveAttribute("href", "/jobs/new");
      expect((await add.boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height * 0.66);
    } else {
      await expect(page.getByRole("link", { name: "Add job" })).toHaveAttribute("href", "/jobs/new");
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("loading shows blocks shaped like the cards, with the real title and filter", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs?demo=loading");
    await expect(page.locator('[data-screen="jobs"]')).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    // A line stands where the over-budget headline will be (i2-D8); on desktop the Add job block is beside the title.
    const heights = await page.locator('[data-screen="jobs"] > div').first().locator("span.bg-line:visible").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(heights).toContain(32);
    if (isPhone(testInfo.project.name)) {
      expect(heights).not.toContain(52);
      await expect(page.locator('[data-screen="jobs"] table')).toBeHidden();
    } else {
      // The rows are table-shaped on desktop, not phone cards under a table header (i2-D8).
      expect(heights).toContain(52);
      await expect(page.locator('[data-screen="jobs"] table [data-job-skeleton]')).toHaveCount(4);
      await expect(page.getByRole("columnheader", { name: "Done" })).toBeVisible();
      expect(await page.locator('[data-screen="jobs"] .lg\\:hidden span.bg-line:visible').count()).toBe(0);
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an error keeps the title and filter; Try again is the primary button and there is no Add job (i2-F6)", async ({ page }) => {
    await signInAs(page, "manager", "/jobs?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    await expect(page.locator('[data-screen="jobs"] [role="alert"]')).toContainText("Couldn't load this. Try again.");
    await expect(page.getByRole("button", { name: "Try again" })).toHaveAttribute("data-variant", "primary");
    await expect(page.getByRole("radio", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add job" })).toHaveCount(0);
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
    // The search is above the filter chips (i1-D14).
    const found = (await search.boundingBox())!;
    expect(found.y + found.height).toBeLessThanOrEqual((await page.getByRole("radio", { name: "Active" }).boundingBox())!.y);
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
  test("loading has no Add job block (RR5)", async ({ page }) => {
    await signInAs(page, "accountant", "/jobs?demo=loading");
    await expect(page.locator('[data-screen="jobs"]')).toHaveAttribute("aria-busy", "true");
    const heights = await page.locator('[data-screen="jobs"] > div').first().locator("span.bg-line:visible").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(heights).not.toContain(52);
  });

  test("can read the list but not add a job", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Add job" })).toHaveCount(0);
    await page.goto("/jobs/new");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
