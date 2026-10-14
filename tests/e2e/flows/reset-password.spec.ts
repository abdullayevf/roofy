import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "Reset password": from sign in, at most 7 taps; the emailed link is opened by URL (not counted). */
test("Reset password: Forgot password?, Email, Send link, New password, Set password, Sign in is 6 taps", async ({
  page,
}) => {
  await page.goto("/sign-in");
  const taps = new Taps("Reset password");
  await taps.tap(page.getByRole("link", { name: "Forgot password?" }));
  await expect(page.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeVisible();
  await taps.fill(page.getByLabel("Email"), "karen@harbourroofing.example");
  await taps.tap(page.getByRole("button", { name: "Send link", exact: true }));
  await expect(page.getByText("If that email has an account")).toBeVisible();
  await page.goto("/reset-password?token=good-link");
  await taps.fill(page.getByLabel("New password"), "a-long-password");
  await taps.tap(page.getByRole("button", { name: "Set password", exact: true }));
  await expect(page.getByText("Your password is set.")).toBeVisible();
  await taps.tap(page.getByRole("link", { name: "Sign in", exact: true }));
  await expect(page).toHaveURL(/\/sign-in/);
  expect(taps.count).toBe(6);
  taps.assertWithin(7);
});
