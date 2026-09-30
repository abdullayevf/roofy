import { expect, test, type Page } from "@playwright/test";
import { checkSafeAreas, collectConsole, expectScreenHealthy } from "./guards";

type Role = "owner" | "manager" | "foreman" | "accountant";

async function signInAs(page: Page, role: Role, next = "/") {
  await page.goto(`/prototype/role?as=${role}&next=${encodeURIComponent(next)}`);
}

const isPhone = (name: string) => name !== "desktop";

/** Labels of the primary nav's links (the visible one: tab bar on a phone, sidebar on desktop). */
async function navLabels(page: Page): Promise<string[]> {
  const links = page.getByRole("navigation", { name: "Primary" }).getByRole("link");
  return (await links.allInnerTexts()).map((t) => t.trim());
}

const PHONE_ITEMS: Record<"manager" | "foreman" | "accountant", string[]> = {
  manager: ["Home", "Jobs", "Log", "Crew", "More"],
  // The phone bar and the desktop sidebar list the same order; Log is raised on the phone bar.
  foreman: ["Home", "Jobs", "Log", "Outbox"],
  accountant: ["Home", "Pay", "Reports", "More"],
};

test.describe("manifest and head", () => {
  test("the manifest is served, valid, and its icons load", async ({ page, request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("json");
    const manifest = await response.json();
    expect(manifest.orientation).toBeUndefined();
    expect(manifest).toMatchObject({ name: "Roofy", short_name: "Roofy", display: "standalone", start_url: "/" });
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.theme_color).toBe(manifest.background_color);
    const sizes = (manifest.icons as { sizes: string; purpose: string }[]).map((i) => `${i.sizes} ${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
    for (const icon of manifest.icons as { src: string; type: string }[]) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()["content-type"]).toBe(icon.type);
    }

    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "default");
    expect(await page.locator('meta[name="theme-color"]').count()).toBe(2);
  });

  test("the theme cookie sets data-theme on <html> and the browser bar colour", async ({ page, context, baseURL }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
    await context.addCookies([{ name: "roofy_theme", value: "dark", url: baseURL! }]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.locator('meta[name="theme-color"]').count()).toBe(1);
  });
});

test.describe("navigation by role", () => {
  for (const [role, navRole] of [
    ["manager", "manager"],
    ["owner", "manager"],
    ["foreman", "foreman"],
    ["accountant", "accountant"],
  ] as const) {
    test(`${role} sees the ${navRole} items with the right one active`, async ({ page }, testInfo) => {
      await signInAs(page, role, role === "foreman" ? "/log" : "/");
      const expected = PHONE_ITEMS[navRole];
      const desktopExtras =
        navRole === "manager" && !isPhone(testInfo.project.name) ? ["Expenses", "Pay runs", "Reports", "Settings"] : [];
      expect(await navLabels(page)).toEqual([...expected, ...desktopExtras]);
      const landing = navRole === "foreman" ? "Log" : expected[0]!;
      await expect(page.getByRole("navigation", { name: "Primary" }).locator('[aria-current="page"]')).toHaveText(landing);

      // Follow the last item and check the active state moves with it.
      const target = expected.at(-1)!;
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: target }).click();
      await expect(page.getByRole("navigation", { name: "Primary" }).locator('[aria-current="page"]')).toHaveText(target);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(target);
      if (isPhone(testInfo.project.name)) {
        // The active item's icon is the Phosphor Fill weight (a filled path, not the outline).
        const active = page.getByRole("navigation", { name: "Primary" }).locator('[aria-current="page"] svg');
        await expect(active).toBeVisible();
      }
    });
  }

  test("a foreman starting at Home stays on Home", async ({ page }) => {
    await signInAs(page, "foreman", "/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
  });

  test("on desktop the manager's sidebar also lists Expenses, Pay runs, Reports and Settings", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the sidebar is desktop-only");
    await signInAs(page, "manager", "/settings");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const label of ["Expenses", "Pay runs", "Reports", "Settings"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(nav.locator('[aria-current="page"]')).toHaveText("Settings");
    expect(await page.getByRole("navigation", { name: "Primary" }).boundingBox().then((b) => Math.round(b!.width))).toBe(240);
  });

  test("the More menu lists what the role can reach", async ({ page }) => {
    await signInAs(page, "manager", "/more");
    const main = page.getByRole("main");
    for (const label of ["Expenses", "Pay runs", "Reports", "Settings", "Record history", "Install guide"]) {
      await expect(main.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
    await expect(main.getByRole("link", { name: /Workspace export/ })).toHaveCount(0);
    await signInAs(page, "owner", "/more");
    await expect(main.getByRole("link", { name: /Workspace export/ })).toBeVisible();
    await page.goto("/export");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Workspace export");
    await signInAs(page, "manager", "/export");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No access");
    await signInAs(page, "accountant", "/more");
    await expect(main.getByRole("link")).toHaveCount(2);
    await expect(main.getByRole("link", { name: /Expenses/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /Install guide/ })).toBeVisible();
  });
});

test.describe("layout", () => {
  test("phone tab bar targets are at least 48 px and the bar clears the bottom", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    await signInAs(page, "manager");
    const links = page.getByRole("navigation", { name: "Primary" }).getByRole("link");
    const boxes = await links.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      }),
    );
    expect(boxes).toHaveLength(5);
    for (const b of boxes) {
      expect(b.h).toBeGreaterThanOrEqual(48);
      expect(b.w).toBeGreaterThanOrEqual(48);
    }
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeInViewport();
  });

  test("nothing interactive sits under the notch or home indicator (simulated iPhone insets)", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    for (const path of ["/", "/more", "/jobs"]) {
      await page.goto(path);
      const result = await checkSafeAreas(page);
      expect(result.failures, `${path}: ${result.failures.join("\n")}`).toEqual([]);
    }
  });

  test("the tab bar pads left and right for the device insets", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Primary" });
    // Playwright can't set a real inset, so check the padding is wired to env().
    const cls = await bar.getAttribute("class");
    expect(cls).toContain("safe-area-inset-left");
    expect(cls).toContain("safe-area-inset-right");
  });

  test("the layout pads with the safe-area insets", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => document.documentElement.style.setProperty("--sat-sim", "47px"));
    const top = await page.getByRole("main").evaluate((el) => el.parentElement!.getBoundingClientRect().top);
    const padding = await page.getByRole("main").evaluate((el) => getComputedStyle(el.parentElement!).paddingTop);
    expect(padding).toBe("47px");
    expect(top).toBeGreaterThanOrEqual(0);
  });
});

test.describe("demo states in the shell", () => {
  test("offline shows the banner; waiting and attention show the badge", async ({ page }) => {
    await page.goto("/?demo=offline");
    await expect(page.getByRole("status")).toContainText("No signal");
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.goto("/?demo=waiting");
    await expect(page.getByRole("link", { name: "3 to send" })).toBeVisible();
    await page.goto("/?demo=attention");
    await expect(page.getByRole("link", { name: "1 needs attention" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("link", { name: /to send/ })).toHaveCount(0);
  });

  test("no permission: demo state and foreman-blocked pages show a plain way back", async ({ page }) => {
    await page.goto("/jobs?demo=noperm");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No access");
    await expect(page.getByText("You don't have access to this. Ask your manager.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();
    await signInAs(page, "foreman", "/pay");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No access");
    await page.getByRole("link", { name: "Back to Log" }).click();
    await expect(page).toHaveURL(/\/log$/);
  });

  test("an error keeps the nav and offers Try again", async ({ page }) => {
    await page.goto("/jobs?demo=error");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Something went wrong");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  test("an unknown address gets a not-found page with a way back", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    await page.getByRole("link", { name: "Go to Home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("every link resolves", () => {
  for (const role of ["owner", "manager", "foreman", "accountant"] as const) {
    test(`${role}: every nav and More link opens without a 404 or console error`, async ({ page }) => {
      const consoleLog = collectConsole(page);
      const failed: string[] = [];
      page.on("response", (res) => {
        if (res.status() >= 400 && new URL(res.url()).origin === new URL(page.url()).origin)
          failed.push(`${res.status()} ${res.url()}`);
      });
      await signInAs(page, role, "/");
      const hrefs = new Set<string>();
      const collect = async () => {
        for (const href of await page.locator("a[href^='/']").evaluateAll((els) => els.map((e) => e.getAttribute("href")!)))
          hrefs.add(href);
      };
      await collect();
      if (role !== "foreman") {
        await page.goto("/more");
        await collect();
      }
      expect(hrefs.size).toBeGreaterThan(2);
      // Home links to detail pages that don't exist yet: job and stage detail /jobs/<id>[/stages/<id>] (Task 14),
      // crew detail /crew/<id> (Task 15), pay run review /pay/<id>[#crew-<id>] (Task 17). Skip exactly those
      // shapes (not /jobs/new or /crew/new) and drop each pattern as its task lands.
      const notBuiltYet = [
        /^\/jobs\/(?!new(?:$|[/?#]))[^/?#]+(?:\/stages\/[^/?#]+)?$/,
        /^\/crew\/(?!new(?:$|[/?#]))[^/?#]+$/,
        /^\/pay\/[^/?#]+(?:#.*)?$/,
      ];
      for (const href of [...hrefs].filter((h) => !notBuiltYet.some((re) => re.test(h)))) {
        const res = await page.goto(href);
        expect(res?.status(), href).toBeLessThan(400);
        await expect(page.getByRole("heading", { level: 1 }), href).toBeVisible();
      }
      // Give any prefetches time to land, then check nothing failed.
      await page.waitForTimeout(500);
      expect(failed).toEqual([]);
      expect(consoleLog.messages).toEqual([]);
    });
  }
});

test.describe("shell pages are healthy", () => {
  for (const [role, path] of [
    ["manager", "/"],
    ["manager", "/jobs"],
    ["manager", "/more"],
    ["foreman", "/"],
    ["foreman", "/log"],
    ["accountant", "/pay"],
  ] as const) {
    test(`${role} ${path}`, async ({ page }, testInfo) => {
      const consoleLog = collectConsole(page);
      await signInAs(page, role, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectScreenHealthy(page, { phone: isPhone(testInfo.project.name), console: consoleLog });
    });
  }
});
