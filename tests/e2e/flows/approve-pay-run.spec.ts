import { expect, test, type Page } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const { meta } = getSeed();
const PATH = `/pay/${meta.payRuns.review}`;

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

/**
 * flows.md "Review and approve a pay run": from Home, the This pay period card, then Approve through the confirmation
 * sheet, in ≤ 5 taps. The seed's draft has a missing rate, so the block shows (exact copy, tap-through to the line) and
 * the manager approves without the rate (audited). Export CSV is offered after, outside the budget.
 */
for (const role of ["manager", "owner"]) {
  test(`${role} approves this week's draft from Home in ≤ 5 taps`, async ({ page }) => {
    await signInAs(page, role, "/");
    const taps = new Taps("Review and approve a pay run");
    await taps.tap(page.locator(`a[href="${PATH}"]`).locator("visible=true").first());
    await expect(page.getByRole("heading", { level: 1, name: "Pay run" })).toBeVisible();
    const block = page.locator('[data-pay-block="missing_rate"]');
    // The block is the <p> itself in the pinned bar (1b): exact flows.md copy.
    await expect(block).toHaveText("Fix the missing rate before you approve.");
    const lineHref = await page.locator("[data-pay-actions]").getByRole("link", { name: "Show the line" }).getAttribute("href");
    expect(lineHref).toMatch(/^#line-/);
    await expect(page.locator(lineHref!)).toContainText("Missing rate");
    await expect(page.getByRole("button", { name: "Approve pay run" })).toBeDisabled();
    await taps.tap(page.getByRole("button", { name: "Approve without the rate" }));
    const sheet = page.getByRole("dialog", { name: "Approve this pay run?" });
    await expect(sheet).toContainText("Lines with no rate are paid $0.00");
    await expect(sheet).toContainText("Mon 21 Sep to Sun 27 Sep");
    await taps.tap(sheet.getByRole("button", { name: "Approve without the rate", exact: true }));
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText("Pay run approved.", { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-pay-approved]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Approve pay run" })).toHaveCount(0);
    await expect(page.locator("[data-pay-block]")).toHaveCount(0);
    taps.assertWithin(5);
    // Below 1024 px people fold to name and total: open the first to see its Share statement (not part of the flow).
    const toggle = page.locator('[data-person-toggle][aria-expanded="false"]').first();
    if (await toggle.count()) await toggle.click();
    await expect(page.getByRole("button", { name: "Share statement" }).first()).toBeVisible();
  });
}

test("Owner 2FA off blocks Approve with a button to Settings, and no way round it", async ({ page }) => {
  await signInAs(page, "owner", `${PATH}?demo=blocked`);
  const block = page.locator('[data-pay-block="owner_2fa_off"]');
  await expect(block).toHaveText("Turn on two-factor before you approve a pay run.");
  await expect(page.locator("[data-pay-actions]").getByRole("link", { name: "Go to settings" })).toHaveAttribute("href", /^\/settings/);
  await expect(page.getByRole("button", { name: "Approve pay run" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Approve without the rate" })).toHaveCount(0);
  // The pinned bar names only the 2FA block (fixed first, safe default); the flags list still shows the missing rate.
  const blocking = page.locator('[data-pay-flag="blocking"]');
  await expect(blocking.locator('a[href^="/settings"]')).toHaveCount(1);
  expect(await blocking.count()).toBeGreaterThanOrEqual(2);
});

test("offline: Approve is disabled with Needs connection and nothing queues", async ({ page }) => {
  await signInAs(page, "manager", `${PATH}?demo=offline`);
  await expect(page.getByRole("button", { name: "Approve pay run" })).toBeDisabled();
  await expect(page.locator("[data-pay-needs-connection]")).toHaveText("Needs connection to approve.");
  await expect(page.getByRole("button", { name: "Approve without the rate" })).toHaveCount(0);
  await expect(page.getByText("will send automatically")).toHaveCount(0);
});
