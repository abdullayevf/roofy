import { expect, test } from "@playwright/test";
import { Taps } from "../taps";

/** flows.md "Verify email": from sign up, at most 4 taps; the emailed link checks itself on arrival. */
test("Verify email: Email, Password, Create account is 3 taps, then the link lands on set-up", async ({
  page,
}) => {
  await page.goto("/sign-up");
  const taps = new Taps("Verify email");
  await taps.fill(page.getByLabel("Email"), "new.owner@example.com");
  await taps.fill(page.getByLabel("Password"), "a-long-password");
  await taps.tap(page.getByRole("button", { name: "Create account", exact: true }));
  // The demo data store skips the email step, so sign up lands on set-up; the real store routes to /check-email.
  await expect(page).toHaveURL(/\/onboarding/);
  // outside the count: opens the page the real store sends a new account to, and the emailed link.
  await page.goto("/check-email?email=new.owner%40example.com");
  await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
  await expect(page.getByText("new.owner@example.com")).toBeVisible();
  await page.goto("/verify?token=good-link");
  await expect(page).toHaveURL(/\/onboarding/);
  expect(taps.count).toBe(3);
  taps.assertWithin(4);
});
