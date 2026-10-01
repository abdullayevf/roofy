import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const smithClientId = seed.projects.find((p) => p.id === meta.projects.smith)!.clientId;
const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
  // Wait for the form to hydrate: a pick made before then is reset to what the server sent.
  await page.waitForLoadState("networkidle");
}

const clientSelect = (page: Page) => page.getByRole("combobox", { name: "Client" });

const createJob = (page: Page) => page.getByRole("button", { name: "Create job", exact: true });
const prefill = (extra: Record<string, string> = {}) =>
  `/jobs/new?${new URLSearchParams({ client: smithClientId, type: "metal_reroof", name: "Smith job — Ryde carport roof", address: "14 Quarry Rd, Ryde", accepted: "1", ...extra })}`;

test.describe("New job", () => {
  test("opens blank with Create job off and one sentence naming everything still to do", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs/new");
    await expect(page.getByRole("heading", { level: 1, name: "New job" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to jobs" })).toHaveAttribute("href", "/jobs");
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Choose a client, choose a job type, name the job, add the site address and accept the stages.")).toBeVisible();
    await expect(page.getByText("Choose a job type to see its stages.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Quick-add client" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("picking a job type proposes the stages from the last job of that type; Accept turns Create job on", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new");
    await clientSelect(page).selectOption({ label: "Mark Smith" });
    await page.getByRole("radio", { name: "Metal re-roof" }).click();
    await expect(page.getByText(/^From your last metal re-roof job, /)).toBeVisible();
    await expect(page.getByRole("list").filter({ hasText: "Sheet install" }).getByRole("listitem")).not.toHaveCount(0);
    await page.getByLabel("Job name").fill("Smith job — Ryde carport roof");
    await page.getByLabel("Site address").fill("14 Quarry Rd, Ryde");
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Accept the stages.")).toBeVisible();
    await page.getByRole("button", { name: "Accept stages" }).click();
    await expect(page.getByText("Stages accepted")).toBeVisible();
    await expect(createJob(page)).toBeEnabled();
    await expect(page.getByText("Accept the stages.")).toHaveCount(0);
  });

  test("a job type with no earlier job proposes the template", async ({ page }) => {
    // A new workspace has no earlier job of any type.
    await signInAs(page, "manager", "/jobs/new?demo=empty");
    await page.getByRole("radio", { name: "New build" }).click();
    await expect(page.getByText("From the new build template.")).toBeVisible();
    await expect(page.getByText("Battens")).toBeVisible();
  });

  test("changing the job type takes the acceptance back", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    await expect(page.getByText("Stages accepted")).toBeVisible();
    await expect(createJob(page)).toBeEnabled();
    await page.getByRole("radio", { name: "New build" }).click();
    await expect(page.getByText("Stages accepted")).toHaveCount(0);
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Accept the stages.")).toBeVisible();
  });

  test("creates the job with the accepted stages and it shows on the list", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    await createJob(page).click();
    const done = page.getByRole("status").filter({ hasText: "Job added" });
    await expect(done).toContainText(/Smith job — Ryde carport roof is ready, with \d+ stages\./);
    await page.getByRole("link", { name: "Back to jobs" }).last().click();
    await expect(page).toHaveURL(/\/jobs$/);
    const card = page.locator('[data-screen="jobs"] a[href^="/jobs/"]:not([href="/jobs/new"])').filter({ hasText: "Ryde carport roof" });
    await expect(card).toBeVisible();
    await expect(card.getByText("No stage started")).toBeVisible();
  });

  test("Edit stages: rename, remove and add a stage, then Accept", async ({ page }) => {
    await signInAs(page, "manager", prefill({ type: "new_build" }));
    await page.getByRole("button", { name: "Edit stages" }).click();
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByLabel("Stage 1 name")).toHaveValue("Battens");
    await page.getByLabel("Stage 1 name").fill("Roof battens");
    await page.getByRole("button", { name: "Remove stage 2" }).click();
    await page.getByRole("button", { name: "Add stage" }).click();
    await page.getByLabel("Stage 5 name").fill("Final clean");
    await page.getByLabel("Stage 5 labour budget").fill("1250");
    await page.getByLabel("Stage 5 labour budget").blur();
    await expect(page.getByLabel("Stage 5 labour budget")).toHaveValue("1,250.00");
    await page.getByRole("button", { name: "Accept stages" }).click();
    await expect(page.getByText("Roof battens")).toBeVisible();
    await expect(page.getByText("Final clean")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Final clean" })).toContainText("$1,250.00");
    await createJob(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Job added" })).toContainText("with 5 stages.");
  });

  test("a stage with no name can't be accepted", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    await page.getByRole("button", { name: "Edit stages" }).click();
    await page.getByRole("button", { name: "Add stage" }).click();
    await expect(page.getByRole("button", { name: "Accept stages" })).toBeDisabled();
    await expect(page.getByText("Give every stage a name.")).toBeVisible();
  });

  test("Quick-add client saves the client and picks them", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new");
    await page.getByRole("button", { name: "Quick-add client" }).click();
    const save = page.getByRole("button", { name: "Save client" });
    await expect(save).toBeDisabled();
    await page.getByLabel("Client name").fill("Jo Nguyen");
    await save.click();
    await expect(page.getByRole("button", { name: "Save client" })).toHaveCount(0);
    await expect(clientSelect(page).locator("option:checked")).toHaveText("Jo Nguyen");
  });

  test("a new workspace has no clients to pick, only Quick-add client", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new?demo=empty");
    await expect(page.getByText("No clients yet. Add the first one.")).toBeVisible();
    await expect(clientSelect(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Quick-add client" })).toBeVisible();
  });

  test("a target finish before the start says so under the field and keeps Create job off", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", prefill({ start: "2026-10-05", finish: "2026-10-01" }));
    await expect(page.getByText("The target finish can't be before the start.")).toBeVisible();
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Move the target finish to after the start.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await page.getByLabel("Target finish (optional)").fill("2026-10-20");
    await expect(page.getByText("The target finish can't be before the start.")).toHaveCount(0);
    await expect(createJob(page)).toBeEnabled();
  });

  test("with no signal Create job is off and says it needs a connection, filled in or not", async ({ page }) => {
    await signInAs(page, "manager", prefill({ demo: "offline" }));
    await expect(page.getByRole("status").filter({ hasText: "No signal" })).toBeVisible();
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Needs connection — try again once you're back online.")).toBeVisible();
  });

  test("losing signal on the page turns Create job off, and getting it back turns it on", async ({ page, context }) => {
    await signInAs(page, "manager", prefill());
    await expect(createJob(page)).toBeEnabled();
    await context.setOffline(true);
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Needs connection — try again once you're back online.")).toBeVisible();
    await context.setOffline(false);
    await expect(createJob(page)).toBeEnabled();
  });

  test("loading shows blocks shaped like the form under the real title", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs/new?demo=loading");
    await expect(page.locator('[data-screen="job-form"]')).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "New job" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an error keeps the title and offers Try again; no permission says so", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "New job" })).toBeVisible();
    await expect(page.locator('[data-screen="job-form"] [role="alert"]')).toContainText("Couldn't load this. Try again.");
    await page.goto("/jobs/new?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });

  test("the filled form is healthy", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", prefill());
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the stage editor is healthy", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", prefill());
    await page.getByRole("button", { name: "Edit stages" }).click();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the Create job bar is pinned and the form has no horizontal overflow", async ({ page }, testInfo) => {
    await signInAs(page, "manager", prefill());
    const bar = page.locator('[data-slot="primary-action"]');
    const pos = await bar.evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe(isPhone(testInfo.project.name) ? "fixed" : "sticky");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe("Edit job", () => {
  const path = `/jobs/${meta.projects.smith}/edit`;

  test("opens filled with the job, no stages, and Save changes off until something changes", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", path);
    await expect(page.getByRole("heading", { level: 1, name: "Edit job" })).toBeVisible();
    await expect(page.getByLabel("Job name")).toHaveValue("Smith job — Ryde re-roof");
    await expect(page.getByLabel("Site address")).toHaveValue("14 Pope St, Ryde NSW 2112");
    await expect(clientSelect(page).locator("option:checked")).toHaveText("Mark Smith");
    await expect(page.getByRole("radio", { name: "Metal re-roof" })).toBeChecked();
    await expect(page.getByLabel("Target finish (optional)")).toHaveValue("2026-10-09");
    await expect(page.getByRole("heading", { level: 2, name: "Stages" })).toHaveCount(0);
    const save = page.getByRole("button", { name: "Save changes", exact: true });
    await expect(save).toBeDisabled();
    await expect(page.getByText("Change something to save.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("saves a change and the list shows it", async ({ page }) => {
    await signInAs(page, "manager", path);
    await page.getByLabel("Job name").fill("Smith job — Ryde re-roof and gutters");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Your changes to Smith job — Ryde re-roof and gutters are saved.");
    await page.getByRole("link", { name: "Back to jobs" }).last().click();
    await expect(page.locator('[data-screen="jobs"] a[href^="/jobs/"]:not([href="/jobs/new"])').filter({ hasText: "and gutters" })).toBeVisible();
  });

  test("the status can change and the job moves to that filter", async ({ page }) => {
    await signInAs(page, "manager", path);
    await page.getByLabel("Status").selectOption("on_hold");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.goto("/jobs?status=on_hold");
    await expect(page.locator('[data-screen="jobs"] a[href^="/jobs/"]:not([href="/jobs/new"])').filter({ hasText: "Smith job" })).toBeVisible();
  });

  test("a job that isn't there is a not-found page; loading and error have their own states", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/no-such-job/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await page.goto(`${path}?demo=loading`);
    await expect(page.locator('[data-screen="job-form"]')).toHaveAttribute("aria-busy", "true");
    await page.goto(`${path}?demo=error`);
    await expect(page.locator('[data-screen="job-form"] [role="alert"]')).toContainText("Couldn't load this. Try again.");
  });
});
