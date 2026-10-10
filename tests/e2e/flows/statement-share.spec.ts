import { expect, test, type Page } from "@playwright/test";
import { Taps } from "../taps";
import { getSeed } from "../../../src/data/fake/store";

const { meta } = getSeed();

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const statements = (page: Page) => page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Statements" }) });

/**
 * flows.md "Statement share": Home → Crew → Dima → Share statement, ≤ 4 taps (the share sheet's own tap isn't counted).
 * The link opens Dima's statement with no app nav. Share isn't offered on a run that isn't approved yet.
 */
for (const role of ["manager", "owner"]) {
  test(`${role} shares Dima's statement from Home in ≤ 4 taps`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: async (d: { url: string }) => void ((window as unknown as { __shared: string }).__shared = d.url),
        configurable: true,
      });
    });
    await signInAs(page, role, "/");
    const taps = new Taps("Statement share");
    await taps.tap(page.getByRole("link", { name: "Crew", exact: true }).locator("visible=true").first());
    await expect(page).toHaveURL(/\/crew$/);
    await taps.tap(page.locator(`a[href="/crew/${meta.crew.dima}"]`).locator("visible=true").first());
    await expect(page.getByRole("heading", { level: 1, name: "Dima" })).toBeVisible();
    await taps.tap(statements(page).getByRole("button", { name: "Share statement" }).first());
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: string }).__shared ?? "")).toMatch(/\/s\/[0-9a-f]{64}$/);
    taps.assertWithin(4);

    const url = await page.evaluate(() => (window as unknown as { __shared: string }).__shared);
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: "Pay statement" })).toBeVisible();
    await expect(page.getByText("Dima", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
}

test("Share is absent before the run is approved", async ({ page }) => {
  await signInAs(page, "manager", `/crew/${meta.crew.dima}`);
  const draft = statements(page).locator("li, div").filter({ hasText: "draft, not shared until approved" }).last();
  await expect(draft).toBeVisible();
  await expect(draft.getByRole("button", { name: "Share statement" })).toHaveCount(0);
  await page.goto(`/pay/${meta.payRuns.review}`);
  await expect(page.getByRole("heading", { level: 1, name: "Pay run" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share statement" })).toHaveCount(0);
});
