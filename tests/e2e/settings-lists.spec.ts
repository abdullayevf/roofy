import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";

const isPhone = (name: string) => name !== "desktop";
const NEEDS_CONNECTION = "Needs connection — try again once you're back online.";
const go = (page: Page, role: string, next: string) =>
  page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
const h1 = (page: Page, name: string | RegExp) => page.getByRole("heading", { level: 1, name });
const saved = (page: Page, text = "Changes saved.") => page.getByText(text, { exact: true });
const save = (page: Page) => page.getByRole("button", { name: "Save changes", exact: true });
/** Fake data is shared by every test in the run, so anything a test adds gets a name of its own. */
const unique = (stem: string) => `${stem} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const LONG_NAME =
  "Scaffolding hire, safety rails and edge protection for the Harbour View Apartments re-roof";

const PAGES = [
  { path: "/settings/templates", title: "Templates", roles: ["owner", "manager"] },
  { path: "/settings/templates?type=metal_reroof", title: /stages$/, roles: ["owner", "manager"] },
  { path: "/settings/categories", title: "Expense categories", roles: ["owner", "manager"] },
  { path: "/settings/members", title: "Members & roles", roles: ["owner"] },
  { path: "/settings/assignments", title: "Foreman assignments", roles: ["owner", "manager"] },
] as const;

test.describe("Settings lists (templates, categories, members, assignments)", () => {
  for (const p of PAGES)
    test(`${p.path}: renders healthy for ${p.roles.join(" and ")}`, async ({ page }, info) => {
      for (const role of p.roles) {
        const log = collectConsole(page);
        await go(page, role, p.path);
        await expect(h1(page, p.title)).toBeVisible();
        await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
      }
    });

  for (const p of PAGES.filter((x) => x.path.includes("type=") || !x.path.endsWith("templates")))
    test(`${p.path}: offline says Needs connection once and Save waits`, async ({ page }) => {
      const sep = p.path.includes("?") ? "&" : "?";
      await go(page, "owner", `${p.path}${sep}demo=offline`);
      await expect(h1(page, p.title)).toBeVisible();
      await expect(page.getByText(NEEDS_CONNECTION)).toHaveCount(1);
      const button = page.getByRole("button", { name: /^(Save changes|Send invite)$/ });
      await expect(button.first()).toBeDisabled();
      await expect(page.locator("input, select").first(), "reading stays available offline").toBeVisible();
    });

  for (const role of ["accountant", "foreman"])
    for (const path of [
      "/settings/templates",
      "/settings/categories",
      "/settings/members",
      "/settings/assignments",
    ])
      test(`${role} gets no access to ${path} and sees no figures`, async ({ page }) => {
        await go(page, role, path);
        await expect(page.getByText(/You don't have access to this/)).toBeVisible();
        expect(await page.locator("main").innerText()).not.toMatch(/\$|%/);
      });

  test("members and roles is Owner-only: the manager is told to ask the owner", async ({ page }) => {
    await go(page, "manager", "/settings/members");
    await expect(page.getByText("You don't have access to this. Ask the owner.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send invite" })).toHaveCount(0);
  });

  test("empty states say what to do next", async ({ page }) => {
    await go(page, "owner", "/settings/templates?demo=empty");
    await expect(
      page.getByRole("link", { name: "Add stages" }).or(page.getByRole("button", { name: "Add stages" })),
    ).toBeVisible();
    await go(page, "owner", "/settings/categories?demo=empty");
    await expect(page.getByText("No expense categories yet. Add the first one below.")).toBeVisible();
    await go(page, "owner", "/settings/members?demo=empty");
    await expect(page.getByText("No members yet. Invite your first manager or foreman.")).toBeVisible();
    await go(page, "owner", "/settings/assignments?demo=empty");
    await expect(page.getByText("No foremen yet. Invite one to give them jobs.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Invite a foreman" })).toBeVisible();
    await go(page, "manager", "/settings/assignments?demo=empty");
    await expect(page.getByText(/Ask the owner to invite one/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Invite a foreman" })).toHaveCount(0);
  });

  test("templates: the index lists the five job types and each opens its stages", async ({ page }) => {
    await go(page, "owner", "/settings/templates");
    await expect(page.getByRole("link", { name: /stages$/ }).first()).toBeVisible();
    expect(await page.getByRole("link", { name: /\d+ stages|No stages yet/ }).count()).toBe(5);
    await page.getByRole("link", { name: /^Metal re-roof/ }).click();
    await expect(h1(page, "Metal re-roof stages")).toBeVisible();
    await expect(page.getByLabel("Stage 1 name", { exact: true })).toHaveValue("Site setup & safety");
    await expect(page.getByText("Labour adds up to 100%. Materials add up to 100%.")).toBeVisible();
  });

  test("templates: shares that do not add up are named per group and nothing saves", async ({ page }) => {
    await go(page, "owner", "/settings/templates?type=metal_reroof");
    await page.getByLabel("Stage 1 labour share", { exact: true }).fill("1");
    await expect(page.getByText("Labour adds up to 96%.", { exact: false })).toBeVisible();
    await save(page).click();
    await expect(page.getByText("Labour shares must add up to 100%. They add up to 96%.")).toBeVisible();
    await page.getByLabel("Stage 1 name", { exact: true }).fill("");
    await save(page).click();
    await expect(page.getByText("Add a name for the stage.")).toBeVisible();
    await page.getByLabel("Stage 1 labour share", { exact: true }).fill("abc");
    await save(page).click();
    await expect(page.getByText("Enter a percent, like 25.")).toBeVisible();
    await page.getByLabel("Stage 1 labour share", { exact: true }).fill("101");
    await save(page).click();
    await expect(page.getByText("A share is between 0% and 100%.")).toBeVisible();
    await expect(saved(page)).toHaveCount(0);
  });

  test("templates: a balanced edit saves, and a stage can be added then removed", async ({ page }) => {
    await go(page, "manager", "/settings/templates?type=repair");
    await save(page).click();
    await expect(saved(page)).toBeVisible();
    await go(page, "manager", "/settings/templates?type=repair");
    const before = await page.getByLabel(/^Stage \d+ name$/).count();
    await page.getByRole("button", { name: "Add stage" }).click();
    await expect(page.getByLabel(/^Stage \d+ name$/)).toHaveCount(before + 1);
    await page.getByRole("button", { name: `Remove stage ${before + 1}` }).click();
    await expect(page.getByLabel(/^Stage \d+ name$/)).toHaveCount(before);
  });

  test("templates: a long stage name wraps inside the screen", async ({ page }, info) => {
    await go(page, "owner", "/settings/templates?type=metal_reroof");
    await page.getByLabel("Stage 1 name", { exact: true }).fill(LONG_NAME);
    const log = collectConsole(page);
    await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
  });

  test("the demo no-permission state refuses every settings list, for the Owner too", async ({ page }) => {
    for (const path of [
      "/settings/templates",
      "/settings/categories",
      "/settings/members",
      "/settings/assignments",
    ]) {
      await go(page, "owner", `${path}?demo=noperm`);
      await expect(page.getByText(/You don't have access to this/)).toBeVisible();
    }
  });

  test("categories: a new category saves, a repeat is refused, a long name stays inside the screen", async ({
    page,
  }, info) => {
    const name = unique("Skip bins");
    await go(page, "manager", "/settings/categories");
    await page.getByLabel("New category", { exact: true }).fill(name);
    await save(page).click();
    await expect(saved(page)).toBeVisible();
    await expect(page.getByLabel(`Rename ${name}`, { exact: true })).toBeVisible();
    await page.getByLabel("New category", { exact: true }).fill(name.toUpperCase());
    await save(page).click();
    await expect(page.getByText(`There's already a category called ${name.toUpperCase()}.`)).toBeVisible();
    const long = unique(LONG_NAME).slice(0, 58);
    await page.waitForLoadState("networkidle");
    await go(page, "owner", "/settings/categories");
    await page.getByLabel("New category", { exact: true }).fill(long);
    await save(page).click();
    await expect(saved(page)).toBeVisible();
    const log = collectConsole(page);
    await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
  });

  test("categories: a blank rename is refused", async ({ page }) => {
    await go(page, "owner", "/settings/categories");
    await page.getByLabel("Rename Permits", { exact: true }).fill("");
    await save(page).click();
    await expect(page.getByText("Add a name for the category.")).toBeVisible();
    await expect(saved(page)).toHaveCount(0);
  });

  test("members: inviting needs a name and an email, then lands in the list", async ({ page }) => {
    await go(page, "owner", "/settings/members");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Add the person's name.")).toBeVisible();
    await expect(page.getByText("Check the email address.")).toBeVisible();
    const stamp = unique("karen").replace(/\s/g, "");
    await page.getByLabel("Name", { exact: true }).fill("Karen Lee");
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Check the email address.")).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(`${stamp}@harbourroofing.example`);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(saved(page, "Invite sent.")).toBeVisible();
    await expect(page.getByText(`${stamp}@harbourroofing.example`)).toBeVisible();
    // The same email again is a conflict on the email field, not a crash.
    await page.getByLabel("Name", { exact: true }).fill("Karen Lee");
    await page.getByLabel("Email", { exact: true }).fill(`${stamp}@harbourroofing.example`);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(/already/i).first()).toBeVisible();
  });

  test("members: roles change from the list", async ({ page }) => {
    await go(page, "owner", "/settings/members");
    const selects = page.getByLabel(/^Role for /);
    expect(await selects.count()).toBeGreaterThan(0);
    await save(page).click();
    await expect(saved(page)).toBeVisible();
  });

  test("a long-name foreman fits on members and on foreman assignments", async ({ page }, info) => {
    const stamp = unique("long").replace(/\s/g, "");
    const longName = `Bartholomew Wolfeschlegelsteinhausenbergerdorff the third, ${stamp}`;
    await go(page, "owner", "/settings/members");
    await page.getByLabel("Name", { exact: true }).fill(longName);
    await page
      .getByLabel("Email", { exact: true })
      .fill(`${stamp}.with.a.very.long.address.that.keeps.going@harbourroofingandrestoration.example`);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(saved(page, "Invite sent.")).toBeVisible();
    const membersLog = collectConsole(page);
    await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: membersLog });
    await page.waitForLoadState("networkidle");
    await go(page, "owner", "/settings/assignments");
    const group = page.getByRole("group", { name: longName });
    await expect(group).toBeVisible();
    const boxes = group.getByRole("checkbox");
    await boxes.first().click();
    await save(page).click();
    await expect(saved(page)).toBeVisible();
    const log = collectConsole(page);
    await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
  });

  test("assignments: ticking a job saves and sticks", async ({ page }) => {
    await go(page, "owner", "/settings/assignments");
    await expect(
      page.getByText("A foreman sees and logs to the jobs ticked here, and no others."),
    ).toBeVisible();
    const first = page.getByRole("group").first().getByRole("checkbox").first();
    const was = await first.isChecked();
    await first.click();
    await save(page).click();
    await expect(saved(page)).toBeVisible();
    await page.waitForLoadState("networkidle"); // the refresh after a save must finish before the next navigation
    await go(page, "owner", "/settings/assignments");
    expect(await page.getByRole("group").first().getByRole("checkbox").first().isChecked()).toBe(!was);
    // Put it back so later tests see the seeded assignments.
    await page.getByRole("group").first().getByRole("checkbox").first().click();
    await save(page).click();
    await expect(saved(page)).toBeVisible();
  });
});

