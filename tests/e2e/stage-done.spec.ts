import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const stagePage = `/jobs/${meta.projects.harris}/stages/${meta.stages.harrisRidge}`;
const donePage = `${stagePage}/done`;

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}
const share = (page: Page, name: string) => page.getByLabel(`${name}'s share`, { exact: true });
const confirm = (page: Page) => page.getByRole("button", { name: "Confirm done", exact: true });
const left = (page: Page) => page.locator("[data-shares-left]");

test.describe("Stage done (manager)", () => {
  test("E5.1 proposal: today, Sam/Tom/Dima equal shares with $666.67 / $666.67 / $666.66", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", donePage);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ridge bedding & pointing");
    await expect(page.getByLabel("Finished on")).toHaveValue("2026-09-28");
    await expect(page.getByText(/\$2,000\.00 shared by everyone who logged/)).toBeVisible();
    const rows: [string, string, string][] = [["Sam", "33.34", "$666.67"], ["Tom", "33.33", "$666.67"], ["Dima", "33.33", "$666.66"]];
    for (const [name, pct, amount] of rows) {
      await expect(share(page, name)).toHaveValue(pct);
      await expect(page.locator(`[data-share-row="${name}"]`)).toContainText(amount);
    }
    await expect(left(page)).toHaveText("Shares add up to 100%");
    await expect(confirm(page)).toBeEnabled();
    await expect(page.getByRole("link", { name: "Back to stage" })).toHaveAttribute("href", stagePage);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("shares not adding up to 100%: what's left, the hint, and Confirm off", async ({ page }, testInfo) => {
    await signInAs(page, "manager", donePage);
    await share(page, "Sam").fill("30");
    await expect(left(page)).toHaveText("3.34% left to share");
    await expect(page.getByText("Shares must add up to 100%. Currently 96.66%.")).toBeVisible();
    await expect(confirm(page)).toBeDisabled();
    // No amount is shown for a split that doesn't add up: dollars only ever come from the server.
    await expect(page.locator("[data-split]")).not.toContainText("$666");
    await share(page, "Sam").fill("40");
    await expect(left(page)).toHaveText("6.66% too much");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("retyping the equal split keeps the E5.1 cents; an empty box blocks Confirm and is never 0%", async ({ page }) => {
    await signInAs(page, "manager", donePage);
    await share(page, "Sam").fill("33.34");
    await share(page, "Tom").fill("33.33");
    await expect(page.locator('[data-share-row="Tom"]')).toContainText("$666.67");
    await expect(page.locator('[data-share-row="Dima"]')).toContainText("$666.66");
    await share(page, "Sam").fill("");
    await share(page, "Tom").fill("50");
    await share(page, "Dima").fill("50");
    await expect(page.getByText("Check Sam's share", { exact: true })).toBeVisible();
    await expect(confirm(page)).toBeDisabled();
    await share(page, "Sam").fill("abc");
    await expect(page.getByText("Check Sam's share", { exact: true })).toBeVisible();
    await expect(confirm(page)).toBeDisabled();
  });

  test("an edited split gets its amounts back from the server and confirms", async ({ page }) => {
    await signInAs(page, "manager", donePage);
    await share(page, "Sam").fill("40");
    await share(page, "Tom").fill("40");
    await share(page, "Dima").fill("20");
    await expect(left(page)).toHaveText("Shares add up to 100%");
    await expect(page.locator('[data-share-row="Sam"]')).toContainText("$800.00");
    await expect(page.locator('[data-share-row="Dima"]')).toContainText("$400.00");
    await confirm(page).click();
    await expect(page).toHaveURL(stagePage);
    await expect(page.locator("[data-stage-controls]")).toHaveAttribute("data-status", "done");
  });

  test("an edited split that adds up keeps Confirm done clear of the home bar once the keyboard is down", async ({ page }, testInfo) => {
    await signInAs(page, "manager", donePage);
    await share(page, "Sam").fill("40");
    await share(page, "Tom").fill("40");
    await share(page, "Dima").fill("20");
    await share(page, "Dima").blur();
    await expect(page.locator('[data-slot="primary-action"]')).not.toHaveAttribute("data-keyboard", "true");
    await expect(confirm(page)).toBeEnabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), skip: { keyboard: true } });
  });

  test("loading, error and offline", async ({ page }, testInfo) => {
    await signInAs(page, "manager", `${donePage}?demo=loading`);
    await expect(page.locator('[data-screen="stage-done"]')).toHaveAttribute("aria-busy", "true");
    await page.goto(`${donePage}?demo=error`);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.goto(`${donePage}?demo=offline`);
    await expect(confirm(page)).toBeDisabled();
    await expect(page.getByText(/^Needs connection/)).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("a stage that is already done goes back to its page", async ({ page }) => {
    await signInAs(page, "manager", `/jobs/${meta.projects.brown}/stages/${meta.stages.brownRidge}/done`);
    await expect(page).toHaveURL(`/jobs/${meta.projects.brown}/stages/${meta.stages.brownRidge}`);
  });
});

test.describe("Stage done (foreman)", () => {
  test("a foreman has no Mark stage done and the done page shows No access, never an amount", async ({ page }) => {
    await signInAs(page, "foreman", `/jobs/${meta.projects.smith}/stages/${meta.stages.smithSheetInstall}`);
    await expect(page.getByRole("link", { name: "Mark stage done" })).toHaveCount(0);
    const smithDone = `/jobs/${meta.projects.smith}/stages/${meta.stages.smithSheetInstall}/done`;
    await page.goto(smithDone);
    await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
    await expect(page.locator('[data-screen="stage-done"]')).toHaveCount(0);
    await expectNoMoney(page, [smithDone, donePage]);
  });
});
