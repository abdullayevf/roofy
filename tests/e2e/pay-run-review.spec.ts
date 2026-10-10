import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, checkMoneyFigureFont, checkPrimaryActionPlacement, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const isPhone = (name: string) => name !== "desktop";
const MONEY = /^\$[\d,]+\.\d{2}$/;
const PATH = `/pay/${meta.payRuns.review}`;
const SCREEN = '[data-screen="pay-run-review"]';

async function signInAs(page: Page, role: string, next = PATH) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

// The confirm sheet mounts only after hydration, so a "no sheet" check made before then passes
// whether or not the wiring works. Wait for the page to go quiet before any such negative check.
async function hydrated(page: Page) {
  await page.waitForLoadState("networkidle");
}

// Below 1024 px each person folds to name and total (pay iter1 D5): open them all to reach their lines.
async function openPeople(page: Page) {
  await hydrated(page);
  for (const t of await page.locator('[data-person-toggle][aria-expanded="false"]').all()) await t.click();
}

test.describe("Pay run review (display)", () => {
  test("shows the period, total and flags first, blocking before warnings", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Pay run" })).toBeVisible();
    await expect(page.locator("[data-pay-period]")).toHaveText("Mon 21 Sep to Sun 27 Sep");
    await expect(page.locator(`${SCREEN} .text-figure-xl`)).toHaveText(MONEY);
    const flags = page.locator("[data-pay-flag]");
    await expect(flags.first()).toHaveAttribute("data-pay-flag", "blocking");
    await expect(flags.first()).toContainText("Jake has no rate per lm for Flashings, gutters & downpipes, so Wed 23 Sep pays $0.00.");
    await expect(flags.first()).not.toContainText("Fix the missing rate");
    // Money in a flag sentence is set in the figure face (lesson 26).
    await expect(flags.first().locator("[data-inline-money]")).toHaveCSS("font-family", /Barlow/i);
    await expect(flags.nth(1)).toHaveAttribute("data-pay-flag", "warning");
    // A flag taps through to its line on this page, and that line is there.
    const href = await flags.first().locator("a").getAttribute("href");
    expect(href).toMatch(/^#line-/);
    await expect(page.locator(href!)).toContainText("Missing rate");
    expect((await checkMoneyFigureFont(page, SCREEN)).failures).toEqual([]);
    expect((await checkBackRow(page)).failures).toEqual([]);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a GST-registered contractor shows subtotal, GST, reimbursement and total (E6.1, E7.1)", async ({ page }) => {
    await signInAs(page, "owner");
    const dima = page.locator('[data-pay-person="contractor"]').filter({ has: page.getByRole("heading", { name: "Dima" }) });
    await expect(dima).toContainText("Registered for GST");
    await expect(dima.locator("[data-pay-reimbursement]")).toContainText("Trade Fasteners");
    const sums = dima.locator("[data-person-totals] > div");
    await expect(sums).toHaveText(["Subtotal$1,520.00", "GST$152.00", "Reimbursements$110.00", "Total$1,782.00"]);
    await expect(dima.locator("[data-person-total]")).toHaveText("$1,782.00");
    // An employee shows pay and total only; every amount sits in the right column as a figure.
    for (const a of await page.locator("[data-line-amount]").all()) await expect(a).toHaveText(MONEY);
    await expect(page.locator("[data-pay-run-totals] [data-pay-sum=total]")).toContainText(/Total\$[\d,]+\.\d{2}/);
  });

  test("late entries and adjustments carry their own date", async ({ page }) => {
    await signInAs(page, "manager");
    await expect(page.locator('[data-pay-line="late"] [data-line-label]')).toHaveText("Late entry");
    await expect(page.locator('[data-pay-line="adjustment"] [data-line-label]')).toHaveText("Adjustment");
    await expect(page.locator('[data-pay-line="normal"] [data-line-basis]').first()).toHaveText(/ at \$[\d,]+\.\d{2} (an hour|a day|per .+)$/);
  });

  test("Owner 2FA off is a second blocking flag that goes to Settings", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "owner", `${PATH}?demo=blocked`);
    const twoFactor = page.locator('[data-pay-flag="blocking"]').filter({ hasText: "Turn on two-factor before you approve a pay run." });
    await expect(twoFactor.locator("a")).toHaveAttribute("href", "/settings/members");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the accountant reads the same review", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.locator("[data-pay-person]").first()).toBeVisible();
    await expect(page.locator("[data-pay-flag]").first()).toBeVisible();
  });

  for (const state of ["loading", "error", "offline"] as const) {
    test(`${state} state`, async ({ page }, testInfo) => {
      const consoleLog = collectConsole(page);
      await signInAs(page, "manager", `${PATH}?demo=${state}`);
      await expect(page.getByRole("heading", { level: 1, name: "Pay run" })).toBeVisible();
      if (state === "loading") await expect(page.locator(`${SCREEN}[aria-busy=true]`)).toBeVisible();
      if (state === "error") await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      if (state === "offline") {
        await expect(page.locator("[data-pay-person]").first()).toBeVisible();
        await expect(page.getByRole("button", { name: "Approve pay run" })).toBeDisabled();
        await expect(page.locator("[data-pay-needs-connection]")).toBeVisible();
        await expect(page.getByText(/send automatically/)).toHaveCount(0);
      }
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }

  test("a foreman gets no access and the page carries no money", async ({ page }) => {
    await signInAs(page, "foreman");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expectNoMoney(page, [PATH, `${PATH}?demo=blocked`, `${PATH}?demo=offline`]);
  });
});

