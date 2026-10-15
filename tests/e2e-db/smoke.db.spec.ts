import { expect, test } from "@playwright/test";

// Proves the db-mode server is up on 3101 and really is in db mode, before any journey spec relies on it.
test("sign-in loads, and a signed-out visit to the home page is sent there", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  // Fake mode starts every visitor signed in as the demo owner; only db mode sends them to sign in.
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in(\?|$)/);
});
