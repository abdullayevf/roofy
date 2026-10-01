import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "Outbox needs attention": from the badge (or the foreman's Outbox tab), at most 5 taps. */
test("Fix a rejected crew day and resend it: badge, Edit and resend, a different stage, Save day is 4 taps", async ({ page }) => {
  await page.goto("/prototype/role?as=manager&next=%2F%3Fdemo%3Dattention");
  const taps = new Taps("Outbox needs attention");
  await taps.tap(page.getByRole("link", { name: "1 entry needs attention" }));
  await expect(page).toHaveURL(/\/outbox/);
  await expect(page.getByText("Smith job was archived. Pick another job.")).toBeVisible();
  await taps.tap(page.getByRole("link", { name: "Edit and resend" }));
  await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Dima\s/ })).toHaveAttribute("aria-pressed", "true");
  const stage = page.getByLabel("Stage", { exact: true });
  const current = await stage.inputValue();
  const other = await stage.locator("option").evaluateAll((os, cur) => (os as HTMLOptionElement[]).find((o) => o.value && o.value !== cur)?.value ?? "", current);
  expect(other).not.toBe("");
  await taps.choose(stage, other);
  await expect(page).toHaveURL(new RegExp(`stage=${other}`));
  await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
  await taps.tap(page.getByRole("button", { name: "Save day" }));
  await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
  expect(taps.count).toBe(4);
  taps.assertWithin(5);
});

test("A foreman opens the Outbox tab, and Discard is Discard, Discard entry", async ({ page }) => {
  await page.goto("/prototype/role?as=foreman&next=%2F%3Fdemo%3Dattention");
  const taps = new Taps("Outbox discard");
  await taps.tap(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Outbox/ }));
  await expect(page).toHaveURL(/\/outbox/);
  await taps.tap(page.getByRole("button", { name: "Discard", exact: true }));
  await taps.tap(page.getByRole("button", { name: "Discard entry" }));
  await expect(page.getByText("Nothing is waiting to send.")).toBeVisible();
  taps.assertWithin(5);
});

test("Edit and resend for a foreman reopens the entry with the people ticked", async ({ page }) => {
  await page.goto("/prototype/role?as=foreman&next=%2Foutbox%3Fdemo%3Dattention");
  await page.getByRole("link", { name: "Edit and resend" }).click();
  await expect(page.getByRole("button", { name: /^Sam\s/ })).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("main").innerText()).not.toMatch(/\$\d/);
});