const APPROVED = `/pay/${meta.payRuns.lastApproved}`;

test.describe("Pay run review (actions)", () => {
  test("the confirmation sheet opens over the review and Cancel closes it", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    // Last week's draft has a missing rate, so the live sheet is "Approve without the rate".
    await signInAs(page, "manager", `${PATH}?confirm=waive`);
    const sheet = page.getByRole("dialog", { name: "Approve this pay run?" });
    await expect(sheet).toContainText("Approving locks every day logged from Mon 21 Sep to Sun 27 Sep");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator("[data-pay-flag]").first()).toBeVisible();
  });

  test("an approved run offers Export CSV, which downloads a CSV and marks it exported", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "owner", APPROVED);
    await expect(page.getByRole("button", { name: "Reopen pay run" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Approve pay run" })).toHaveCount(0);
    // Share statement once per person, inside that person's group.
    const people = await page.locator("[data-pay-person]").count();
    expect(people).toBeGreaterThan(0);
    await expect(page.locator("[data-pay-person] [data-share-statement]")).toHaveCount(people);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
    await expect(page.locator("[data-pay-exported]")).toBeVisible();
  });

  test("an exported run says so, exports again, and can't reopen once a later run is approved", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    const exported = seed.payRuns.find((r) => r.status === "exported")!.id;
    await signInAs(page, "owner", `/pay/${exported}`);
    await expect(page.locator("[data-pay-exported]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Reopen pay run" })).toHaveCount(0);
    await openPeople(page);
    await expect(page.getByRole("button", { name: "Share statement" }).first()).toBeEnabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Reopen asks first, then the run is a draft again", async ({ page }) => {
    await signInAs(page, "manager", APPROVED);
    await page.getByRole("button", { name: "Reopen pay run" }).click();
    const sheet = page.getByRole("dialog", { name: "Reopen this pay run?" });
    await sheet.getByRole("button", { name: "Reopen", exact: true }).click();
    await expect(page.getByText("Pay run reopened.", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
    await expect(page.locator("[data-pay-approved]")).toHaveCount(0);
  });

  test("an accountant exports only: no Approve, no waive, no Reopen", async ({ page }) => {
    await signInAs(page, "accountant");
    await expect(page.getByText("An owner or manager approves this pay run.")).toBeVisible();
    await expect(page.locator("[data-pay-actions]")).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve/ })).toHaveCount(0);
    await page.goto(APPROVED);
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Reopen pay run" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share statement" })).toHaveCount(0);
  });

  test("?confirm= opens no sheet when that action isn't live", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    // An accountant on a draft: only the "who approves" line.
    await signInAs(page, "accountant", `${PATH}?confirm=approve`);
    await hydrated(page);
    await expect(page.getByText("An owner or manager approves this pay run.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await page.goto(`${PATH}?confirm=waive`);
    await hydrated(page);
    await expect(page.getByText("An owner or manager approves this pay run.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    // A manager on a draft blocked by a missing rate: Approve is disabled, so no approve sheet.
    await signInAs(page, "manager", `${PATH}?confirm=approve`);
    await hydrated(page);
    await expect(page.getByRole("button", { name: "Approve pay run" })).toBeDisabled();
    await expect(dialog).toHaveCount(0);
    // Offline: every action is disabled and nothing may send, so no sheet either.
    await page.goto(`${PATH}?demo=offline&confirm=waive`);
    await hydrated(page);
    await expect(page.locator("[data-pay-needs-connection]")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    // An approved run can't be approved again.
    await page.goto(`${APPROVED}?confirm=approve`);
    await hydrated(page);
    await expect(page.getByRole("button", { name: "Reopen pay run" })).toBeEnabled();
    await expect(dialog).toHaveCount(0);
  });

  test("Share statement is absent on a draft", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page.locator("[data-pay-person]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Share statement" })).toHaveCount(0);
  });

  test("offline on an approved run: Export and Reopen disabled with one Needs connection line", async ({ page }) => {
    await signInAs(page, "owner", `${APPROVED}?demo=offline`);
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reopen pay run" })).toBeDisabled();
    await expect(page.locator("[data-pay-needs-connection]")).toHaveCount(1);
  });
});

