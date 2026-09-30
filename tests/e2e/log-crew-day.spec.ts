import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";

const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next = "/log") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("Log crew-day grid", () => {
  test("opens on today with the job and stage to pick and nothing ticked", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager");
    await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
    await expect(page.getByText("Today, Mon 28 Sep")).toBeVisible();
    await expect(page.getByRole("button", { name: "Same as yesterday" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Save day" })).toBeDisabled();
    await expect(page.getByText("Choose a job, a stage and at least one person.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  for (const width of [360, 390]) {
    test(`the last crew row clears the pinned Save day bar at ${width} px wide`, async ({ page }, testInfo) => {
      test.skip(!isPhone(testInfo.project.name), "the bar is only fixed on a phone");
      await page.setViewportSize({ width, height: 780 });
      await signInAs(page, "manager");
      const bar = page.locator('[data-slot="primary-action"]');
      const lastRow = page.locator('[data-screen="log"] section > div > div').last();
      const clears = async () => {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const barBox = (await bar.boundingBox())!;
        const rowBox = (await lastRow.boundingBox())!;
        expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(barBox.y);
      };
      // Disabled with its reason line (the tallest normal state), then enabled.
      await expect(page.getByText("Choose a job, a stage and at least one person.")).toBeVisible();
      await clears();
      await page.getByRole("button", { name: "Same as yesterday" }).click();
      await expect(page.getByRole("button", { name: "Save day" })).toBeEnabled();
      await clears();
    });
  }

  test("Same as yesterday, one half day, Save day: 4 taps after opening Log", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await expect(page.getByLabel("Job")).toHaveValue(/.+/);
    await expect(page.getByLabel("Stage")).toHaveValue(/.+/);
    const sam = page.getByRole("button", { name: /^Sam\s/ });
    await expect(sam).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Dima\s/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("radio", { name: "½ day" }).first().click();
    await page.getByRole("button", { name: "Save day" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toContainText("Sam");
    await expect(page.getByTestId("chalk-line")).toHaveClass(/w-full/);
    await expect(page.getByRole("button", { name: "Log another stage" })).toBeVisible();
  });

  test("Same as yesterday then Save day is 3 taps", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Save day" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
  });

  test("a per-unit worker is noted as time only", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await expect(page.getByText("Paid from progress, not this grid.").first()).toBeVisible();
  });

  test("a foreman sees no money on Log", async ({ page }) => {
    await signInAs(page, "foreman");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
    const html = await page.locator("main").innerText();
    expect(html).not.toMatch(/\$\d/);
    expect(html).not.toMatch(/No rate/);
  });

  test("?demo=loading shows the skeleton", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/log?demo=loading");
    await expect(page.locator('[data-screen="log"][aria-busy="true"]')).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog, skip: { axe: true } });
  });

  test("?demo=error reaches the error screen with Try again", async ({ page }) => {
    await signInAs(page, "manager", "/log?demo=error");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("?demo=noperm shows no access", async ({ page }) => {
    await signInAs(page, "manager", "/log?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });

  test("switching to Progress and No work is one tap and keeps a demo state", async ({ page }) => {
    await signInAs(page, "manager", "/log?demo=waiting");
    await page.getByRole("radio", { name: "Progress" }).click();
    await expect(page).toHaveURL(/\/log\/progress\?demo=waiting/);
    await page.getByRole("radio", { name: "No work" }).click();
    await expect(page).toHaveURL(/\/log\/no-work\?demo=waiting/);
    await page.getByRole("radio", { name: "Crew day" }).click();
    await expect(page).toHaveURL(/\/log\?demo=waiting/);
  });

  test("an hourly person's overtime (x1.5) is sent with the day", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByLabel("Job", { exact: true }).selectOption({ index: 1 });
    await expect(page).toHaveURL(/project=/);
    await expect(page.getByLabel("Stage", { exact: true })).toBeEnabled();
    await page.getByLabel("Stage", { exact: true }).selectOption({ index: 1 });
    await expect(page).toHaveURL(/stage=/);
    await expect(page.getByLabel("Stage", { exact: true })).not.toHaveValue("");
    await page.getByRole("button", { name: /Hourly/ }).first().click();
    await page.getByRole("radio", { name: "×1.5" }).click();
    const push = page.waitForRequest((r) => r.url().endsWith("/api/sync/push"));
    await page.getByRole("button", { name: "Save day" }).click();
    expect((await push).postData()).toContain('"multiplier":150');
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
  });

  test("picking another stage keeps the people already ticked", async ({ page }) => {
    await signInAs(page, "manager");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
    const stage = page.getByLabel("Stage", { exact: true });
    const other = await stage.locator("option").evaluateAll((os, cur) => (os as HTMLOptionElement[]).find((o) => o.value && o.value !== cur)?.value ?? "", await stage.inputValue());
    await stage.selectOption(other);
    await expect(stage).toHaveValue(other);
    await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("desktop keyboard: arrows move between people, Space ticks, Enter saves", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the keyboard is for the desktop");
    await signInAs(page, "manager");
    await expect(page.getByText("Arrow keys move, Space ticks, Enter saves the day.")).toBeVisible();
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    const sam = page.getByRole("button", { name: /^Sam\s/ });
    await expect(sam).toHaveAttribute("aria-pressed", "true");
    await sam.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(":focus")).not.toHaveText(/^Sam/);
    await page.keyboard.press("ArrowUp");
    await expect(sam).toBeFocused();
    await page.keyboard.press("Space");
    await expect(sam).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Space");
    await expect(sam).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toContainText("Sam");
  });

  test("the chalk line snaps under the date instantly with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInAs(page, "manager");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await page.getByRole("button", { name: "Save day" }).click();
    await expect(page.getByTestId("chalk-line")).toHaveCSS("transition-duration", "0s");
    await expect(page.getByTestId("chalk-line")).toHaveClass(/w-full/);
  });

  test("the date stroke and the ticked check box are the heavy ones", async ({ page }) => {
    await signInAs(page, "manager");
    expect(await page.locator('[data-slot="date-rule"]').evaluate((el) => getComputedStyle(el).height)).toBe("2px");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    const box = page.getByRole("button", { name: /^Sam\s/ }).locator('span[aria-hidden="true"]');
    await expect(box).toHaveCSS("border-top-width", "2px");
  });

  test("?demo=empty tells a manager to add a job, and a foreman they can log once a manager adds them", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/log?demo=empty");
    await expect(page.getByText("No jobs yet. Add your first job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your first job" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await signInAs(page, "foreman", "/log?demo=empty");
    await expect(page.getByText("You can log once a manager adds you to a job.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your first job" })).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("?demo=offline shows the banner; ?demo=waiting and ?demo=attention show the outbox badge", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/log?demo=offline");
    await expect(page.getByText("No signal — entries are saved on this device and will send automatically.")).toBeVisible();
    await signInAs(page, "manager", "/log?demo=waiting");
    await expect(page.getByRole("link", { name: "3 to send" })).toBeVisible();
    await signInAs(page, "manager", "/log?demo=attention");
    await expect(page.getByRole("link", { name: "1 entry needs attention" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a foreman's Log has no money in any state, and passes the guards", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "foreman");
    await page.getByRole("button", { name: "Same as yesterday" }).click();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await expectNoMoney(page, ["/log", "/log?demo=empty", "/log?demo=loading", "/log?demo=offline", "/log?demo=waiting", "/log?demo=attention", "/log?demo=noperm"]);
  });
});
