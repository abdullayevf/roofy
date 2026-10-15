import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { waitForHydrated } from "../e2e/guards";
import { fillBusinessToCrew, finishWizard, ownerPool, PASSWORD, signIn, signUpAndVerify, uniqueEmail } from "./journey";
import { mailCount, mailLink } from "./mail";
import { totpCode } from "./totp";

/** Where a returning owner with a finished set-up lands: Home, the root address (Home itself is not built on the real database yet). */
const HOME = /^[^?#]*\/$/;

/** A verified owner with a finished set-up, signed out again: what a returning person looks like. */
async function returningOwner(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await signUpAndVerify(page, email);
  await fillBusinessToCrew(page, `Signin ${tag} ${Date.now().toString(36)}`);
  await finishWizard(page);
  await page.context().clearCookies();
  return email;
}

test("a wrong password says so in plain words, keeps the email, and stays on sign in", async ({ page }) => {
  const email = await returningOwner(page, "wrongpw");
  await signIn(page, email, "not-the-password-1");
  // The refusal for a wrong password (WRONG_PASSWORD); "Couldn't sign you in" is only the unavailable fallback.
  await expect(page.getByRole("alert").getByText("That email and password don't match. Check them and try again.")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
});

test("a reset link sets a new password, and the new password signs in", async ({ page }) => {
  const email = await returningOwner(page, "reset");
  const before = mailCount();
  await page.goto("/forgot-password");
  await waitForHydrated(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send link", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
  const link = await mailLink(email, { after: before, subject: /password|reset/i });
  await page.goto(link);
  await waitForHydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeVisible();
  const fresh = `${PASSWORD}-new`;
  await page.getByLabel("New password", { exact: true }).fill(fresh);
  await page.getByRole("button", { name: "Set password", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Password changed" })).toBeVisible();
  await signIn(page, email, fresh);
  await expect(page).toHaveURL(HOME);
});

test("with two-factor on, sign in asks for the code, and the code from the set-up key lets the owner in", async ({ page }) => {
  const email = await returningOwner(page, "totp");
  await signIn(page, email);
  await expect(page).toHaveURL(HOME);

  await page.goto("/settings/two-factor");
  await waitForHydrated(page);
  await page.getByLabel("Your password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Show QR code", exact: true }).click();
  const key = (await page.getByText(/^[A-Z2-7 ]{16,}$/).first().innerText()).trim();
  await page.getByLabel("Code", { exact: true }).fill(totpCode(key));
  await page.getByRole("button", { name: "Turn on two-factor", exact: true }).click();
  await expect(page.getByText("Two-factor is on.", { exact: false })).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, email);
  await expect(page.getByRole("heading", { level: 1, name: "Enter your code" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(totpCode(key));
  await page.getByRole("button", { name: "Check code", exact: true }).click();
  await expect(page).toHaveURL(HOME);
});

/** Workspace B, made straight in the database: one workspace, one crew member, one member (a user with the Manager role). */
async function makeWorkspaceB(): Promise<{ crewId: string; memberName: string }> {
  const pool = ownerPool();
  const crewId = randomUUID();
  const memberName = `Bee Outsider ${Date.now().toString(36)}`;
  try {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await pool.query(`insert into workspace (id, name, timezone) values ($1, $2, 'Australia/Sydney')`, [workspaceId, `Tenant B ${Date.now().toString(36)}`]);
    await pool.query(`insert into crew_member (id, workspace_id, name, type, active_from) values ($1, $2, 'Bee Crew', 'employee', '2026-01-01')`, [crewId, workspaceId]);
    await pool.query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [userId, memberName, `${userId}@e2e.roofy.test`]);
    await pool.query(`insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, 'manager')`, [randomUUID(), workspaceId, userId]);
  } finally {
    await pool.end();
  }
  return { crewId, memberName };
}

test("workspace A's Members screen lists A's people and none of workspace B's", async ({ page }) => {
  const email = await returningOwner(page, "tenantA");
  const b = await makeWorkspaceB();
  await signIn(page, email);
  await expect(page).toHaveURL(HOME);
  await page.goto("/settings/members");
  await expect(page.getByRole("heading", { level: 2, name: "People" })).toBeVisible();
  // The row's second line is one span, "<email>" then "Owner" on the next line, so this finds A's own row and nothing else.
  await expect(page.getByText(new RegExp(`^\\s*${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Owner\\s*$`))).toBeVisible();
  await expect(page.getByText(b.memberName)).toHaveCount(0);
});

// Crew is an "unavailable" stub in db mode until Phase 4 (plan 04-db-auth.md line 392), so /crew/<id> shows the error page, not "Page not found".
test.fixme("a person in workspace A who opens workspace B's crew id gets the not-found page, the same as for an id that does not exist", async ({ page }) => {
  const email = await returningOwner(page, "tenantCrew");
  const b = await makeWorkspaceB();
  await signIn(page, email);
  for (const id of [b.crewId, randomUUID()]) {
    await page.goto(`/crew/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Bee Crew")).toHaveCount(0);
  }
});
