import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy } from "./guards";
import { getSeed } from "../../src/data/fake/store";
import { JOB_PREFILL } from "./screens";

const seed = getSeed();
const { meta } = seed;
const smithClientId = seed.projects.find((p) => p.id === meta.projects.smith)!.clientId;
const isPhone = (name: string) => name !== "desktop";

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
  // Wait for the form to hydrate: a pick made before then is reset to what the server sent.
  await page.waitForLoadState("networkidle");
}

const clientSelect = (page: Page) => page.getByRole("combobox", { name: "Client" });

const createJob = (page: Page) => page.getByRole("button", { name: "Create job", exact: true });
const prefill = (extra: Record<string, string> = {}) =>
  `/jobs/new?${new URLSearchParams({ client: smithClientId, type: "metal_reroof", name: "Smith job — Ryde carport roof", address: "14 Quarry Rd, Ryde", accepted: "1", ...extra })}`;

test.describe("New job", () => {
  test("opens blank with Create job off and one sentence naming everything still to do", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs/new");
    await expect(page.getByRole("heading", { level: 1, name: "New job" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to jobs" })).toHaveAttribute("href", "/jobs");
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Choose a client.")).toBeVisible();
    await expect(page.getByText("Choose a job type to see its stages.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Quick-add client" })).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("picking a job type proposes the stages from the last job of that type; Accept turns Create job on", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new");
    await clientSelect(page).selectOption({ label: "Mark Smith" });
    await page.getByRole("radio", { name: "Metal re-roof" }).click();
    await expect(page.getByText(/^From your last metal re-roof job, /)).toBeVisible();
    await expect(page.getByRole("list").filter({ hasText: "Sheet install" }).getByRole("listitem")).not.toHaveCount(0);
    await page.getByLabel("Job name").fill("Smith job — Ryde carport roof");
    await page.getByLabel("Site address").fill("14 Quarry Rd, Ryde");
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Accept the stages.")).toBeVisible();
    await page.getByRole("button", { name: "Accept stages" }).click();
    await expect(page.getByText("Stages accepted")).toBeVisible();
    await expect(createJob(page)).toBeEnabled();
    await expect(page.getByText("Accept the stages.")).toHaveCount(0);
  });

  test("a job type with no earlier job proposes the template", async ({ page }) => {
    // A new workspace has no earlier job of any type.
    await signInAs(page, "manager", "/jobs/new?demo=empty");
    await page.getByRole("radio", { name: "New build" }).click();
    await expect(page.getByText("From the new build template.")).toBeVisible();
    await expect(page.getByText("Battens")).toBeVisible();
  });

  test("changing the job type takes the acceptance back", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    await expect(page.getByText("Stages accepted")).toBeVisible();
    await expect(createJob(page)).toBeEnabled();
    await page.getByRole("radio", { name: "New build" }).click();
    await expect(page.getByText("Stages accepted")).toHaveCount(0);
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Accept the stages.")).toBeVisible();
  });

  test("creates the job with the accepted stages and it shows on the list", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    await createJob(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Job added" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/Smith job — Ryde carport roof is ready, with \d+ stages\./);
    await page.getByRole("link", { name: "Back to jobs" }).last().click();
    await expect(page).toHaveURL(/\/jobs$/);
    // A phone row is one link; a desktop table row has the link on the name only, so find the row, not the link.
    const card = page.locator('[data-screen="jobs"] [data-job-row]:visible').filter({ hasText: "Ryde carport roof" });
    await expect(card).toBeVisible();
    await expect(card.getByText("No stage started")).toBeVisible();
  });

  test("Edit stages: rename, remove and add a stage, then Accept", async ({ page }) => {
    await signInAs(page, "manager", prefill({ type: "new_build" }));
    await page.getByRole("button", { name: "Edit stages" }).click();
    // While stages are being edited the pinned action is Accept stages; Create job comes back after it (R5).
    await expect(createJob(page)).toHaveCount(0);
    await expect(page.locator('[data-slot="primary-action"]').getByRole("button", { name: "Accept stages" })).toBeVisible();
    // Every stage is one compact row; its fields appear when the row is tapped (R11).
    await expect(page.getByLabel("Stage 1 name")).toHaveCount(0);
    await page.getByRole("button", { name: /^Battens/ }).click();
    await expect(page.getByLabel("Stage 1 name")).toHaveValue("Battens");
    await page.getByLabel("Stage 1 name").fill("Roof battens");
    await page.getByRole("button", { name: /^Roof battens/ }).click();
    await expect(page.getByLabel("Stage 1 name")).toHaveCount(0);
    await page.getByRole("button", { name: /^Sarking/ }).click();
    await page.getByRole("button", { name: "Remove stage 2" }).click();
    await expect(page.getByRole("button", { name: "Remove stage 2" })).toHaveCount(0);
    await page.getByRole("button", { name: "Add stage" }).click();
    await page.getByLabel("Stage 5 name").fill("Final clean");
    await page.getByLabel("Stage 5 labour budget").fill("1250");
    await page.getByLabel("Stage 5 labour budget").blur();
    await expect(page.getByLabel("Stage 5 labour budget")).toHaveValue("1,250.00");
    await page.getByRole("button", { name: "Accept stages" }).click();
    await expect(createJob(page)).toBeVisible();
    await expect(page.getByText("Roof battens")).toBeVisible();
    await expect(page.getByText("Final clean")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Final clean" })).toContainText("$1,250.00");
    await createJob(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Job added" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("with 5 stages.");
  });

  test("a stage with no name can't be accepted", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    await page.getByRole("button", { name: "Edit stages" }).click();
    await page.getByRole("button", { name: "Add stage" }).click();
    await expect(page.getByRole("button", { name: "Accept stages" })).toBeDisabled();
    await expect(page.getByText("Give every stage a name.")).toBeVisible();
  });

  test("Quick-add client saves the client and picks them", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new");
    await page.getByRole("button", { name: "Quick-add client" }).click();
    const save = page.getByRole("button", { name: "Save client" });
    await expect(save).toBeDisabled();
    await page.getByLabel("Client name").fill("Jo Nguyen");
    await save.click();
    await expect(page.getByRole("button", { name: "Save client" })).toHaveCount(0);
    await expect(clientSelect(page).locator("option:checked")).toHaveText("Jo Nguyen");
  });

  test("a new workspace has no clients to pick, only Quick-add client", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new?demo=empty");
    await expect(page.getByText("No clients yet. Add the first one.")).toBeVisible();
    await expect(clientSelect(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Quick-add client" })).toBeVisible();
  });

  test("a target finish before the start says so under the field and keeps Create job off", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", prefill({ start: "2026-10-05", finish: "2026-10-01" }));
    await expect(page.getByText("The target finish can't be before the start.")).toBeVisible();
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Move the target finish to after the start.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    await page.getByLabel("Target finish (optional)").fill("2026-10-20");
    await expect(page.getByText("The target finish can't be before the start.")).toHaveCount(0);
    await expect(createJob(page)).toBeEnabled();
  });

  test("with no signal Create job is off and says it needs a connection, filled in or not", async ({ page }) => {
    await signInAs(page, "manager", prefill({ demo: "offline" }));
    // The form never queues a save, so the "saved on this device" banner stays away and the form says it alone (R7).
    await expect(page.getByRole("status").filter({ hasText: "No signal" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Quick-add client" })).toBeDisabled();
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Needs connection. Try again once you're back online.")).toBeVisible();
  });

  test("losing signal on the page turns Create job off, and getting it back turns it on", async ({ page, context }) => {
    await signInAs(page, "manager", prefill());
    await expect(createJob(page)).toBeEnabled();
    await context.setOffline(true);
    await expect(createJob(page)).toBeDisabled();
    await expect(page.getByText("Needs connection. Try again once you're back online.")).toBeVisible();
    await context.setOffline(false);
    await expect(createJob(page)).toBeEnabled();
  });

  test("loading shows blocks shaped like the form under the real title", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", "/jobs/new?demo=loading");
    await expect(page.locator('[data-screen="job-form"]')).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "New job" })).toBeVisible();
    // The stages area is a heading and a line, as the loaded form's is, not four stage rows (i2-F15).
    const blocks = await page.locator('[data-screen="job-form"] span.bg-line').evaluateAll((els) =>
      els.map((el) => ({ w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) })),
    );
    expect(blocks.filter((b) => b.w === 48 && b.h === 48)).toEqual([]);
    expect(blocks.at(-2)!.h).toBeLessThanOrEqual(24);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("an error keeps the title and offers Try again; no permission says so", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new?demo=error");
    await expect(page.getByRole("heading", { level: 1, name: "New job" })).toBeVisible();
    await expect(page.locator('[data-screen="job-form"] [role="alert"]')).toContainText("Couldn't load this. Try again.");
    await page.goto("/jobs/new?demo=noperm");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
  });

  test("the filled form is healthy", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", prefill());
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the stage editor is healthy", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", prefill());
    await page.getByRole("button", { name: "Edit stages" }).click();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("the Create job bar is pinned and the form has no horizontal overflow", async ({ page }, testInfo) => {
    await signInAs(page, "manager", prefill());
    const bar = page.locator('[data-slot="primary-action"]');
    const pos = await bar.evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe(isPhone(testInfo.project.name) ? "fixed" : "sticky");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe("New job: measured guards", () => {
  test("Site address is the one required field: a blank job name is named by the address (R1)", async ({ page }) => {
    await signInAs(page, "manager", prefill({ name: "" }));
    await expect(createJob(page)).toBeEnabled();
    await createJob(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Job added" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("14 Quarry Rd, Ryde is ready");
  });

  test("the pinned hint names only the next missing thing, on one line", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new");
    const hint = page.locator('[data-slot="primary-action"] .pin-hint');
    await expect(hint).toHaveText("Choose a client.");
    const box = (await hint.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(26);
  });

  test("the Back to jobs link has a 48 px tap area and dates use Atkinson (i1-F13, R2)", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new");
    const backLink = page.getByRole("link", { name: "Back to jobs" });
    const link = (await backLink.boundingBox())!;
    expect(link.height).toBeGreaterThanOrEqual(48);
    // The row is visibly 48 px: as wide as the form's column, with a rule under it (i2-F8).
    const column = (await page.getByLabel("Site address").boundingBox())!;
    expect(Math.abs(link.width - column.width)).toBeLessThanOrEqual(1);
    expect(await backLink.evaluate((el) => getComputedStyle(el).borderBottomWidth)).not.toBe("0px");
    // The date value is Atkinson and starts where a text field's value starts (R8).
    const look = (label: string) =>
      page.getByLabel(label).evaluate((el) => {
        const cs = getComputedStyle(el);
        return { font: cs.fontFamily, size: cs.fontSize, padLeft: cs.paddingLeft };
      });
    const date = await look("Start date (optional)");
    const text = await look("Site address");
    expect(date.font).toMatch(/Atkinson/i);
    expect(date.font).toBe(text.font);
    expect(date.size).toBe(text.size);
    expect(date.padLeft).toBe(text.padLeft);
    // The browser's own inner padding on the date value is removed, so it starts where a text value starts.
    // Chromium can't read a computed style for that inner part, so the guard reads the rule itself.
    const editPadding = await page.evaluate(() =>
      [...document.styleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes("::-webkit-datetime-edit"))
        .map((r) => r.style.paddingLeft || r.style.padding)
        .filter(Boolean),
    );
    expect(editPadding).toContain("0px");
  });

  test("the browser shows an Australian phone's dates: en-AU and the Sydney clock (R8)", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new");
    const env = await page.evaluate(() => ({ lang: navigator.language, zone: Intl.DateTimeFormat().resolvedOptions().timeZone, day: new Date(2026, 8, 10).toLocaleDateString() }));
    expect(env).toEqual({ lang: "en-AU", zone: "Australia/Sydney", day: "10/09/2026" });
  });

  test("a phone on its side still says why Create job is off, left of the Log circle (i2-F9)", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phones only");
    const cases = [
      { size: { width: 844, height: 390 }, path: "/jobs/new", hint: "Choose a client." },
      { size: { width: 844, height: 390 }, path: `/jobs/${meta.projects.smith}/edit`, hint: "Change something to save." },
      { size: { width: 844, height: 390 }, path: "/jobs/new?demo=offline", hint: "Needs connection. Try again once you're back online." },
      { size: { width: 568, height: 320 }, path: "/jobs/new", hint: "Choose a client." },
    ];
    for (const c of cases) {
      await page.setViewportSize(c.size);
      await signInAs(page, "manager", c.path);
      const bar = page.locator('[data-slot="primary-action"]');
      const hint = bar.locator(".pin-hint");
      await expect(hint).toHaveText(c.hint);
      const h = (await hint.boundingBox())!;
      const circle = (await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log" }).locator("span.rounded-full").boundingBox())!;
      expect(h.x + h.width, `${c.path} at ${c.size.width}`).toBeLessThanOrEqual(circle.x);
      expect((await bar.boundingBox())!.height).toBeLessThanOrEqual(70);
    }
  });

  test("on desktop the strip is a galv bar under a line rule at rest and at the end, and no field sits under it at the end (i2-D7)", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "desktop only");
    await signInAs(page, "manager", prefill());
    const bar = page.locator('[data-slot="primary-action"]');
    const look = () =>
      bar.evaluate((el) => {
        const cs = getComputedStyle(el);
        const probe = document.createElement("i");
        probe.style.color = "var(--line)";
        document.body.append(probe);
        const line = getComputedStyle(probe).color;
        probe.remove();
        return { bg: cs.backgroundColor, page: getComputedStyle(document.body).backgroundColor, rule: cs.borderTopColor, line, width: cs.borderTopWidth };
      });
    const rest = await look();
    expect(rest.rule).toBe(rest.line);
    expect(rest.bg).toBe(rest.page);
    expect(parseFloat(rest.width)).toBeGreaterThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await look()).toEqual(rest);
    const top = (await bar.boundingBox())!.y;
    const lastField = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll<HTMLElement>("main button, main input, main select")]
          .filter((el) => !el.closest('[data-slot="primary-action"]'))
          .map((el) => el.getBoundingClientRect().bottom),
      ),
    );
    expect(lastField).toBeLessThanOrEqual(top);
  });

  test("the filled capture's contract value is above its labour budget total (i2-D9)", async ({ page }) => {
    await signInAs(page, "manager", JOB_PREFILL);
    const dollars = (text: string) => Number(text.replace(/[^0-9.]/g, ""));
    const contract = dollars(await page.getByLabel("Contract value (optional)").inputValue());
    const total = page.getByRole("listitem", { name: "Labour budget total" });
    const labour = dollars((await total.innerText()).replace("Labour budget total", ""));
    expect(labour).toBeGreaterThan(0);
    expect(contract).toBeGreaterThan(labour);
    // The total row is set apart from the stage rows by a heavier rule (i2-D13).
    expect(await total.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("2px");
  });

  test("with no clients the sentence says to add one first and Quick-add client is the primary (i2-F11)", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/new?demo=empty");
    await expect(page.locator('[data-slot="primary-action"] .pin-hint')).toHaveText("Add a client first.");
    await expect(page.getByRole("button", { name: "Quick-add client" })).toHaveAttribute("data-variant", "primary");
  });

  test("a refusal's red words go when the field is fixed: in the bar and under a field (RR4)", async ({ page }) => {
    const bar = page.locator('[data-slot="primary-action"]');
    await signInAs(page, "manager", prefill({ contract: "2000000000" }));
    await createJob(page).click();
    await expect(bar).toContainText("Check the contract value.");
    await page.getByLabel("Site address").fill("15 Quarry Rd, Ryde");
    await expect(bar).not.toContainText("Check the contract value.");
    // An address over 200 characters is refused under the address field.
    await page.getByLabel("Site address").fill("1 Quarry Rd, Ryde ".repeat(12));
    await createJob(page).click();
    await expect(page.getByText("Keep it under 200 characters.")).toBeVisible();
    await page.getByLabel("Site address").fill("15 Quarry Rd, Ryde");
    await expect(page.getByText("Keep it under 200 characters.")).toHaveCount(0);
  });

  test("a refusal with no field to blame is not hidden by one that has a field, and a job name refusal on a blank name goes in the bar (RR7)", async ({ page }) => {
    const bar = page.locator('[data-slot="primary-action"]');
    // 130 characters of address name the job, which is over the 120 the job name allows.
    await signInAs(page, "manager", prefill({ name: "", address: "1 Quarry Rd, Ryde ".repeat(7).trim() }));
    await createJob(page).click();
    await expect(bar).toContainText("The site address is too long to name the job. Add a shorter job name.");
    await expect(page.getByText("Keep it under 120 characters.")).toHaveCount(0);
    await page.getByLabel("Job name (optional)").fill("Ryde carport roof");
    await expect(bar).not.toContainText("too long");
  });

  test("a save that can't reach the server says so in the bar and keeps the form; so does Quick-add client (RR2)", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    await page.route("**/*", (route) => (route.request().headers()["next-action"] ? route.abort() : route.continue()));
    await createJob(page).click();
    await expect(page.locator('[data-slot="primary-action"]')).toContainText("Couldn't save this. Needs connection.");
    await expect(page.getByRole("heading", { level: 1, name: "New job" })).toBeVisible();
    await expect(createJob(page)).toBeEnabled();
    await page.getByRole("button", { name: "Quick-add client" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Client name").fill("Dunn Roofing");
    await sheet.getByRole("button", { name: "Save client" }).click();
    await expect(sheet).toContainText("Couldn't save the client. Needs connection.");
  });

  test("a foreman who opens New job is told they have no access, not shown a form (F10)", async ({ page }) => {
    await signInAs(page, "foreman", "/jobs/new");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create job" })).toHaveCount(0);
  });

  test("stage review rows are 64 px with a total row (D7)", async ({ page }) => {
    await signInAs(page, "manager", prefill({ type: "new_build" }));
    const rows = page.getByRole("list").filter({ hasText: "Battens" }).getByRole("listitem");
    const heights = await rows.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(heights.length).toBeGreaterThan(2);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(64);
    await expect(rows.last()).toContainText("Labour budget total");
  });

  test("stage editor: one compact row per stage, one open at a time, no visible Stage N, unique names, Remove is 48 px and aligned to the labels (R11, i2-F7, i2-D5)", async ({ page }) => {
    await signInAs(page, "manager", prefill({ type: "new_build" }));
    await page.getByRole("button", { name: "Edit stages" }).click();
    const group = page.getByRole("group", { name: "Stages", exact: true });
    await expect(group).toBeVisible();
    // Closed, each stage is one row: its name and labour budget, at least 48 px to tap and no taller than 80.
    const headers = group.locator("button[aria-expanded]");
    const count = await headers.count();
    expect(count).toBe(5);
    const heights = await headers.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(48);
      expect(h).toBeLessThanOrEqual(80);
    }
    await expect(group.getByRole("textbox")).toHaveCount(0);
    await expect(headers.first()).toHaveAccessibleName(/^Battens \$[\d,]+\.\d{2}$/);
    // Opening a row opens only that row; opening another closes the first.
    const spoken: string[] = [];
    for (let i = 0; i < count; i++) {
      await headers.nth(i).click();
      await expect(headers.nth(i)).toHaveAttribute("aria-expanded", "true");
      await expect(group.locator('button[aria-expanded="true"]')).toHaveCount(1);
      // Name, labour budget and materials budget: one stage's fields, not several.
      await expect(group.getByRole("textbox")).toHaveCount(3);
      spoken.push(...(await group.locator("input").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""))));
      // Visible words never carry the stage number; the spoken names do.
      const visible = await group.evaluate((el) => {
        const copy = el.cloneNode(true) as HTMLElement;
        copy.querySelectorAll(".sr-only").forEach((n) => n.remove());
        return copy.innerText ?? copy.textContent ?? "";
      });
      expect(visible.length).toBeGreaterThan(0);
      expect(visible).not.toMatch(/Stage \d/i);
    }
    expect(spoken).toHaveLength(count * 3);
    expect(new Set(spoken).size).toBe(spoken.length);
    for (const name of spoken) expect(name).toMatch(/^Stage \d (name|labour budget|materials budget)$/);
    // Remove sits inside the open row, is a 48 px target, and its word starts where the labels start.
    const open = page.getByRole("group", { name: `Stage ${count}`, exact: true });
    const remove = open.getByRole("button", { name: `Remove stage ${count}` });
    const box = (await remove.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
    const gap = await open.evaluate((el) => {
      const label = el.querySelector("label")!;
      const button = el.querySelector("button")!;
      const range = document.createRange();
      range.selectNodeContents(button.querySelector("span") ?? button);
      return Math.abs(range.getBoundingClientRect().left - label.getBoundingClientRect().left);
    });
    expect(gap).toBeLessThanOrEqual(2);
    // Removing the stage takes its row away and leaves none open.
    await remove.click();
    await expect(headers).toHaveCount(count - 1);
    await expect(group.getByRole("textbox")).toHaveCount(0);
  });

  test("a refused save with no field to blame says why in the bar (R-F1)", async ({ page }) => {
    // A contract value over the cap is refused by the server and has no message slot beside its field.
    await signInAs(page, "manager", prefill({ contract: "2000000000" }));
    await createJob(page).click();
    await expect(page.locator('[data-slot="primary-action"]')).toContainText("Check the contract value.");
    await expect(page.getByRole("heading", { level: 1, name: "Job added" })).toHaveCount(0);
  });

  test("after saving: title Job added, Log today on this job is the primary, Add another job the secondary, one way back, title holds its place (R10, R4, i2-F5, i2-D15)", async ({ page }) => {
    await signInAs(page, "manager", prefill());
    const before = (await page.getByRole("heading", { level: 1, name: "New job" }).boundingBox())!.y;
    await createJob(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Job added" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to jobs" })).toHaveCount(1);
    const log = page.getByRole("link", { name: "Log today on this job" });
    const another = page.getByRole("button", { name: "Add another job" });
    await expect(log).toHaveAttribute("href", /^\/log\?project=.+/);
    await expect(another).toBeVisible();
    const logBox = (await log.boundingBox())!;
    const anotherBox = (await another.boundingBox())!;
    expect(logBox.height).toBeGreaterThanOrEqual(48);
    expect(anotherBox.height).toBeGreaterThanOrEqual(48);
    // The primary comes first, and only it is filled.
    expect(logBox.y < anotherBox.y || logBox.x < anotherBox.x).toBe(true);
    const fill = (loc: typeof log) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await fill(log)).not.toBe(await fill(another));
    const after = (await page.getByRole("heading", { level: 1 }).boundingBox())!.y;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
    // The new job opens in the log.
    await log.click();
    await expect(page).toHaveURL(/\/log\?project=/);
    await expect(page.getByLabel("Job", { exact: true }).locator("option:checked")).toContainText("Ryde carport roof");
  });
});

