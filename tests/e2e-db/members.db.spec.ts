import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { waitForHydrated } from "../e2e/guards";
import { expectNoMoney } from "../e2e/money-scan";
import { E2E_BASE_URL } from "./env";
import {
  fillBusinessToCrew,
  finishWizard,
  ownerPool,
  PASSWORD,
  signUpAndVerify,
  uniqueEmail,
  uniqueName,
} from "./journey";
import { mailCount, mailLink } from "./mail";

/**
 * Task 14, members: the Owner invites a foreman from /settings/members, the mailed link lets a second browser context
 * join, the foreman sees no money and is refused the members page, and the member actions refuse a foreman and
 * another workspace's member id. Every test has its own addresses (the database rate limits stay on).
 */

const FOREMAN_NAME = "Frankie Foreman";

/** Money-bearing and admin routes plus every shell section: the foreman opens them (or is refused) with no figure on any. */
const FOREMAN_PATHS = [
  "/",
  "/jobs",
  "/log",
  "/outbox",
  "/expenses",
  "/more",
  "/install",
  "/pay",
  "/reports",
  "/settings",
  "/settings/members",
  "/settings/levels",
  "/settings/on-cost",
  "/settings/templates",
  "/settings/business",
  "/settings/pay-period",
  "/settings/categories",
  "/settings/assignments",
  "/settings/two-factor",
  "/history",
  "/export",
  "/crew",
];

type Team = {
  owner: Page;
  foreman: Page;
  ownerEmail: string;
  foremanEmail: string;
  businessName: string;
  inviteLink: string;
  close: () => Promise<void>;
};

/** The device the project runs on, for a second context (a context made from `browser` does not inherit the project's `use`). */
async function secondContext(browser: Browser, testInfo: TestInfo) {
  const use = testInfo.project.use;
  return browser.newContext({
    baseURL: E2E_BASE_URL,
    viewport: use.viewport ?? undefined,
    userAgent: use.userAgent,
    deviceScaleFactor: use.deviceScaleFactor,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
  });
}

