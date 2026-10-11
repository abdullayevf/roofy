import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { SCREENS } from "./screens";

const isPhone = (name: string) => name !== "desktop";
const NEEDS_CONNECTION = "Needs connection — try again once you're back online.";
const go = (page: Page, role: string, next: string) =>
  page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
const h1 = (page: Page, name: string | RegExp) => page.getByRole("heading", { level: 1, name });
const saved = (page: Page, text = "Changes saved.") => page.getByText(text, { exact: true });
const save = (page: Page) => page.getByRole("button", { name: "Save changes", exact: true });
/** Fake data is shared by every test in the run, so anything a test adds gets a name of its own. */
const unique = (stem: string) => `${stem} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
/**
 * The saved toast sits over the bottom of the page, where Send invite is. The press that sent the invite left the
 * pointer on it, and a toast pauses its timer while the pointer is over it, so move off and wait for it to close.
 */
async function toastGone(page: Page, text: string) {
  await page.mouse.move(1, 1);
  await expect(page.getByText(text, { exact: true })).toHaveCount(0, { timeout: 10_000 });
}

/**
 * A focused text field puts a pinned Save bar on the visual viewport (above the on-screen keyboard); with no real
 * keyboard in the test that is the very bottom of the window. Leave the field and wait for the bar to settle back
 * above the tab bar before the layout guards read it.
 */
async function settleKeyboardBar(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.locator('[data-slot="primary-action"]')).not.toHaveAttribute("data-keyboard", "true");
}
/** A list row (a stage, a category) is a button named by its whole text. */
const row = (page: Page, name: string | RegExp) => page.locator("main").getByRole("button", { name });
const rows = (page: Page) => page.locator("main .divide-y button");
const done = (page: Page) => page.getByRole("button", { name: "Done", exact: true });
const stageName = (page: Page) => page.getByLabel("Stage name", { exact: true });
const share = (page: Page, which: "Labour" | "Materials") => page.getByLabel(`${which} share`, { exact: true });
async function addCategory(page: Page, name: string) {
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Save category", exact: true }).click();
}
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
      const button = page.getByRole("button", { name: /^(Save changes|Send invite|Add category)$/ });
      await expect(button.first()).toBeDisabled();
      await expect(page.locator("main input, main select, main .divide-y button").first(), "reading stays available offline").toBeVisible();
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
    // One row per stage, not a field per stage; the running totals sit above the list.
    await expect(row(page, /^Site setup & safety/)).toBeVisible();
    await expect(page.getByLabel(/name$/)).toHaveCount(0);
    await expect(page.getByText("Labour 100%. Materials 100%.")).toBeVisible();
  });

  test("templates: shares that do not add up are named per group and nothing saves", async ({ page }) => {
    await go(page, "owner", "/settings/templates?type=metal_reroof");
    await row(page, /^Site setup & safety/).click();
    await share(page, "Labour").fill("1");
    await done(page).click();
    await expect(page.getByText("Labour 96%. Materials 100%.")).toBeVisible();
    await save(page).click();
    await expect(page.getByText("Labour shares must add up to 100%. They add up to 96%.")).toBeVisible();
    // Done refuses a blank name, an unreadable share and a share over 100 inside the sheet.
    await row(page, /^Site setup & safety/).click();
    await stageName(page).fill("");
    await done(page).click();
    await expect(page.getByText("Add a name for the stage.")).toBeVisible();
    await stageName(page).fill("Site setup & safety");
    await share(page, "Labour").fill("abc");
    await done(page).click();
    await expect(page.getByText("Enter a percent, like 25.")).toBeVisible();
    await share(page, "Labour").fill("101");
    await done(page).click();
    await expect(page.getByText("A share is between 0% and 100%.")).toBeVisible();
    await expect(saved(page)).toHaveCount(0);
  });

  test("templates: a balanced edit saves, a stage is added, and removing one asks first", async ({ page }) => {
    await go(page, "manager", "/settings/templates?type=repair");
    await save(page).click();
    await expect(saved(page)).toBeVisible();
    await toastGone(page, "Changes saved.");
    await go(page, "manager", "/settings/templates?type=repair");
    const before = await rows(page).count();
    await page.getByRole("button", { name: "Add stage", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Add a stage" })).toBeVisible();
    await stageName(page).fill("Extra flashing");
    await done(page).click();
    await expect(rows(page)).toHaveCount(before + 1);
    // Remove is not on the row: it is in the edit sheet, and a confirm comes first.
    await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
    await row(page, /^Extra flashing/).click();
    await page.getByRole("button", { name: "Remove stage", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Remove Extra flashing?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(rows(page)).toHaveCount(before + 1);
    await row(page, /^Extra flashing/).click();
    await page.getByRole("button", { name: "Remove stage", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove stage", exact: true }).click();
    await expect(rows(page)).toHaveCount(before);
  });

  test("templates: a long stage name wraps inside the screen", async ({ page }, info) => {
    await go(page, "owner", "/settings/templates?type=metal_reroof");
    await row(page, /^Site setup & safety/).click();
    await stageName(page).fill(LONG_NAME);
    await done(page).click();
    await expect(row(page, new RegExp(`^${LONG_NAME.slice(0, 20)}`))).toBeVisible();
    await settleKeyboardBar(page);
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
    await addCategory(page, name);
    await expect(saved(page)).toBeVisible();
    await expect(row(page, name)).toBeVisible();
    await toastGone(page, "Changes saved.");
    await addCategory(page, name.toUpperCase());
    await expect(page.getByText(`There's already a category called ${name.toUpperCase()}.`)).toBeVisible();
    // A name over 60 characters is refused on the field, not dropped without a word.
    await page.getByLabel("Category name", { exact: true }).fill(LONG_NAME);
    await page.getByRole("button", { name: "Save category", exact: true }).click();
    await expect(page.getByText("Keep it under 60 characters.")).toBeVisible();
    await expect(saved(page)).toHaveCount(0);
    const long = unique(LONG_NAME).slice(0, 58);
    await page.waitForLoadState("networkidle");
    await go(page, "owner", "/settings/categories");
    await addCategory(page, long);
    await expect(saved(page)).toBeVisible();
    await toastGone(page, "Changes saved.");
    const log = collectConsole(page);
    await expectScreenHealthy(page, { phone: isPhone(info.project.name), console: log });
  });

  test("categories: a row opens a sheet that renames it", async ({ page }) => {
    const first = unique("Gutter");
    const second = unique("Downpipe");
    await go(page, "owner", "/settings/categories");
    await addCategory(page, first);
    await expect(saved(page)).toBeVisible();
    await toastGone(page, "Changes saved.");
    await row(page, first).click();
    await expect(page.getByRole("dialog", { name: "Rename category" })).toBeVisible();
    await expect(page.getByLabel("Category name", { exact: true })).toHaveValue(first);
    await page.getByLabel("Category name", { exact: true }).fill(second);
    await page.getByRole("button", { name: "Save category", exact: true }).click();
    await expect(saved(page)).toBeVisible();
    await expect(row(page, second)).toBeVisible();
    await expect(row(page, first)).toHaveCount(0);
  });

  test("categories: a blank rename is refused", async ({ page }) => {
    await go(page, "owner", "/settings/categories");
    await row(page, /^Permits/).click();
    await page.getByLabel("Category name", { exact: true }).fill("");
    await page.getByRole("button", { name: "Save category", exact: true }).click();
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
    await toastGone(page, "Invite sent.");
    // The Owner's own address is a member already: the sentence shows on the Email field, as the capture entry shows it.
    await page.getByLabel("Name", { exact: true }).fill("Karen Lee");
    await page.getByLabel("Email", { exact: true }).fill("karen@harbourroofing.example");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Someone with that email is already a member.")).toBeVisible();
    // The same email again is a conflict on the email field, not a crash.
    await page.getByLabel("Name", { exact: true }).fill("Karen Lee");
    await page.getByLabel("Email", { exact: true }).fill(`${stamp}@harbourroofing.example`);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(/already/i).first()).toBeVisible();
  });

  test("members: a role picked in the list saves at once and sticks", async ({ page }) => {
    await go(page, "owner", "/settings/members");
    await expect(save(page), "a role saves on pick: the page has no Save button").toHaveCount(0);
    // The Owner has no role picker (the role is fixed); the accountant is the member nothing else depends on.
    const role = () => page.getByLabel("Role for Priya Shah", { exact: true });
    await expect(role()).toHaveValue("accountant");
    await role().selectOption("manager");
    await expect(saved(page, "Role changed.")).toBeVisible();
    await page.waitForLoadState("networkidle"); // the refresh after a save must finish before the next navigation
    await toastGone(page, "Role changed.");
    await go(page, "owner", "/settings/members");
    await expect(role()).toHaveValue("manager");
    // Put it back so later tests see the seeded roles.
    await role().selectOption("accountant");
    await expect(saved(page, "Role changed.")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await go(page, "owner", "/settings/members");
    await expect(role()).toHaveValue("accountant");
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
    // The guards read the screen at rest: a toast over the bottom of the page for its few seconds is not part of it.
    await toastGone(page, "Invite sent.");
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
    // The page's own history update after that refresh can land a beat later and interrupt a goto; the toast closing
    // (its few seconds) is well after it.
    await toastGone(page, "Changes saved.");
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
    await expect(page.locator("main").getByRole("link", { name: /^Settings/ })).toBeVisible();
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

  test("offline: the theme still works, Sign out waits with Needs connection under it", async ({ page }) => {
    await go(page, "owner", "/more?demo=offline");
    await expect(page.getByText(NEEDS_CONNECTION)).toHaveCount(1);
    const signOut = page.getByRole("button", { name: "Sign out" });
    await expect(signOut).toBeDisabled();
    const sentence = await page.getByText(NEEDS_CONNECTION).boundingBox();
    const button = await signOut.boundingBox();
    expect(sentence!.y, "the sentence sits under the disabled button").toBeGreaterThanOrEqual(button!.y + button!.height - 1);
    await page.getByRole("radio", { name: "Dark" }).click({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.locator("main").getByRole("link", { name: /^Settings/ }),
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

/**
 * The design capture replays each entry's steps in a fresh browser and waits for `expectStill`. Replaying the
 * same steps here, the same way (fill a labelled box, press a button), means a wrong entry fails this spec in
 * minutes instead of stopping a whole group capture.
 */
test.describe("Settings capture entries reach their settled sentence", () => {
  const entries = SCREENS.filter(
    (s) => s.group === "entry-settings" && s.steps && s.expectStill && s.route.startsWith("/settings") && s.roles.length > 0,
  );
  for (const entry of entries)
    test(`${entry.id}`, async ({ page }) => {
      // The capture opens a state other than normal with `?demo=<state>` (design-capture.ts); do the same here.
      const state = entry.states.includes("normal") ? undefined : entry.states[0];
      const route = state ? `${entry.route}${entry.route.includes("?") ? "&" : "?"}demo=${state}` : entry.route;
      await go(page, entry.roles[0]!, route);
      for (const step of entry.steps!) {
        const fill = /^fill:(.+?)=(.*)$/.exec(step);
        if (fill) await page.getByLabel(fill[1]!, { exact: true }).fill(fill[2]!);
        else if (step.startsWith("row:")) await page.getByRole("button", { name: step.slice(4) }).first().click();
        else await page.getByRole("button", { name: step, exact: true }).click();
      }
      await expect(page.getByText(entry.expectStill!).first()).toBeVisible();
    });
});
