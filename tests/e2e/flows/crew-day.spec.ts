import { expect, test, type Page } from "@playwright/test";
import { Taps } from "../taps";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name });

/** The scripted run must finish inside flows.md's 30 s with a person's 500 ms think time before every tap. */
const THINK_MS = 500;
const MAX_MS = 30_000;

/** flows.md "Log a full crew-day": from Home, at most 6 taps (designed: 4) and under 30 s. */
for (const role of ["manager", "foreman"]) {
  test(`Log a full crew-day as ${role}: Log, Same as yesterday, one half day, Save day is 4 taps`, async ({ page }) => {
    await page.goto(`/prototype/role?as=${role}&next=%2F`);
    const taps = new Taps("Log a full crew-day", { thinkMs: THINK_MS });
    await taps.tap(tab(page, "Log"));
    await expect(page.getByText("Today, Mon 28 Sep")).toBeVisible();
    await taps.tap(page.getByRole("button", { name: "Same as yesterday" }));
    await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
    await taps.tap(page.getByRole("radio", { name: "½ day" }).first());
    await taps.tap(page.getByRole("button", { name: "Save day" }));
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toContainText("Sam");
    expect(taps.count).toBe(4);
    taps.assertWithin(6, { maxMs: MAX_MS });
  });
}
