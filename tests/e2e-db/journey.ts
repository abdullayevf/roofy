import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { waitForHydrated } from "../e2e/guards";
import { e2eDatabaseUrls } from "./env";
import { mailCount, mailLink } from "./mail";

export const PASSWORD = "Roofy-e2e-pass-1";
export const ABN = "51 824 753 556";

let counter = 0;

/** A new address per call, so the database rate limits and the one-account-per-email rule never meet across tests. */
export function uniqueEmail(tag: string): string {
  counter += 1;
  return `${tag}-${Date.now().toString(36)}-${process.pid}-${counter}@e2e.roofy.test`;
}

/** Sign up with email and password, then open the verification link from the mail log (the real link, not a shortcut). */
export async function signUpAndVerify(page: Page, email: string, password = PASSWORD): Promise<void> {
  const before = mailCount();
  await page.goto("/sign-up");
  await waitForHydrated(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const link = await mailLink(email, { after: before, subject: /verify|confirm/i });
  await page.goto(link);
}

/** Picks one chip of a choice group; the real radio sits over the chip, so it is the radio that is checked. */
export async function choose(page: Page, group: string, option: string): Promise<void> {
  await page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: option, exact: true }).check();
}

/** Business, trade and defaults, as the wizard asks; leaves the page on the crew step. */
export async function fillBusinessToCrew(page: Page, businessName: string): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: "Your business" })).toBeVisible();
  await waitForHydrated(page);
  await page.getByLabel("Business name", { exact: true }).fill(businessName);
  await page.getByLabel("ABN", { exact: true }).fill(ABN);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your trade" })).toBeVisible();
  await choose(page, "Trade", "Roofing");
  await expect(page.getByRole("heading", { level: 1, name: "Stages and categories" })).toBeVisible();
  await page.getByRole("button", { name: "Use these", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your crew" })).toBeVisible();
}

/** The rest of the wizard with no crew: crew, install, done. Leaves the page on Home. */
export async function finishWizard(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Put Roofy on your phone" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).not.toHaveURL(/\/onboarding/);
}

/** Sign in on /sign-in with email and password. */
export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await waitForHydrated(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** A pool on the owner role of roofy_e2e (a superuser, so row-level security does not hide rows from the check). */
export function ownerPool(): Pool {
  const url = e2eDatabaseUrls().MIGRATE_DATABASE_URL;
  if (!url) throw new Error("No TEST_MIGRATE_DATABASE_URL in .env: cannot open roofy_e2e as its owner.");
  return new Pool({ connectionString: url, max: 1 });
}