test.describe("Edit job", () => {
  const path = `/jobs/${meta.projects.smith}/edit`;

  test("opens filled with the job, no stages, and Save changes off until something changes", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "manager", path);
    await expect(page.getByRole("heading", { level: 1, name: "Edit job" })).toBeVisible();
    await expect(page.getByLabel("Job name")).toHaveValue("Smith job — Ryde re-roof");
    await expect(page.getByLabel("Site address")).toHaveValue("14 Pope St, Ryde NSW 2112");
    await expect(clientSelect(page).locator("option:checked")).toHaveText("Mark Smith");
    await expect(page.getByRole("radio", { name: "Metal re-roof" })).toBeChecked();
    await expect(page.getByLabel("Target finish (optional)")).toHaveValue("2026-10-09");
    await expect(page.getByRole("heading", { level: 2, name: "Stages" })).toHaveCount(0);
    const save = page.getByRole("button", { name: "Save changes", exact: true });
    await expect(save).toBeDisabled();
    await expect(page.getByText("Change something to save.")).toBeVisible();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("saves a change and the list shows it", async ({ page }) => {
    await signInAs(page, "manager", path);
    await page.getByLabel("Job name").fill("Smith job — Ryde re-roof and gutters");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Your changes to Smith job — Ryde re-roof and gutters are saved.");
    await page.getByRole("link", { name: "Back to jobs" }).last().click();
    await expect(page.locator('[data-screen="jobs"] a[href^="/jobs/"]:not([href="/jobs/new"]):visible').filter({ hasText: "and gutters" })).toBeVisible();
  });

  test("the status can change and the job moves to that filter", async ({ page }) => {
    await signInAs(page, "manager", path);
    await page.getByLabel("Status").selectOption("on_hold");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Changes saved" })).toBeVisible();
    await page.goto("/jobs?status=on_hold");
    await expect(page.locator('[data-screen="jobs"] a[href^="/jobs/"]:not([href="/jobs/new"]):visible').filter({ hasText: "Smith job" })).toBeVisible();
  });

  test("a job that isn't there is a not-found page; loading and error have their own states", async ({ page }) => {
    await signInAs(page, "manager", "/jobs/no-such-job/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await page.goto(`${path}?demo=loading`);
    await expect(page.locator('[data-screen="job-form"]')).toHaveAttribute("aria-busy", "true");
    await page.goto(`${path}?demo=error`);
    await expect(page.locator('[data-screen="job-form"] [role="alert"]')).toContainText("Couldn't load this. Try again.");
  });
});
