import { expect, test, type Page } from "@playwright/test";
import { checkDateFields, collectConsole, expectScreenHealthy } from "./guards";
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
    // The key figure: the lump sum, figure-xl, with its words beside it (i1-D2).
    const key = page.locator("[data-key-figure]");
    await expect(key).toContainText("$2,000.00");
    await expect(key).toContainText("lump sum");
    await expect(key.locator("[data-figure]")).toHaveCSS("font-size", /^(40|48)px$/);
    await expect(page.getByText("Shared by everyone who logged work on this stage.")).toBeVisible();
    // The working line that lets the manager add the equal split up by hand (i1-D3). Sam and Tom hold the extra cent.
    await expect(page.locator("[data-split-note]")).toHaveText("Split equally; 1c rounding goes to Sam and Tom.");
    const rows: [string, string, string][] = [["Sam", "33.34", "$666.67"], ["Tom", "33.33", "$666.67"], ["Dima", "33.33", "$666.66"]];
    for (const [name, pct, amount] of rows) {
      await expect(share(page, name)).toHaveValue(pct);
      await expect(page.locator(`[data-share-row="${name}"]`)).toContainText(amount);
    }
    await expect(left(page)).toHaveText("Shares add up to 100%");
    await expect(confirm(page)).toBeEnabled();
    await expect(page.getByRole("link", { name: "Back to stage" })).toHaveAttribute("href", stagePage);

    // Name on the left, the % box, the amount in one right-aligned tabular column (i1-D2, lessons).
    const boxes = await Promise.all(
      ["Sam", "Tom", "Dima"].map(async (name) => {
        const row = page.locator(`[data-share-row="${name}"]`);
        return {
          name: (await row.locator("[data-share-name]").boundingBox())!,
          input: (await share(page, name).boundingBox())!,
          amount: (await row.locator("[data-share-amount]").boundingBox())!,
        };
      }),
    );
    for (const b of boxes) {
      expect(b.name.x + b.name.width, "name sits left of the % box").toBeLessThanOrEqual(b.input.x + 1);
      expect(b.input.x + b.input.width, "% box sits left of the amount").toBeLessThanOrEqual(b.amount.x + 1);
    }
    expect(new Set(boxes.map((b) => Math.round(b.amount.x + b.amount.width))).size, "amounts share one right edge").toBe(1);
    expect(new Set(boxes.map((b) => Math.round(b.input.x))).size, "% boxes share one left edge").toBe(1);
    await expect(page.locator("[data-share-amount]").first()).toHaveCSS("text-align", "right");
    await expect(page.locator("[data-share-amount]").first()).toHaveCSS("font-variant-numeric", /tabular-nums/);

    // The Photo label is the same style as Note's, with Optional under it (i1-D5/F5).
    const label = page.getByText("Photo", { exact: true });
    const note = page.locator('label:has-text("Note")');
    for (const prop of ["font-size", "font-weight", "color", "font-family"]) {
      expect(await label.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop), `Photo label ${prop}`).toBe(
        await note.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop),
      );
    }
    const photoBox = (await label.boundingBox())!;
    const optionalBox = (await page.locator("[data-photo-optional]").boundingBox())!;
    expect(optionalBox.y, "Optional sits below the Photo label").toBeGreaterThanOrEqual(photoBox.y + photoBox.height - 1);
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
    // One plain sentence that agrees with the disabled button; Mark done never queues (i1-D6/F3).
    await expect(page.getByRole("status")).toHaveText("No signal. Marking a stage done needs a connection.");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("the loading skeleton is the form's shape: same rows, about the same height (i1-D4/F6)", async ({ page }) => {
    await signInAs(page, "manager", donePage);
    const real = (await page.locator('[data-screen="stage-done"]').boundingBox())!;
    await page.goto(`${donePage}?demo=loading`);
    const skeleton = page.locator('[data-screen="stage-done"][aria-busy="true"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.locator("[data-skeleton-share-row]")).toHaveCount(3);
    await expect(skeleton.locator("[data-skeleton-field]")).toHaveCount(2);
    const box = (await skeleton.boundingBox())!;
    expect(Math.abs(box.height - real.height) / real.height, `skeleton ${box.height}px vs form ${real.height}px`).toBeLessThan(0.15);
  });

  test("the date field reads dd/mm/yyyy on every browser (i1-D14/F9)", async ({ page }) => {
    await signInAs(page, "manager", donePage);
    await expect(page.getByLabel("Finished on")).toBeVisible();
    const result = await checkDateFields(page);
    expect(result.failures).toEqual([]);
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
