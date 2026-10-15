import { expect, test, type Locator, type Page } from "@playwright/test";
import { collectConsole, expectScreenHealthy, waitForHydrated } from "./guards";

/** Task 13 run 3: removing a person from the team, the Owner two-factor line, and the two-factor set-up with its QR code. */

const isPhone = (name: string) => name !== "desktop";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function go(page: Page, role: string, next: string) {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
  await waitForHydrated(page);
}

test.describe("Members: remove a person", () => {
  test("Owner two-factor line says on; when off it is a blocker row with a 48 px way to fix it", async ({
    page,
  }) => {
    await go(page, "owner", "/settings/members");
    await expect(page.getByText("Two-factor is on for the owner.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up two-factor" })).toHaveCount(0);
    await go(page, "owner", "/settings/members?demo=blocked");
    await expect(
      page.getByText("Two-factor is off for the owner. Turn it on before you approve a pay run.", {
        exact: true,
      }),
    ).toBeVisible();
    const link = page.getByRole("link", { name: "Set up two-factor" });
    await expect(link).toHaveAttribute("href", "/settings/two-factor");
    const box = (await link.boundingBox())!;
    expect(box.height, "the link is a 48 px target").toBeGreaterThanOrEqual(48);
    await expect(
      page.locator("main svg.text-watch").first(),
      "the warning icon sits in the row",
    ).toBeVisible();
  });

  test("Remove from team asks first, names the person, Cancel keeps them, the second press removes them", async ({
    page,
  }, testInfo) => {
    const consoleLog = collectConsole(page);
    await go(page, "owner", "/settings/members");
    await page
      .getByRole("button", { name: /Priya Shah/ })
      .first()
      .click();
    const remove = button(page, "Remove from team");
    await expect(remove).toBeVisible();
    const box = (await remove.boundingBox())!;
    expect(box.height, "Remove from team is a 48 px target").toBeGreaterThanOrEqual(48);
    await remove.click();

    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog).toContainText("Remove Priya Shah?");
    await expect(dialog).toContainText("They lose their access to Roofy straight away.");
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });

    await button(page, "Cancel").click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Priya Shah/ }).first(),
      "Cancel keeps the person",
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Priya Shah/ })
      .first()
      .click();
    await button(page, "Remove from team").click();
    await button(page, "Remove from team").click();
    await expect(page.getByText("Priya Shah removed.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Priya Shah/ }), "the row is gone").toHaveCount(0);
  });

  test("offline: Save role gives the one reason right under it, and Remove from team sits last, off, with no second line", async ({
    page,
  }) => {
    await go(page, "owner", "/settings/members?demo=offline");
    await page
      .getByRole("button", { name: /Priya Shah/ })
      .first()
      .click();
    const sheet = page.getByRole("dialog");
    const save = sheet.getByRole("button", { name: "Save role", exact: true });
    const remove = button(page, "Remove from team");
    await expect(remove).toBeDisabled();
    const reason = sheet.getByText(/^Needs connection/);
    await expect(reason, "one reason in the sheet, not two").toHaveCount(1);
    const [s, r, x] = [await save.boundingBox(), await reason.boundingBox(), await remove.boundingBox()];
    expect(r!.y, "the reason sits directly under Save role").toBeGreaterThanOrEqual(s!.y + s!.height - 1);
    expect(r!.y - (s!.y + s!.height), "close under it").toBeLessThanOrEqual(16);
    expect(x!.y, "Remove from team is below the main action and its reason").toBeGreaterThanOrEqual(
      r!.y + r!.height,
    );
  });

  test("members & roles is the owner's: a foreman is sent to the manager and a manager to the owner, with no member list or money", async ({
    page,
  }) => {
    for (const [role, ask] of [
      ["foreman", "your manager"],
      ["manager", "the owner"],
    ] as const) {
      await go(page, role, "/settings/members");
      await expect(
        page.getByText(`You don't have access to this. Ask ${ask}.`, { exact: true }),
        `${role} is told who to ask`,
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /Priya Shah/ }), `${role} gets no member rows`).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Remove from team" })).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(/\$\s?\d/);
    }
  });
});

