import { expect, test, type Page } from "@playwright/test";
import { waitForHydrated } from "../e2e/guards";
import { ABN, choose, fillBusinessToCrew, ownerPool, signUpAndVerify, uniqueEmail } from "./journey";

// Spec 5.1: a new Owner goes from sign-up to a working crew in a few minutes. The target is logged, not asserted tight.
const TARGET_MS = 5 * 60_000;

async function addCrew(page: Page, name: string, kind: "Employee" | "ABN contractor", basis: "Hourly" | "Daily", rate: string) {
  await page.getByRole("button", { name: "Add crew member", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await choose(page, "Type", kind);
  await choose(page, "Paid by", basis);
  await page.getByLabel(`${basis} rate`, { exact: true }).fill(rate);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("list", { name: "Crew added" }).getByText(name)).toBeVisible();
}

test("a new owner signs up, verifies, sets up the business and two crew, and the rows are in the database", async ({ page }) => {
  const started = Date.now();
  const email = uniqueEmail("onboard");
  const business = `Onboard Roofing ${Date.now().toString(36)}`;

  await signUpAndVerify(page, email);
  await fillBusinessToCrew(page, business);

  await expect(page.getByText("Step 4 of 5")).toBeVisible();
  await waitForHydrated(page);
  await addCrew(page, "Hourly Harry", "Employee", "Hourly", "45");
  await addCrew(page, "Daily Dave", "ABN contractor", "Daily", "420");

  // A reload resumes on the crew step with both people read back from the database, not from the page's memory.
  await page.reload();
  await waitForHydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "Your crew" })).toBeVisible();
  const added = page.getByRole("list", { name: "Crew added" });
  await expect(added.getByText("Hourly Harry")).toBeVisible();
  await expect(added.getByText("Daily Dave")).toBeVisible();

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Put Roofy on your phone" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Done: the wizard hands off to Home. (Home itself is not built on the real database until a later phase, so only the address is checked.)
  await expect(page).toHaveURL(/^[^?#]*\/$/);

  const elapsed = Date.now() - started;
  console.log(`[onboarding.db] sign-up to done: ${(elapsed / 1000).toFixed(1)} s (${test.info().project.name}; target under ${TARGET_MS / 60_000} min)`);
  expect(elapsed).toBeLessThan(TARGET_MS);

  // Direct query as the owner: exactly these two crew and one rate each, in the new workspace and no other.
  const pool = ownerPool();
  try {
    const ws = await pool.query<{ id: string; onboarding_step: string }>(
      `select id, onboarding_step from workspace where name = $1`,
      [business],
    );
    expect(ws.rows, "one workspace with that business name").toHaveLength(1);
    const workspaceId = ws.rows[0]!.id;
    const crew = await pool.query<{ name: string; type: string; default_basis: string }>(
      `select name, type, default_basis from crew_member where workspace_id = $1 order by name`,
      [workspaceId],
    );
    expect(crew.rows.map((r) => [r.name, r.type, r.default_basis])).toEqual([
      ["Daily Dave", "contractor", "daily"],
      ["Hourly Harry", "employee", "hourly"],
    ]);
    const rates = await pool.query<{ name: string; basis: string; amount_cents: string }>(
      `select c.name, r.basis, r.amount_cents from rate r join crew_member c on c.workspace_id = r.workspace_id and c.id = r.crew_member_id where r.workspace_id = $1 order by c.name`,
      [workspaceId],
    );
    expect(rates.rows.map((r) => [r.name, r.basis, String(r.amount_cents)])).toEqual([
      ["Daily Dave", "daily", "42000"],
      ["Hourly Harry", "hourly", "4500"],
    ]);
    expect(ws.rows[0]!.onboarding_step, "the wizard is finished in the database").toBe("done");
    const abn = await pool.query<{ abn: string | null }>(`select abn from workspace where id = $1`, [workspaceId]);
    expect(abn.rows[0]!.abn?.replace(/\s/g, "")).toBe(ABN.replace(/\s/g, ""));
  } finally {
    await pool.end();
  }
});