/** An Owner with a finished set-up invites a foreman by email; the foreman opens the mailed link in a second context, creates an account, verifies and joins. */
async function ownerAndJoinedForeman(browser: Browser, owner: Page, testInfo: TestInfo): Promise<Team> {
  const ownerEmail = uniqueEmail("owner-members");
  const foremanEmail = uniqueEmail("foreman");
  const businessName = uniqueName("Members");
  await signUpAndVerify(owner, ownerEmail);
  await fillBusinessToCrew(owner, businessName);
  await finishWizard(owner);

  await owner.goto("/settings/members");
  await expect(owner.getByRole("heading", { level: 1, name: "Members & roles" })).toBeVisible();
  await waitForHydrated(owner);
  const beforeInvite = mailCount();
  await owner.getByLabel("Name", { exact: true }).fill(FOREMAN_NAME);
  await owner.getByLabel("Email", { exact: true }).fill(foremanEmail);
  await owner.getByRole("button", { name: "Send invite", exact: true }).click();
  await expect(owner.getByText("Invite sent.", { exact: true })).toBeVisible();
  const inviteLink = await mailLink(foremanEmail, { after: beforeInvite, subject: /invited you/i });
  expect(new URL(inviteLink).pathname).toMatch(/^\/invite\/[^/]+$/);

  const context = await secondContext(browser, testInfo);
  const foreman = await context.newPage();
  // The new person goes straight to the sign-up the signed-out invite page links to (that page has its own test
  // below), which carries the invite path back after verifying.
  await foreman.goto(`/sign-up?next=${encodeURIComponent(new URL(inviteLink).pathname)}`);
  await waitForHydrated(foreman);
  const beforeVerify = mailCount();
  await foreman.getByLabel("Email", { exact: true }).fill(foremanEmail);
  await foreman.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await foreman.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(foreman.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
  await foreman.goto(await mailLink(foremanEmail, { after: beforeVerify, subject: /verify|confirm/i }));

  // Verifying comes back to the invite, which names the team and the role.
  await expect(foreman.getByRole("heading", { level: 1, name: `Join ${businessName}` })).toBeVisible();
  await expect(
    foreman.getByText("You've been invited to Roofy as a foreman.", { exact: true }),
  ).toBeVisible();
  await waitForHydrated(foreman);
  await foreman.getByRole("button", { name: "Join team", exact: true }).click();
  await expect(foreman).toHaveURL(new RegExp(`^${E2E_BASE_URL}/$`));
  return { owner, foreman, ownerEmail, foremanEmail, businessName, inviteLink, close: () => context.close() };
}

/** The foreman's member id, read as the database owner. */
async function memberIdOf(email: string): Promise<string> {
  const pool = ownerPool();
  try {
    const { rows } = await pool.query<{ id: string }>(
      `select m.id from member m join "user" u on u.id = m.user_id where u.email = $1`,
      [email],
    );
    expect(rows, `member rows for ${email}`).toHaveLength(1);
    return rows[0]!.id;
  } finally {
    await pool.end();
  }
}

async function roleOf(memberId: string): Promise<string | undefined> {
  const pool = ownerPool();
  try {
    const { rows } = await pool.query<{ role: string }>(`select role from member where id = $1`, [memberId]);
    return rows[0]?.role;
  } finally {
    await pool.end();
  }
}

/** Workspace B straight in the database: a workspace with one manager. Returns that member's id. */
async function makeWorkspaceB(): Promise<string> {
  const pool = ownerPool();
  const memberId = randomUUID();
  try {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await pool.query(`insert into workspace (id, name, timezone) values ($1, $2, 'Australia/Sydney')`, [
      workspaceId,
      `Tenant B ${Date.now().toString(36)}`,
    ]);
    await pool.query(`insert into "user" (id, name, email) values ($1, 'Bee Manager', $2)`, [
      userId,
      `${userId}@e2e.roofy.test`,
    ]);
    await pool.query(`insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, 'manager')`, [
      memberId,
      workspaceId,
      userId,
    ]);
  } finally {
    await pool.end();
  }
  return memberId;
}

test("the Owner invites a foreman and the mailed link lets a second browser context join", async ({
  page,
  browser,
}, testInfo) => {
  const team = await ownerAndJoinedForeman(browser, page, testInfo);
  try {
    // The database: the owner and the foreman are the workspace's two members; the invitation is accepted.
    const pool = ownerPool();
    try {
      const people = await pool.query<{ email: string; role: string }>(
        `select u.email, m.role from member m join "user" u on u.id = m.user_id join workspace w on w.id = m.workspace_id
         where w.name = $1 order by m.created_at, m.id`,
        [team.businessName],
      );
      expect(people.rows).toEqual([
        { email: team.ownerEmail, role: "owner" },
        { email: team.foremanEmail, role: "foreman" },
      ]);
      const invites = await pool.query<{ status: string; role: string }>(
        `select status, role from invitation where email = $1`,
        [team.foremanEmail],
      );
      expect(invites.rows).toEqual([{ status: "accepted", role: "foreman" }]);
    } finally {
      await pool.end();
    }

    // The owner's members screen now lists the foreman, as a foreman.
    await team.owner.goto("/settings/members");
    const row = team.owner.getByRole("button").filter({ hasText: team.foremanEmail });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Foreman");

    // The foreman: no money on any page the shell has, and the members page is refused outright.
    await expectNoMoney(team.foreman, FOREMAN_PATHS);
    await team.foreman.goto("/settings/members");
    await expect(team.foreman.getByRole("heading", { name: "No access" })).toBeVisible();
    await expect(team.foreman.getByText("Invite someone")).toHaveCount(0);
    await expect(team.foreman.getByRole("button", { name: "Send invite" })).toHaveCount(0);
    await expect(team.foreman.getByText(team.ownerEmail)).toHaveCount(0);

    // The used invite link no longer offers a second join.
    await team.foreman.goto(team.inviteLink);
    // (The exact "This invite can't be used" page is asserted in its own test below.)
    await expect(team.foreman.getByRole("button", { name: "Join team", exact: true })).toHaveCount(0);
  } finally {
    await team.close();
  }
});

type Call = (as: Page, memberId: string, role: string) => Promise<string>;

/**
 * Learns the real "change role" server action from the owner's own screen (Change role, Accountant, Save role): the
 * request is caught and dropped, so nothing changes. Returns a function that sends that action as any signed-in person
 * with any member id and role, and gives back the RSC text the server answers with.
 */
async function learnSetRoleAction(owner: Page, foremanEmail: string, foremanMemberId: string): Promise<Call> {
  let caught: { url: string; headers: Record<string, string> } | undefined;
  await owner.route("**/settings/members*", async (route) => {
    const request = route.request();
    const headers = request.headers();
    if (request.method() === "POST" && headers["next-action"]) {
      caught = { url: request.url(), headers };
      await route.abort();
    } else await route.continue();
  });
  await owner.goto("/settings/members");
  await waitForHydrated(owner);
  await owner.getByRole("button").filter({ hasText: foremanEmail }).click();
  const accountant = owner.getByRole("radio", { name: "Accountant", exact: true });
  await expect(accountant).toBeVisible();
  await accountant.check();
  await owner.getByRole("button", { name: "Save role", exact: true }).click();
  await expect.poll(() => caught, { message: "the Save role click sent a server action" }).toBeDefined();
  await owner.unroute("**/settings/members*");
  expect(await roleOf(foremanMemberId), "the caught request never reached the server").toBe("foreman");
  const action = caught!;
  return async (as, memberId, role) => {
    const response = await as.request.post(action.url, {
      headers: {
        "next-action": action.headers["next-action"]!,
        "content-type": action.headers["content-type"] ?? "text/plain;charset=UTF-8",
        accept: "text/x-component",
      },
      data: JSON.stringify([memberId, role]),
    });
    return response.text();
  };
}

test("member actions change nothing for a foreman or for another workspace's member id", async ({ page, browser }, testInfo) => {
  const team = await ownerAndJoinedForeman(browser, page, testInfo);
  try {
    const foremanMemberId = await memberIdOf(team.foremanEmail);
    const ownerMemberId = await memberIdOf(team.ownerEmail);
    const otherWorkspaceMemberId = await makeWorkspaceB();
    const call = await learnSetRoleAction(team.owner, team.foremanEmail, foremanMemberId);

    // A foreman cannot promote himself or change anyone: the call does not succeed and no role moves.
    expect(await call(team.foreman, foremanMemberId, "owner")).toContain('"code":"forbidden"');
    expect(await call(team.foreman, ownerMemberId, "foreman")).toContain('"code":"forbidden"');
    expect(await roleOf(foremanMemberId)).toBe("foreman");
    expect(await roleOf(ownerMemberId)).toBe("owner");

    // The Owner of workspace A cannot reach workspace B's member id, and B's manager keeps the role.
    expect(await call(team.owner, otherWorkspaceMemberId, "foreman")).toContain('"code":"not_found"');
    expect(await roleOf(otherWorkspaceMemberId)).toBe("manager");

    // Control: the same call on A's own foreman does change the role, so the refusals above are not a dead action.
    expect(await call(team.owner, foremanMemberId, "accountant")).toContain('"ok":true');
    expect(await roleOf(foremanMemberId)).toBe("accountant");
  } finally {
    await team.close();
  }
});

// Guards the Task 14 fix 55f7277: the db services load from instrumentation.ts with their own copy of contracts.ts, so
// `instanceof DataError` failed and refusals answered "unavailable". isDataError now checks a shared brand.
test("a refused member action answers with the plain code and sentence", async ({ page, browser }, testInfo) => {
  const team = await ownerAndJoinedForeman(browser, page, testInfo);
  try {
    const foremanMemberId = await memberIdOf(team.foremanEmail);
    const otherWorkspaceMemberId = await makeWorkspaceB();
    const call = await learnSetRoleAction(team.owner, team.foremanEmail, foremanMemberId);
    const byForeman = await call(team.foreman, foremanMemberId, "owner");
    expect(byForeman).toContain('"code":"forbidden"');
    expect(byForeman).toContain("You don't have access to this.");
    const crossTenant = await call(team.owner, otherWorkspaceMemberId, "foreman");
    expect(crossTenant).toContain('"code":"not_found"');
    expect(crossTenant).toContain("We couldn't find this member.");
  } finally {
    await team.close();
  }
});

// Guards the same fix: the signed-out invite page once showed "Couldn't load this invite" instead of "Sign in to join".
test("a signed-out visitor who opens an invite link is asked to sign in or create an account", async ({ browser }, testInfo) => {
  const context = await secondContext(browser, testInfo);
  try {
    const visitor = await context.newPage();
    await visitor.goto(`/invite/${randomUUID()}`);
    await expect(visitor.getByRole("heading", { level: 1, name: "Sign in to join" })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Create an account", exact: true })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

// Guards the same fix: a used invite link once showed "Couldn't load this invite" instead of "This invite can't be used".
test("a used invite link says the invite can't be used", async ({ page, browser }, testInfo) => {
  const team = await ownerAndJoinedForeman(browser, page, testInfo);
  try {
    await team.foreman.goto(team.inviteLink);
    await expect(team.foreman.getByRole("heading", { level: 1, name: "This invite can't be used" })).toBeVisible();
    await expect(team.foreman.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  } finally {
    await team.close();
  }
});
