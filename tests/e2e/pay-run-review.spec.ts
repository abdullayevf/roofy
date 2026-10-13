import { expect, test, type Page } from "@playwright/test";
import { checkActionsAtContentEdge, checkContentClearsFixedBars, checkPinnedBarCompact, checkAbnStaysWhole, checkBackRow, checkMoneyFigureFont, checkRunTotalsSum, checkPrimaryActionPlacement, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const seed = getSeed();
const { meta } = seed;
const isPhone = (name: string) => name !== "desktop";
const MONEY = /^\$[\d,]+\.\d{2}$/;
const PATH = `/pay/${meta.payRuns.review}`;
const SCREEN = '[data-screen="pay-run-review"]';
const NEEDS_CONNECTION = "Needs connection — try again once you're back online.";

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
  // Snapshot the stable set of toggles: filtering on aria-expanded="false" re-resolves after each click, so its
  // nth() indexes shift and the later ones never exist.
  for (const t of await page.locator("[data-person-toggle]").all()) {
    if ((await t.getAttribute("aria-expanded")) === "false") await t.click();
  }
  await expect(page.locator('[data-person-toggle][aria-expanded="false"]')).toHaveCount(0);
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
    // N1: Employees + Contractors = Total; GST and reimbursements are "Includes" lines, not added again.
    await expect(page.locator("[data-pay-run-totals] [data-pay-sum=includes]")).toHaveText([/^Includes GST\$[\d,]+\.\d{2}$/, /^Includes reimbursements\$[\d,]+\.\d{2}$/]);
    expect(await checkRunTotalsSum(page)).toMatchObject({ ok: true });
    // N3/D19: the ABN never breaks inside the number.
    expect(await checkAbnStaysWhole(page, '[data-pay-person="contractor"]')).toMatchObject({ ok: true });
    // D11: an employee with nothing to reimburse has no footer row repeating the figure beside their name.
    const employee = page.locator('[data-pay-person="employee"]').filter({ hasNot: page.locator("[data-pay-reimbursement]") }).first();
    await expect(employee.locator("[data-person-totals]")).toHaveCount(0);
  });

  test("a manager is told the owner turns on two-factor, with no link (N4)", async ({ page }) => {
    await signInAs(page, "manager", `${PATH}?demo=blocked`);
    const twoFactor = page.locator('[data-pay-flag="blocking"]').filter({ hasText: "The owner needs to turn on two-factor before this pay run can be approved." });
    await expect(twoFactor).toHaveCount(1);
    await expect(twoFactor.locator("a")).toHaveCount(0);
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
    await expect(twoFactor.locator("a")).toHaveAttribute("href", "/settings/two-factor");
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
    // D21: the override path says what it does, and its $0.00 is in the figure face.
    await expect(sheet.getByRole("button", { name: "Approve without the rate", exact: true })).toBeVisible();
    expect(await checkMoneyFigureFont(page, '[role="dialog"]')).toMatchObject({ ok: true });
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
    // Visible text only: the inline waiver inside the sentence is for a phone on its side (2b) and hidden here.
    await expect(bar.locator('[data-pay-block="missing_rate"]')).toHaveText("Fix the missing rate before you approve.", { useInnerText: true });
    await expect(bar.locator("[data-pay-waive-inline]")).toBeHidden();
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

test.describe("pay run review layout (pay iter2 D16, D17, D25)", () => {
  test("a phone on its side: the blocked bar is one compact row clear of the Log circle", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "manager");
    await expect(page.locator("[data-pay-block]")).toBeVisible();
    await expect(page.locator("[data-pay-waive-inline]")).toBeVisible();
    await expect(page.locator(".pay-waive")).toBeHidden();
    const r = await checkPinnedBarCompact(page);
    expect(r.failures).toEqual([]);
    const nav = await page.locator('nav[aria-label="Primary"]:visible').boundingBox();
    expect(Math.round((nav?.y ?? 0) + (nav?.height ?? 0))).toBe(390);
    // The inline waiver is a text link with a 48 x 48 px hit area (F1/P2-2): its ::after is 48 px tall, the link at
    // least 48 px wide, and a tap 3 px under its words or 43 px above that still lands on it, not on the tab bar.
    const hit = await page.locator("[data-pay-waive-inline]").evaluate((a) => {
      const r = a.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const on = (y: number) => {
        const e = document.elementFromPoint(x, y);
        return e !== null && (e === a || a.contains(e));
      };
      return { width: r.width >= 48, height: parseFloat(getComputedStyle(a, "::after").height) >= 48, below: on(r.bottom + 3), above: on(r.bottom - 43) };
    });
    expect(hit).toEqual({ width: true, height: true, below: true, above: true });
  });

  // F3: the longer sentences still fit the compact row clear of the Log circle at 844 x 390.
  test("a phone on its side: the manager's two-factor sentence keeps the bar compact", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "manager", `${PATH}?demo=blocked`);
    await expect(page.locator('[data-pay-block="owner_2fa_off"]')).toBeVisible();
    expect((await checkPinnedBarCompact(page)).failures).toEqual([]);
  });

  test("a phone on its side offline: Needs connection keeps the approved bar compact", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "owner", `${APPROVED}?demo=offline`);
    await expect(page.locator("[data-pay-needs-connection]")).toHaveText(NEEDS_CONNECTION);
    expect((await checkPinnedBarCompact(page)).failures).toEqual([]);
  });

  test("a phone on its side offline and blocked: Needs connection is the sentence's second line, clear of the Log circle", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await signInAs(page, "manager", `${PATH}?demo=offline`);
    await expect(page.locator("[data-pay-needs-connection-inline]")).toBeVisible();
    await expect(page.locator("[data-pay-needs-connection-inline]")).toHaveText(NEEDS_CONNECTION);
    await expect(page.locator("[data-pay-needs-connection]")).toBeHidden();
    // Two sentences in one column can't fit 64 px; the bar grows to 76 px measured here, still one row. Cap is measured + 4.
    expect((await checkPinnedBarCompact(page, 80)).failures).toEqual([]);
  });

  test("a tablet: the bar spans the review column on a full-width strip and nothing ends under it", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await signInAs(page, "manager");
    const bar = await page.locator('[data-slot="primary-action"]').boundingBox();
    expect(bar?.x).toBe(0);
    expect(bar?.width).toBe(820);
    const r = await checkContentClearsFixedBars(page);
    expect(r.failures).toEqual([]);
  });

  test("desktop: the actions are one row at the content edge (draft and approved)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop layout");
    await signInAs(page, "manager");
    expect((await checkActionsAtContentEdge(page, "[data-pay-actions]", SCREEN)).failures).toEqual([]);
    const sentence = await page.locator("[data-pay-block]").boundingBox();
    const first = await page.locator("[data-pay-actions] :is(button, a)[data-variant]:visible").first().boundingBox();
    expect(sentence && first && sentence.y + sentence.height <= first.y).toBe(true);
    await page.goto(APPROVED);
    expect((await checkActionsAtContentEdge(page, "[data-pay-actions]", SCREEN)).failures).toEqual([]);
    const reopen = await page.getByRole("button", { name: "Reopen pay run" }).boundingBox();
    const exp = await page.getByRole("button", { name: "Export CSV" }).boundingBox();
    expect(reopen && exp && reopen.x < exp.x).toBe(true);
  });
});
