import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";

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
});
