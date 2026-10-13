import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();
const isPhone = (name: string) => name !== "desktop";
const dima = `/crew/${meta.crew.dima}`;
const payout = `${dima}/payout`;
/** Today in the workspace timezone on the fake clock (Mon 28 Sep, 7 a.m. Sydney). */
const TODAY = "2026-09-28";

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

/** A shown dollar figure as integer cents (digits only, no float). */
const cents = (text: string) => Number.parseInt(text.replace(/[^\d]/g, ""), 10);

async function signedBalance(page: Page): Promise<number> {
  const box = page.locator("[data-crew-balance]");
  const kind = await box.getAttribute("data-crew-balance");
  const figure = (await box.textContent())?.match(/\$[\d,]+\.\d{2}/)?.[0] ?? "";
  return kind === "ahead" ? -cents(figure) : cents(figure);
}

const amount = (page: Page) => page.getByLabel("Amount", { exact: true });
const save = (page: Page) => page.getByRole("button", { name: "Save payout" });

test.describe("Record payout (manager)", () => {
  test("the empty form: dated today, no amount, neither Advance nor Payment, bank transfer", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", payout);
    await expect(page.getByRole("heading", { level: 1, name: "Record payout" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Dima" })).toHaveAttribute("href", dima);
    if (isPhone(testInfo.project.name)) expect((await checkBackRow(page)).failures).toEqual([]);
    // Advance or Payment fills its column (D10) and the options have a 1 px divider between them when neither is picked.
    const seg = page.locator('[aria-label="Advance or payment"]').first();
    const segBox = await seg.boundingBox();
    const colBox = await seg.locator("xpath=..").boundingBox();
    expect(colBox!.width - segBox!.width, "segment narrower than its column").toBeLessThanOrEqual(2);
    // F18, D10: one outer border on the control; no option draws its own (rounded) border; the divider is a straight 1 px
    // line: the group's edge fill showing through a 1 px gap between opaque options (segmented.tsx, since 37f6043).
    const group = await seg.evaluate((e) => {
      const s = getComputedStyle(e);
      return { gap: s.columnGap, fill: s.backgroundColor, border: s.borderTopWidth };
    });
    expect(group.gap, "1 px gap between options").toBe("1px");
    expect(group.fill, "the gap shows the edge colour").not.toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(group.border), "one outer border").toBeGreaterThan(0);
    const parts = await seg.locator("label").evaluateAll((els) =>
      els.map((e) => {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return { border: s.borderLeftWidth + s.borderTopWidth + s.borderRightWidth + s.borderBottomWidth, fill: s.backgroundColor, left: r.left, right: r.right, top: r.top };
      }),
    );
    expect(parts.map((p) => p.border), "options must not draw their own border").toEqual(parts.map(() => "0px0px0px0px"));
    expect(parts.map((p) => p.fill), "options are opaque, so only the gap shows the edge").not.toContain("rgba(0, 0, 0, 0)");
    expect(parts[1]!.top, "Advance and Payment share one row").toBeCloseTo(parts[0]!.top, 0);
    expect(parts[1]!.left - parts[0]!.right, "straight 1 px divider").toBeCloseTo(1, 1);
    await expect(page.locator("[data-payout-balance]")).toContainText(/^Dima: (owed|paid ahead|nothing owed) \$[\d,]+\.\d{2}$/);
    await expect(page.getByLabel("Date paid")).toHaveValue(TODAY);
    await expect(amount(page)).toHaveValue("");
    await expect(amount(page)).toHaveAttribute("inputmode", "decimal");
    const kind = page.getByRole("radiogroup", { name: "Advance or payment" });
    await expect(kind.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(page.getByRole("radiogroup", { name: "How it was paid" }).getByRole("radio", { name: "Bank transfer" })).toBeChecked();
    await expect(save(page).locator("visible=true")).toBeEnabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("Save payout with a blank, $0.00 or unreadable amount refuses on the field and stays put", async ({ page }, testInfo) => {
    await signInAs(page, "manager", payout);
    await save(page).locator("visible=true").click();
    await expect(page.getByText("Add an amount before saving.")).toBeVisible();
    await expect(page.getByText("Choose Advance or Payment.", { exact: true })).toBeVisible();
    // The pinned bar names only what is missing (D17).
    await expect(page.getByText("Add an amount and choose Advance or Payment.", { exact: true }).locator("visible=true")).toBeVisible();
    await expect(amount(page)).toHaveAttribute("aria-invalid", "true");
    await amount(page).fill("0");
    await page.getByRole("radio", { name: "Payment" }).click();
    await save(page).locator("visible=true").click();
    await expect(page.getByText("Add an amount before saving.")).toBeVisible();
    await expect(page.getByText("Choose Advance or Payment.", { exact: true })).toHaveCount(0);
    await amount(page).fill("12.3.4");
    await save(page).locator("visible=true").click();
    await expect(page.getByText("Enter an amount in dollars and cents, like 1,482.00.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${payout}$`));
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("the refused state from the address shows each missing thing", async ({ page }, testInfo) => {
    await signInAs(page, "manager", `${payout}?amount=0&check=1`);
    await expect(page.getByText("Add an amount before saving.")).toBeVisible();
    await expect(page.getByText("Choose Advance or Payment.", { exact: true })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("the filled state shows the amount, Payment, the method and the note", async ({ page }, testInfo) => {
    await signInAs(page, "manager", `${payout}?amount=1482.00&kind=payment&method=cash&note=Friday`);
    await expect(amount(page)).toHaveValue("1,482.00");
    await expect(page.getByRole("radio", { name: "Payment" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Cash" })).toBeChecked();
    await expect(page.getByLabel("Note (optional)")).toHaveValue("Friday");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("saving an advance goes back to the crew member with the new balance and a toast", async ({ page }) => {
    await signInAs(page, "manager", dima);
    const before = await signedBalance(page);
    await page.goto(payout);
    await amount(page).fill("300.00");
    await page.getByRole("radio", { name: "Advance" }).click();
    await page.getByRole("radio", { name: "Cash" }).click();
    await save(page).locator("visible=true").click();
    await expect(page.getByText("Advance saved.", { exact: true })).toBeVisible();
    expect(await signedBalance(page)).toBe(before - 30000);
    // The saved flag leaves the address once the toast shows, so a reload never shows it again.
    await expect(page).toHaveURL(new RegExp(`${dima}$`));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Dima" })).toBeVisible();
    await expect(page.getByText("Advance saved.", { exact: true })).toHaveCount(0);
    // Saving replaced the form in history: Back never lands on the filled-in form.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/payout/);
  });

  test("offline: Save payout is disabled and says it needs a connection (never queued)", async ({ page }, testInfo) => {
    await signInAs(page, "manager", `${payout}?demo=offline`);
    await expect(save(page).locator("visible=true")).toBeDisabled();
    await expect(page.getByText("Needs connection — try again once you're back online.").locator("visible=true")).toBeVisible();
    // One needs-connection sentence: no "will send automatically" banner on this admin screen (F3).
    await expect(page.getByText(/will send automatically/)).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("loading shows the form as grey shapes; error offers Try again as the primary button", async ({ page }, testInfo) => {
    await signInAs(page, "manager", `${payout}?demo=loading`);
    await expect(page.locator('[data-screen="payout"][aria-busy="true"]')).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    await page.goto(`${payout}?demo=error`);
    await expect(page.getByText("Couldn't load this. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });
});

test.describe("Record payout (no access)", () => {
  for (const role of ["foreman", "accountant"]) {
    test(`${role} gets the no-access page and no figure anywhere`, async ({ page }, testInfo) => {
      await signInAs(page, role, payout);
      await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
      await expect(page.locator('[data-screen="payout"]')).toHaveCount(0);
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
      await expectNoMoney(page, [payout, `${payout}?demo=loading`, `${payout}?demo=error`, `${payout}?demo=offline`]);
    });
  }
});
