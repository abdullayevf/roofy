import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";
import { formatDate } from "../../src/lib/format";

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
    await expect(page.locator("[data-crew-who]")).toContainText(/^(Employee|Contractor)/);
    // One fact per line, never joined with a middle dot (D3/F5), and the balance sits directly under the name (D7).
    await expect(page.locator("body")).not.toContainText("\u00b7");
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    const hero = await page.locator('[data-crew-balance="owed"]').boundingBox();
    const who = await page.locator("[data-crew-who]").boundingBox();
    expect(hero!.y - (title!.y + title!.height)).toBeLessThan(40);
    expect(who!.y).toBeGreaterThan(hero!.y);
    if (isPhone(testInfo.project.name)) expect((await checkBackRow(page)).failures).toEqual([]);
    await expect(page.getByRole("link", { name: /^Call 04/ })).toHaveAttribute("href", /^tel:\+?\d+$/);
    // Kev has been owed for longer than a pay period.
    const balance = page.locator('[data-crew-balance="owed"]');
    await expect(balance).toContainText(/^Owed\$[\d,]+\.\d{2}/);
    await expect(balance).toContainText(/Owed since \w{3} \d{1,2} \w{3} \(\d+ pay runs?\)\./);
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
    await expect(ledger).toContainText("Balance after: paid ahead");
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
    // Dima is in last week's pay run, which is still a draft in the seed.
    await signInAs(page, "manager", dima);
    const rows = section(page, "Statements").locator("[data-statement-row]");
    const draft = rows.filter({ hasText: "draft, not shared until approved" });
    await expect(draft).toHaveCount(1);
    await expect(draft.getByRole("button", { name: "Share statement" })).toHaveCount(0);
    await expect(rows.filter({ hasNotText: "not shared until approved" }).first().getByRole("button", { name: "Share statement" })).toBeVisible();
    // The latest four only, then "See all statements" opens the rest in place (D1, F2).
    await expect(rows).toHaveCount(4);
    await section(page, "Statements").getByRole("button", { name: "See all statements" }).click();
    expect(await rows.count()).toBeGreaterThan(4);
    await expect(section(page, "Statements").getByRole("button", { name: "See all statements" })).toHaveCount(0);
  });

  test("saved: the hero and the top ledger row show the payout just saved (F1, D2)", async ({ page }, testInfo) => {
    await signInAs(page, "manager", dima);
    const before = await page.locator("[data-crew-balance]").innerText();
    const next = `${dima}?saved=payment`;
    await page.goto(`/prototype/record-payout?crew=${meta.crew.dima}&cents=148200&kind=payment&approve=1&next=${encodeURIComponent(next)}`);
    await expect(page.getByText("Payment saved.", { exact: true })).toBeVisible();
    // The toast sits above the pinned bar and the tab bar, not on their labels (D13, F12).
    if (isPhone(testInfo.project.name)) {
      await expect
        .poll(async () => {
          const toast = await page.getByText("Payment saved.", { exact: true }).boundingBox();
          const bar = await page.locator(".jobs-add-bar .pin-action").boundingBox();
          return bar!.y - (toast!.y + toast!.height);
        })
        .toBeGreaterThanOrEqual(8);
    }
    await expect(page.locator("[data-crew-balance]")).not.toHaveText(before);
    await expect(page.locator('[data-crew-balance="clear"]')).toContainText(/^Nothing owed\$0\.00/);
    const top = section(page, "Pay and payments").locator(".divide-y > *").first();
    await expect(top).toContainText(/^Payment/);
    await expect(top).toContainText(`${formatDate(meta.today, meta.today)}. Balance after: nothing owed`);
    await expect(top).toContainText("$1,482.00");
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
    // The pinned bar is already there as a grey block, and the grey rows are as tall as the real ones (D12, F11).
    if (isPhone(testInfo.project.name)) {
      await expect(page.locator(".jobs-add-bar .pin-action")).toBeVisible();
      const grey = await page.locator('[data-screen="crew-detail"][aria-busy="true"] .border-group > div').first().boundingBox();
      expect(grey!.height).toBeGreaterThanOrEqual(64);
    }
    const consoleLog = collectConsole(page);
    await page.goto(`${dima}?demo=error`);
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to crew" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("offline keeps the page, and Share and Record payout wait for a connection", async ({ page }) => {
    await signInAs(page, "manager", `${kev}?demo=offline`);
    await expect(page.getByRole("heading", { level: 1, name: "Kev" })).toBeVisible();
    const share = section(page, "Statements").getByRole("button", { name: "Share statement" }).first();
    await expect(share).toBeDisabled();
    await expect(section(page, "Statements").getByText("Needs connection").first()).toBeVisible();
    // Record payout never queues: disabled here, with the needs-connection line (D18, F10).
    await expect(page.getByRole("button", { name: "Record payout" }).locator("visible=true")).toBeDisabled();
    await expect(page.getByText("Needs connection. Try again once you're back online.").locator("visible=true").first()).toBeVisible();
    await expect(page.getByText(/will send automatically/)).toHaveCount(0);
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

test.describe("Crew member detail layout", () => {
  test("desktop uses two columns and the action sits in the title row", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop layout");
    await signInAs(page, "manager", dima);
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    const payout = await page.getByRole("link", { name: "Record payout" }).locator("visible=true").boundingBox();
    expect(Math.abs(payout!.y + payout!.height / 2 - (title!.y + title!.height / 2))).toBeLessThan(30);
    const ledger = await section(page, "Pay and payments").boundingBox();
    const statements = await section(page, "Statements").boundingBox();
    expect(statements!.x).toBeGreaterThan(ledger!.x + ledger!.width / 2);
  });

  test("the ledger's figures end at the same right edge as its rows, with no empty gutter", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone rows");
    await signInAs(page, "manager", dima);
    const group = await section(page, "Pay and payments").locator("div.border-group").first().boundingBox();
    const figure = await section(page, "Pay and payments").locator(".num").first().boundingBox();
    expect(group!.x + group!.width - (figure!.x + figure!.width)).toBeLessThanOrEqual(20);
  });

  test("on a tablet the pinned Record payout bar has its own surface and top rule", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await signInAs(page, "manager", dima);
    const bar = page.locator(".jobs-add-bar .pin-action");
    const css = await bar.evaluate((el) => {
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { top: parseFloat(c.borderTopWidth), left: parseFloat(c.paddingLeft), bg: c.backgroundColor, x: r.x, w: r.width };
    });
    expect(css.top).toBeGreaterThan(0);
    expect(css.left).toBeGreaterThanOrEqual(16);
    expect(css.bg).not.toBe("rgba(0, 0, 0, 0)");
    // Edge to edge, like the phone's bar: the rule runs the whole width of the screen.
    expect(css.x).toBeLessThanOrEqual(1);
    expect(css.w).toBeGreaterThanOrEqual(819);
  });
});