test.describe("Sheet scrim", () => {
  for (const [scheme, colour] of [
    ["light", "rgba(31, 34, 36, 0.4)"],
    ["dark", "rgba(0, 0, 0, 0.6)"],
  ] as const) {
    test(`the veil behind the role sheet darkens the page in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await go(page, "owner", "/settings/members");
      await page
        .getByRole("button", { name: /Priya Shah/ })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const bg = await page
        .locator(".fixed.inset-0.z-40")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, "the veil is the scrim token, never the ink colour (which turns light in dark mode)").toBe(
        colour,
      );
    });
  }
});

test.describe("Settings two-factor: set-up with a QR code", () => {
  test("off: a QR code, the key as text, no sideways scroll, and a wrong code is said in words", async ({
    page,
  }, testInfo) => {
    const consoleLog = collectConsole(page);
    await go(page, "owner", "/settings/two-factor?demo=blocked");
    const qr = page.getByRole("img", { name: "Scan this with your authenticator app" });
    await expect(qr).toBeVisible();
    const size = (await qr.boundingBox())!;
    expect(size.width, "the QR code is big enough to scan").toBeGreaterThanOrEqual(160);
    await expect(page.getByText("RFY4 7KQ2 MZTD 3XWB"), "the key is there for typing by hand").toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no sideways scroll").toBeLessThanOrEqual(0);

    await page.getByLabel("Code").fill("000000");
    await button(page, "Turn on two-factor").click();
    await expect(page.getByText("That code doesn't match.")).toBeVisible();
    await expect(page.getByText(/^Two-factor is on\. When you sign in/)).toHaveCount(0);
    await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
  });

  test("a good code turns it on and the QR code goes away", async ({ page }) => {
    await go(page, "owner", "/settings/two-factor?demo=blocked");
    await page.getByLabel("Code").fill("482913");
    await button(page, "Turn on two-factor").click();
    await expect(page.getByText(/^Two-factor is on\. When you sign in/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Scan this with your authenticator app" })).toHaveCount(0);
  });

  test("the Turn on button is pinned clear of the tab bar, the code box is short, the key can be copied, and the phone can open the app", async ({
    page,
    context,
  }, testInfo) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await go(page, "owner", "/settings/two-factor?demo=blocked");
    const phone = isPhone(testInfo.project.name);
    const turnOn = button(page, "Turn on two-factor");
    await expect(turnOn).toBeVisible();
    const t = (await turnOn.boundingBox())!;
    const viewportHeight = page.viewportSize()!.height;
    expect(t.y + t.height, "the button is on screen without scrolling").toBeLessThanOrEqual(viewportHeight);
    if (phone) {
      const tabs = (await page.locator('nav[aria-label="Primary"].fixed').boundingBox())!;
      expect(t.y + t.height, "the button is above the tab bar").toBeLessThanOrEqual(tabs.y + 1);
    }

    const code = (await page.getByLabel("Code").boundingBox())!;
    expect(code.width, "a 6-digit box is not the full width of the screen").toBeLessThanOrEqual(212);
    expect(code.height, "and still a 48 px target").toBeGreaterThanOrEqual(48);

    const copy = button(page, "Copy key");
    await expect(copy).toBeVisible();
    expect((await copy.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await copy.click();
    await expect(button(page, "Copied")).toBeVisible();

    const open = page.getByRole("link", { name: "Open in authenticator app" });
    if (phone) {
      await expect(open).toBeVisible();
      expect(await open.getAttribute("href")).toMatch(/^otpauth:\/\/totp\//);
      expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    } else {
      await expect(open, "on a desktop there is no app to open").toBeHidden();
    }
  });
});

test.describe("Desktop layout of the members page", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  const edges = (box: { x: number; width: number }) => ({ left: box.x, right: box.x + box.width });

  test("content sits 24 to 40 px from the sidebar and from the right edge", async ({ page }) => {
    await go(page, "owner", "/settings/members");
    const heading = (await page.getByRole("heading", { name: "People", exact: true }).boundingBox())!;
    const invite = (await page.locator('section[aria-labelledby="members-invite"]').boundingBox())!;
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    const gutterLeft = edges(heading).left - 240;
    const gutterRight = width - edges(invite).right;
    expect(gutterLeft, `left gutter ${gutterLeft}`).toBeGreaterThanOrEqual(24);
    expect(gutterLeft, `left gutter ${gutterLeft}`).toBeLessThanOrEqual(40);
    expect(gutterRight, `right gutter ${gutterRight}`).toBeGreaterThanOrEqual(24);
    expect(gutterRight, `right gutter ${gutterRight}`).toBeLessThanOrEqual(40);
  });

  test("the removed toast stays in the content column and covers no field", async ({ page }) => {
    await go(page, "owner", "/settings/members");
    await page
      .getByRole("button", { name: /Priya Shah/ })
      .first()
      .click();
    await button(page, "Remove from team").click();
    await button(page, "Remove from team").click();
    const toast = page.getByText("Priya Shah removed.", { exact: true });
    await expect(toast).toBeVisible();
    const t = (await toast
      .locator("xpath=ancestor-or-self::*[@role='status' or @data-state][1]")
      .boundingBox())!;
    expect(t.x, "the toast does not slide under the sidebar").toBeGreaterThanOrEqual(240);
    const inputs: Locator = page.locator("main input:visible, main textarea:visible, main select:visible");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const f = (await inputs.nth(i).boundingBox())!;
      const overlaps =
        t.x < f.x + f.width && t.x + t.width > f.x && t.y < f.y + f.height && t.y + t.height > f.y;
      expect(overlaps, `the toast covers field ${i}`).toBe(false);
    }
  });
});
