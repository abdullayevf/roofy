import { expect, test } from "@playwright/test";
import { waitForHydrated } from "../guards";
import { Taps } from "../taps";

/**
 * flows.md "Onboarding to first log": sign up, set up, one crew member, one job, the first day logged in ≤ 25 taps and
 * under 10 min. The scripted run spends a person's 500 ms think time before every tap and fill (typing itself is
 * instant here), so a fast run passes easily: it catches a flow that hangs or waits, not slow human typing.
 */
const THINK_MS = 500;
const MAX_MS = 600_000;

test("Onboarding to first log: sign-up to the first day saved within 25 taps (typing not counted) and 10 min", async ({ page }) => {
  test.setTimeout(MAX_MS + 60_000);
  await page.goto("/sign-up");
  await waitForHydrated(page);
  const taps = new Taps("Onboarding to first log", { thinkMs: THINK_MS });
  await taps.tap(page.getByRole("button", { name: "Continue with Google" }));
  await expect(page.getByRole("heading", { name: "Your business" })).toBeVisible();
  await waitForHydrated(page);
  await taps.fill(page.getByLabel("Business name"), "Smith Roofing");
  await taps.fill(page.getByLabel("ABN"), "51 824 753 556");
  await taps.tap(page.getByRole("checkbox", { name: "GST registered" }));
  await taps.tap(page.getByRole("button", { name: "Continue" }));
  await taps.tap(page.getByRole("radio", { name: "Roofing" }));
  await taps.tap(page.getByRole("button", { name: "Use these" }));
  await taps.tap(page.getByRole("button", { name: "Add crew member" }));
  await taps.fill(page.getByLabel("Name", { exact: true }), "Sam");
  await taps.tap(page.getByRole("radio", { name: "Daily" }));
  await taps.fill(page.getByLabel("Daily rate"), "320.00");
  await taps.tap(page.getByRole("button", { name: "Add", exact: true }));
  await expect(page.getByRole("list", { name: "Crew added" })).toContainText("Sam");
  await taps.tap(page.getByRole("button", { name: "Continue" }));
  await expect(page.getByRole("heading", { name: "Put Roofy on your phone" })).toBeVisible();
  await taps.tap(page.getByRole("button", { name: "Continue" }));
  await taps.tap(page.getByRole("link", { name: "Add your first job" }).first());
  await waitForHydrated(page);
  await taps.tap(page.getByRole("button", { name: "Quick-add client" }));
  await taps.fill(page.getByLabel("Client name"), "Smith");
  await taps.tap(page.getByRole("button", { name: "Save client" }));
  await taps.tap(page.getByRole("radio", { name: "Metal re-roof" }));
  await taps.fill(page.getByLabel("Site address"), "12 Pitt St, Ryde");
  await taps.tap(page.getByRole("button", { name: "Accept stages" }).first());
  await taps.tap(page.getByRole("button", { name: "Create job" }));
  await taps.tap(page.getByRole("link", { name: "Log today on this job" }));
  await waitForHydrated(page);
  await taps.tap(page.getByRole("button", { name: /^Sam/ }));
  await taps.tap(page.getByRole("button", { name: "Save day" }));
  await expect(page.getByRole("status").filter({ hasText: "Logged" })).toContainText("Sam");
  taps.assertWithin(25, { maxMs: MAX_MS });
});
