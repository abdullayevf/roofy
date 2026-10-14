import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "Sign in with two-factor": from sign in, at most 6 taps. The prototype's two-factor account asks for a code after the password. */
test("Sign in with two-factor: Email, Password, Sign in, Code, Check code is 5 taps", async ({ page }) => {
  await page.goto("/sign-in");
  const taps = new Taps("Sign in with two-factor");
  await taps.fill(page.getByLabel("Email"), "owner-2fa@harbourroofing.example");
  await taps.fill(page.getByLabel("Password"), "a-long-password");
  await taps.tap(page.getByRole("button", { name: "Sign in", exact: true }));
  await expect(page.getByRole("heading", { level: 1, name: "Enter your code" })).toBeVisible();
  await taps.fill(page.getByLabel("Code"), "482913");
  await taps.tap(page.getByRole("button", { name: "Check code", exact: true }));
  await expect(page).toHaveURL(/\/$/);
  expect(taps.count).toBe(5);
  taps.assertWithin(6);
});