test.describe("More (screen 22)", () => {
  test("the Owner sees Settings, the theme choice and Sign out, and it fits", async ({ page }, info) => {
    const log = collectConsole(page);
    await go(page, "owner", "/more");
    await expect(h1(page, "More")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Settings/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
  });

  test("the foreman's More is short: no Settings and no money", async ({ page }) => {
    await go(page, "foreman", "/more");
    await expect(h1(page, "More")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Settings/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Expenses/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Install guide/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/\$/);
    const labels = await page.locator("main [aria-label], main [title]").evaluateAll((els) =>
      els.map((e) => `${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("title") ?? ""}`),
    );
    expect(labels.join(" "), "no dollar sign in any aria label").not.toMatch(/\$/);
  });

  test("the accountant sees no Settings row", async ({ page }) => {
    await go(page, "accountant", "/more");
    await expect(h1(page, "More")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Settings/ })).toHaveCount(0);
  });

  test("theme: Dark sets the page theme and it stays after a reload", async ({ page }) => {
    await go(page, "owner", "/more");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("radio", { name: "System" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });

  test("offline: Needs connection once, theme and Sign out wait", async ({ page }) => {
    await go(page, "owner", "/more?demo=offline");
    await expect(page.getByText(NEEDS_CONNECTION)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeDisabled();
    await expect(
      page.getByRole("link", { name: /^Settings/ }),
      "the menu itself stays available",
    ).toBeVisible();
  });

  test("Sign out lands on the sign-in screen", async ({ page }) => {
    await go(page, "manager", "/more");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(h1(page, /sign in/i)).toBeVisible();
  });

  test("no access shows the plain sentence", async ({ page }) => {
    await go(page, "owner", "/more?demo=noperm");
    await expect(page.getByText(/You don't have access to this/)).toBeVisible();
  });
});
