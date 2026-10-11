import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { checkBackRow, checkTableEdgeGap, checkTableHeaderAlign, collectConsole, expectScreenHealthy } from "./guards";
import { expectNoMoney } from "./money-scan";

const isPhone = (name: string) => name !== "desktop";
const NO_ACCESS = "You don't have access to this. Ask your manager.";
const NEEDS_CONNECTION = "Needs connection — try again once you're back online.";
const exportButton = (page: Page) => page.getByRole("button", { name: "Export workspace" });
const files = (page: Page) => page.locator("[data-export-file]:visible");

async function signInAs(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

test.describe("Workspace export (screen 26)", () => {
  test("an Owner sees the files, the attachments and one Export workspace button", async ({ page }, testInfo) => {
    const consoleLog = collectConsole(page);
    await signInAs(page, "owner", "/export");
    await expect(page.getByRole("heading", { level: 1, name: "Workspace export" })).toBeVisible();
    expect(await files(page).count(), "every file in the export is listed").toBeGreaterThanOrEqual(10);
    const listed = (await files(page).allInnerTexts()).join("\n");
    expect(listed).toContain("expenses.csv");
    expect(listed).toMatch(/pay_runs\.csv[\s\S]*Pay runs[\s\S]*\d+ rows?/);
    await expect(page.locator("[data-export-attachments]")).toHaveText(/^(No attachments yet\.|\d[\d,]* attachments?, [\d.]+ (KB|MB|GB))$/);
    await expect(exportButton(page), "one tap, one button").toHaveCount(1);
    await expect(exportButton(page)).toBeEnabled();
    await expect(page.getByText(NEEDS_CONNECTION)).toHaveCount(0);
    if (isPhone(testInfo.project.name)) expect((await checkBackRow(page)).failures).toEqual([]);
    else {
      expect((await checkTableEdgeGap(page)).failures).toEqual([]);
      expect((await checkTableHeaderAlign(page)).failures).toEqual([]);
    }
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("More lists it for the Owner and one tap on Export workspace saves the zip", async ({ page }, testInfo) => {
    await signInAs(page, "owner", "/more");
    await page.getByRole("link", { name: /^Workspace export/ }).first().click();
    await expect(page).toHaveURL(/\/export$/);
    const download = page.waitForEvent("download");
    await exportButton(page).click();
    const saved = await download;
    expect(saved.suggestedFilename()).toBe("roofy-workspace-export.zip");
    const bytes = await readFile(await saved.path());
    expect(bytes.subarray(0, 2).toString("latin1"), "a zip starts with PK").toBe("PK");
    const text = bytes.toString("utf8");
    for (const name of ["expenses.csv", "pay_runs.csv", "audit_events.csv", "crew_members.csv"]) expect(text, name).toContain(name);
    await expect(page.getByRole("status")).toHaveText(/^Done\. roofy-workspace-export\.zip is saved to your downloads\.$/);
    await expect(exportButton(page), "ready to export again").toBeEnabled();
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
  });

  test("a failed export says so and can be tried again", async ({ page }) => {
    await signInAs(page, "owner", "/export");
    await page.route("**/export/download", (route) => route.fulfill({ status: 503, body: "Couldn't make the file. Try again." }));
    await exportButton(page).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Couldn't make the file. Try again.");
    await expect(exportButton(page)).toBeEnabled();
  });

  for (const state of ["loading", "error", "offline", "empty"] as const) {
    test(`${state} state renders healthy`, async ({ page }, testInfo) => {
      await signInAs(page, "owner", `/export?demo=${state}`);
      await expect(page.getByRole("heading", { level: 1, name: "Workspace export" })).toBeVisible();
      if (state === "error") await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      if (state === "offline") {
        await expect(page.getByText(/^Lists updated .+ ago\.$/)).toBeVisible();
        expect(await files(page).count(), "the list still reads offline").toBeGreaterThanOrEqual(10);
        await expect(exportButton(page), "the write is off").toBeDisabled();
        await expect(page.getByText(NEEDS_CONNECTION), "one Needs connection sentence").toHaveCount(1);
      }
      if (state === "empty") {
        await expect(page.getByText(/^No jobs yet, so most of these files/)).toBeVisible();
        await expect(exportButton(page)).toBeEnabled();
      }
      if (state !== "loading") await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name) });
    });
  }

  test("a Manager, an Accountant and a Foreman get no permission, no list and no file", async ({ page }) => {
    for (const role of ["manager", "accountant", "foreman"]) {
      await signInAs(page, role, "/export");
      await expect(page.getByText(NO_ACCESS)).toBeVisible();
      await expect(page.locator("[data-export-file]")).toHaveCount(0);
      await expect(exportButton(page)).toHaveCount(0);
      const res = await page.request.get("/export/download");
      expect(res.status(), `${role} gets no file`).toBe(403);
      expect(res.headers()["content-type"]).toContain("text/plain");
      expect(await res.text()).toBe(NO_ACCESS);
    }
    await expectNoMoney(page, ["/export", "/export/download"]);
  });

  test("the Owner's file is a zip with a name", async ({ page }) => {
    await signInAs(page, "owner", "/export");
    const res = await page.request.get("/export/download");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/zip");
    expect(res.headers()["content-disposition"]).toBe('attachment; filename="roofy-workspace-export.zip"');
  });
});