test.describe("Pay run review (layout, pay iter1 D3-D6, F3-F5)", () => {
  test("missing rate: Show the line first, Approve last, the waiver quieter under it; Approve in reach", async ({ page }, testInfo) => {
    await signInAs(page, "manager");
    const bar = page.locator('[data-slot="primary-action"]');
    await expect(bar.locator('[data-pay-block="missing_rate"]')).toHaveText("Fix the missing rate before you approve.");
    const variants = await bar.locator("[data-variant]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-variant")}:${(e as HTMLElement).innerText.trim()}`));
    expect(variants).toEqual(["secondary:Show the line", "primary:Approve pay run", "link:Approve without the rate"]);
    const showLine = await bar.getByRole("link", { name: "Show the line" }).boundingBox();
    expect(showLine!.height).toBeGreaterThanOrEqual(isPhone(testInfo.project.name) ? 52 : 48);
    expect((await checkPrimaryActionPlacement(page)).failures).toEqual([]);
  });

  test("the missing-rate line carries the flag's over icon and word, and Show the line opens its person", async ({ page }) => {
    await signInAs(page, "manager");
    await hydrated(page);
    await page.locator('[data-slot="primary-action"]').getByRole("link", { name: "Show the line" }).click();
    const word = page.locator("[data-line-missing-rate]").first();
    await expect(word).toBeVisible();
    await expect(word).toHaveText("Missing rate");
    await expect(word.locator("svg")).toHaveCount(1);
    await expect(word).toHaveClass(/text-over/);
  });

  test("below 1024 px people fold to name and total; tap to open", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "desktop shows every line");
    await signInAs(page, "manager");
    await hydrated(page);
    const first = page.locator("[data-pay-person]").first();
    await expect(first.locator("[data-person-total]")).toBeVisible();
    await expect(first.locator("[data-person-lines]")).toBeHidden();
    await first.locator("[data-person-toggle]").click();
    await expect(first.locator("[data-person-lines]")).toBeVisible();
    await expect(first.locator("[data-person-toggle]")).toHaveAttribute("aria-expanded", "true");
  });

  test("Owner 2FA off: the owner gets Go to settings; a manager gets the owner sentence and no button (F4)", async ({ page }) => {
    await signInAs(page, "owner", `${PATH}?demo=blocked`);
    const bar = page.locator('[data-slot="primary-action"]');
    await expect(bar.locator('[data-pay-block="owner_2fa_off"]')).toHaveText("Turn on two-factor before you approve a pay run.");
    await expect(bar.getByRole("link", { name: "Go to settings" })).toHaveAttribute("data-variant", "secondary");
    await signInAs(page, "manager", `${PATH}?demo=blocked`);
    await expect(bar.locator('[data-pay-block="owner_2fa_off"]')).toHaveText("The owner needs to turn on two-factor before this pay run can be approved.");
    await expect(page.getByRole("link", { name: "Go to settings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve pay run" })).toBeDisabled();
  });

  test("approved: Export CSV in the bar, in reach", async ({ page }) => {
    await signInAs(page, "owner", APPROVED);
    await expect(page.locator('[data-slot="primary-action"]').getByRole("button", { name: "Export CSV" })).toBeVisible();
    expect((await checkPrimaryActionPlacement(page)).failures).toEqual([]);
  });
});
