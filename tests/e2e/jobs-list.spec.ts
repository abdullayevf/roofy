import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/jobs") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const cards = (page: Page) => page.locator('[data-screen="jobs"] a[href^="/jobs/"]:not([href="/jobs/new"])');

test.describe("Jobs list (manager)", () => {
  test("opens on Active jobs with a card each: name, address, current stage, tape bar and the three figures", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Active" })).toBeChecked();
    await expect(cards(page)).toHaveCount(5);
    const smith = cards(page).filter({ hasText: "Smith job" });
    await expect(smith).toHaveAttribute("href", `/jobs/${meta.projects.smith}`);
    await expect(smith.getByText("Sheet install")).toBeVisible();
    await expect(smith.getByRole("progressbar")).toBeVisible();
    await expect(smith.getByText("Forecast margin", { exact: true })).toBeVisible();
    await expect(smith.getByText("Labour so far", { exact: true })).toBeVisible();
    // Smith is trending over on its labour budget: said in words under the tape, with the amount.
    await expect(smith.getByText("Trending $775.00 over its labour budget")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add job" })).toHaveAttribute("href", "/jobs/new");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
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

  test("job names keep their hyphenated words whole", async ({ page }) => {
    await signInAs(page, "manager");
    const nowrap = await cards(page).filter({ hasText: "Smith job" }).locator("span.whitespace-nowrap", { hasText: "re-roof" }).count();
    expect(nowrap).toBeGreaterThan(0);
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
    await expect(cards(page).first().getByRole("progressbar")).toBeVisible();
    await expect(page.getByText("Forecast margin")).toHaveCount(0);
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
