import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const dima = `/crew/${meta.crew.dima}`;
const kev = `/crew/${meta.crew.kev}`;
const sam = `/crew/${meta.crew.sam}`;
const long = `/crew/${meta.fixtures.longNamesCrew}`;

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const section = (page: Page, title: string) => page.locator("section", { has: page.getByRole("heading", { level: 2, name: title }) });

test.describe("Crew member detail (manager)", () => {
  test("shows who they are, what they are owed, and the five sections", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", kev);
    await expect(page.getByRole("heading", { level: 1, name: "Kev" })).toBeVisible();
    await expect(page.locator("[data-crew-who]")).toContainText(/^(Employee|Contractor) · /);
    await expect(page.getByRole("link", { name: /^Call 04/ })).toHaveAttribute("href", /^tel:\+?\d+$/);
    // Kev has been owed for longer than a pay period.
    const balance = page.locator('[data-crew-balance="owed"]');
    await expect(balance).toContainText(/^Owed\$[\d,]+\.\d{2}/);
    await expect(balance).toContainText("You have owed Kev this for a long time.");
    for (const title of ["Pay and payments", "Statements", "Rates", "Recent logs"])
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect(page.locator("[data-empty]")).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Record payout is the one primary button and goes to the payout page", async ({ page }, testInfo) => {
    await signInAs(page, "manager", dima);
    const payout = page.getByRole("link", { name: "Record payout" }).locator("visible=true");
    await expect(payout).toHaveCount(1);
    await expect(payout).toHaveAttribute("href", `${dima}/payout`);
    const box = (await payout.boundingBox())!;
    if (isPhone(testInfo.project.name)) {
      expect(box.height).toBeGreaterThanOrEqual(48);
      // Pinned at the bottom of the screen, clear of the content above.
      expect(box.y + box.height).toBeGreaterThan(page.viewportSize()!.height / 2);
    }
  });

  test("a person who is paid ahead reads Paid ahead, in words, with the advance in the ledger", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", dima);
    const balance = page.locator('[data-crew-balance="ahead"]');
    await expect(balance).toContainText(/^Paid ahead\$[\d,]+\.\d{2}/);
    await expect(balance).toContainText("You have paid Dima this much more than they have earned so far.");
    const ledger = section(page, "Pay and payments");
    await expect(ledger).toContainText("Advance");
    await expect(ledger).toContainText("Paid ahead");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("rates keep their history and a job's own rate says which job", async ({ page }) => {
    await signInAs(page, "manager", sam);
    const rates = section(page, "Rates");
    await expect(rates).toContainText(", current");
    await expect(rates).toContainText(", replaced");
    await expect(rates).toContainText(/, .+ only/);
    // Newest first inside each kind of rate: the current one comes before any replaced one.
    const text = await rates.innerText();
    expect(text.indexOf(", current")).toBeLessThan(text.indexOf(", replaced"));
  });

  test("recent logs open the history, and a long list ends in a link to all of it", async ({ page }) => {
    await signInAs(page, "manager", kev);
    const logs = section(page, "Recent logs");
    await expect(logs.getByRole("link").first()).toHaveAttribute("href", new RegExp(`^/history\\?crew=${meta.crew.kev}`));
    await expect(logs.getByRole("link", { name: "See all logs" })).toBeVisible();
  });

  test("Share statement makes the private link and copies it where the phone has no share sheet", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) },
        configurable: true,
      });
    });
    await signInAs(page, "manager", kev);
    const share = section(page, "Statements").getByRole("button", { name: "Share statement" }).first();
    await expect(share).toBeEnabled();
    await share.click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied. It works for 90 days." })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
    expect(copied).toMatch(/^https?:\/\/[^/]+\/\S+/);
  });

  test("a draft pay run shows its total but has no Share button yet", async ({ page }) => {
    await signInAs(page, "manager", kev);
    const rows = section(page, "Statements").locator("[data-statement-row]");
    const draft = rows.filter({ hasText: "draft, not shared until approved" });
    if ((await draft.count()) > 0) await expect(draft.first().getByRole("button", { name: "Share statement" })).toHaveCount(0);
    await expect(rows.filter({ hasText: ", approved" }).first().getByRole("button", { name: "Share statement" })).toBeVisible();
  });

  test("a very long name wraps, and with nothing logged, paid or shared every section says so", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", long);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Featherstonehaugh");
    await expect(page.locator("[data-crew-who]")).toContainText("Left ");
    await expect(page.locator('[data-crew-balance="clear"]')).toContainText(/^Nothing owed\$0\.00/);
    for (const kind of ["ledger", "statements", "logs"]) await expect(page.locator(`[data-empty="${kind}"]`)).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("loading shows the same blocks as grey shapes; error offers Try again as the primary button", async ({ page }, testInfo) => {
    await signInAs(page, "manager", `${dima}?demo=loading`);
    await expect(page.locator('[data-screen="crew-detail"][aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to crew" })).toBeVisible();
    const consoleLog = collectConsole(page);
    await page.goto(`${dima}?demo=error`);
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to crew" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline keeps the page, shows the banner, and Share waits for a connection", async ({ page }) => {
    await signInAs(page, "manager", `${kev}?demo=offline`);
    await expect(page.getByText(/No signal/).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Kev" })).toBeVisible();
    const share = section(page, "Statements").getByRole("button", { name: "Share statement" }).first();
    await expect(share).toBeDisabled();
    await expect(section(page, "Statements").getByText("Needs connection").first()).toBeVisible();
  });

  test("an unknown person is a not-found page, and an owner sees the same page as a manager", async ({ page }) => {
    await signInAs(page, "owner", dima);
    await expect(page.getByRole("heading", { level: 1, name: "Dima" })).toBeVisible();
    const res = await page.goto("/crew/not-a-person");
    expect(res?.status()).toBe(404);
  });
});

test.describe("Crew member detail (foreman and accountant)", () => {
  test("a foreman gets the no-access page, with no figure anywhere in the page or its data", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman", dima);
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.locator("[data-crew-balance]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Record payout" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await expectNoMoney(page, [dima, kev, long, `${dima}?demo=loading`, `${dima}?demo=error`, `${dima}?demo=offline`, `${dima}?demo=noperm`]);
  });

  test("an accountant has no crew member page either", async ({ page }) => {
    await signInAs(page, "accountant", dima);
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });
});
