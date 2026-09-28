import { expect, test } from "@playwright/test";
import { runAxe } from "./axe";

test("/design loads, has the right title and heading", async ({ page }) => {
  await page.goto("/design");
  await expect(page).toHaveTitle("Design system");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Design system");
});

test("/design has no horizontal overflow", async ({ page }) => {
  await page.goto("/design");
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test("/design has no serious or critical axe violations", async ({ page }) => {
  await page.goto("/design");
  const results = await runAxe(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("every button and input on /design is at least 48 px tall on phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "48 px targets are a phone/tablet requirement");
  await page.goto("/design");

  const heights = await page.evaluate(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]",
    );
    return (
      Array.from(nodes)
        .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
        // A `pointer-events: none` element can't actually be tapped (e.g.
        // Radix Checkbox's hidden native <input>, kept only for native form
        // serialization) — it isn't a real touch target, so it isn't checked
        // as one.
        .filter((el) => getComputedStyle(el).pointerEvents !== "none")
        // A true inline link (Button variant="link") reads inline in a
        // sentence rather than standing alone as a 48 px target (DESIGN.md
        // §4/§8's own stated exception).
        .filter((el) => el.getAttribute("data-variant") !== "link")
        .map((el) => {
          // A radio/checkbox absolutely positioned inside a bordered
          // <label> (Segmented, ChoiceChip) sits inside the label's
          // *padding* box, so its own rect comes up a couple of px short of
          // the border box — but native <label> click-forwarding means the
          // whole label, border included, is the real tap target, not just
          // the input's own slightly-smaller rect.
          const target = (el.tagName === "INPUT" && el.closest("label")) || el;
          const rect = target.getBoundingClientRect();
          return { tag: el.tagName, text: (el.textContent ?? "").trim().slice(0, 40), height: rect.height };
        })
    );
  });

  expect(heights.length).toBeGreaterThan(0);
  const tooSmall = heights.filter((h) => h.height < 48);
  expect(tooSmall, JSON.stringify(tooSmall, null, 2)).toEqual([]);
});

test("/design logs no console errors", async ({ page }) => {
  // The browser's own "Failed to load resource: ... 404" console message
  // carries no URL, so failed responses are tracked separately: the only
  // expected 404 on this route today is /favicon.ico (PWA icons are a
  // later phase's task, not this one's). Any other failed response, or any
  // console error that isn't one of these expected resource-load notices,
  // fails the test.
  const failedUrls: string[] = [];
  page.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push(`${res.status()} ${res.url()}`);
  });

  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/^Failed to load resource:/.test(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  // "load", not "networkidle": a lingering keepalive connection can leave
  // "networkidle" waiting past the test timeout for no real reason. A fixed
  // pause after "load" gives client components (Stepper, Checkbox,
  // Segmented, ...) time to hydrate before checking for hydration warnings.
  await page.goto("/design", { waitUntil: "load" });
  await page.waitForTimeout(1000);

  const unexpectedFailedUrls = failedUrls.filter((u) => !u.endsWith("/favicon.ico"));
  expect(unexpectedFailedUrls, JSON.stringify(unexpectedFailedUrls, null, 2)).toEqual([]);
  expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
});
