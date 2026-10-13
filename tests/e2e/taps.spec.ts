import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { Taps } from "./taps";

test.describe("tap counter", () => {
  test("Same as yesterday from Home is 3 taps: Log, Same as yesterday, Save day", async ({ page }) => {
    await page.goto("/prototype/role?as=manager&next=%2F");
    const taps = new Taps("Same as yesterday");
    await taps.tap(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log" }));
    await taps.tap(page.getByRole("button", { name: "Same as yesterday" }));
    await taps.tap(page.getByRole("button", { name: "Save day" }));
    await expect(page.getByRole("status").filter({ hasText: "Logged" })).toBeVisible();
    expect(taps.count).toBe(3);
    taps.assertWithin(3);
  });

  test("a foreman's Log today is one tap from Home", async ({ page }) => {
    await page.goto("/prototype/role?as=foreman&next=%2F");
    const taps = new Taps("Open Log");
    await taps.tap(page.getByRole("link", { name: "Log today" }));
    await expect(page).toHaveURL(/\/log/);
    taps.assertWithin(1);
  });

  test("choosing from a list field counts as one tap", async ({ page }) => {
    await page.setContent('<select aria-label="Stage"><option value="a">A</option><option value="b">B</option></select>');
    const taps = new Taps("Pick a stage");
    await taps.choose(page.getByLabel("Stage"), "b");
    await expect(page.getByLabel("Stage")).toHaveValue("b");
    expect(taps.count).toBe(1);
  });

  test("assertWithin fails when the budget is exceeded and names the taps", async ({ page }) => {
    await page.setContent("<button>One</button><button>Two</button>");
    const taps = new Taps("Two buttons");
    await taps.tap(page.getByRole("button", { name: "One" }));
    await taps.tap(page.getByRole("button", { name: "Two" }));
    expect(() => taps.assertWithin(1)).toThrow(/"Two buttons" took 2 taps; the budget is 1\./);
    expect(() => taps.assertWithin(2)).not.toThrow();
  });

  test("assertWithin passes at exactly the budget and fails one tap over", async ({ page }) => {
    await page.setContent("<button>One</button><button>Two</button><button>Three</button>");
    const taps = new Taps("Three buttons");
    for (const name of ["One", "Two", "Three"]) await taps.tap(page.getByRole("button", { name }));
    expect(() => taps.assertWithin(3)).not.toThrow();
    expect(() => taps.assertWithin(2)).toThrow(/"Three buttons" took 3 taps; the budget is 2\.\n {2}1\. .*\n {2}2\. .*\n {2}3\. /);
  });

  test("think time is spent before every tap and every list choice, and counts toward the wall time", async ({ page }) => {
    await page.setContent('<button>One</button><select aria-label="Stage"><option value="a">A</option><option value="b">B</option></select>');
    const taps = new Taps("Think time", { thinkMs: 80 });
    await taps.tap(page.getByRole("button", { name: "One" }));
    await taps.choose(page.getByLabel("Stage"), "b");
    expect(taps.count).toBe(2);
    expect(taps.elapsedMs, "two taps at 80 ms each").toBeGreaterThanOrEqual(160);
  });

  test("assertWithin fails when the scripted time goes over the limit, even inside the tap budget", async ({ page }) => {
    await page.setContent("<button>One</button><button>Two</button>");
    const taps = new Taps("Slow flow", { thinkMs: 60 });
    await taps.tap(page.getByRole("button", { name: "One" }));
    await taps.tap(page.getByRole("button", { name: "Two" }));
    expect(() => taps.assertWithin(5, { maxMs: 100 })).toThrow(/"Slow flow" took \d+ ms \(with 60 ms think time per tap\); the limit is 100 ms\./);
    expect(() => taps.assertWithin(5, { maxMs: 30_000 })).not.toThrow();
    expect(() => taps.assertWithin(5)).not.toThrow();
  });

  test("the tap budget is checked before the time limit", async ({ page }) => {
    await page.setContent("<button>One</button><button>Two</button>");
    const taps = new Taps("Both over", { thinkMs: 60 });
    await taps.tap(page.getByRole("button", { name: "One" }));
    await taps.tap(page.getByRole("button", { name: "Two" }));
    expect(() => taps.assertWithin(1, { maxMs: 10 })).toThrow(/took 2 taps; the budget is 1/);
  });
});

/**
 * The flow suite cannot quietly drift from flows.md: every flow in the summary table has exactly one spec under
 * `tests/e2e/flows/`, that spec asserts the table's tap budget (and time limit), and no counted control is
 * pressed behind the `Taps` wrapper's back.
 */
test.describe("flow specs against flows.md", () => {
  const flowsDir = path.join(__dirname, "flows");
  const specFiles = readdirSync(flowsDir).filter((f) => f.endsWith(".spec.ts")).sort();
  const read = (file: string) => readFileSync(path.join(flowsDir, file), "utf8");

  const flowsMd = readFileSync(path.join(__dirname, "../../docs/design/flows.md"), "utf8");
  const summaryTable = flowsMd.slice(flowsMd.indexOf("## Flow summary")).split("\n---")[0] ?? "";
  const summary = summaryTable
    .split("\n")
    .filter((line) => line.startsWith("|") && line.includes(".spec.ts"))
    .map((line) => {
      const cells = line.split("|").map((c) => c.trim());
      return {
        flow: cells[1] ?? "",
        budgetCell: cells[3] ?? "",
        file: /`([\w-]+\.spec\.ts)`/.exec(cells[5] ?? "")?.[1] ?? "",
      };
    });

  test("every flow in the flows.md summary has a spec, and every spec is a flow in the summary", () => {
    expect(summary.length, "summary rows read from flows.md").toBe(16);
    expect(summary.map((r) => r.file).sort()).toEqual(specFiles);
  });

  test("each spec asserts its flows.md tap budget on a Taps counter, and the timed flow its time limit", () => {
    for (const row of summary) {
      const budget = Number(/≤\s*(\d+)\s*taps/.exec(row.budgetCell)?.[1]);
      expect(budget, `${row.flow}: a tap budget in "${row.budgetCell}"`).toBeGreaterThan(0);
      const source = read(row.file);
      expect(source, `${row.file} counts taps with Taps`).toMatch(/new Taps\(/);
      const asserted = [...source.matchAll(/assertWithin\((\d+)/g)].map((m) => Number(m[1]));
      expect(asserted.length, `${row.file} asserts a budget`).toBeGreaterThan(0);
      expect(new Set(asserted), `${row.file} asserts the ${budget}-tap budget of "${row.flow}"`).toEqual(new Set([budget]));
      const seconds = /<\s*(\d+)\s*s\b/.exec(row.budgetCell)?.[1];
      if (seconds) {
        expect(source, `${row.file} asserts the ${seconds} s limit`).toContain(`maxMs: MAX_MS`);
        expect(source, `${row.file} sets the limit to ${seconds} s`).toContain(`MAX_MS = ${seconds}_000`);
        expect(source, `${row.file} spends think time on every tap`).toContain("thinkMs: THINK_MS");
      } else {
        expect(source, `${row.file} is tap-counted only (think time is the crew-day flow's)`).not.toMatch(/thinkMs|maxMs/);
      }
    }
  });

  test("no counted control is pressed outside the Taps wrapper unless marked 'outside the count'", () => {
    const raw = /(?<!taps)\.(click|dblclick|fill|selectOption|check|uncheck|setChecked|press|pressSequentially|tap|dispatchEvent)\(/;
    const offenders: string[] = [];
    for (const file of specFiles) {
      const lines = read(file).split("\n");
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line) || !raw.test(line)) return;
        const marked = lines.slice(Math.max(0, i - 3), i + 1).some((l) => l.includes("outside the count"));
        if (!marked) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, "use taps.tap / taps.fill / taps.choose, or say why it is not a counted tap").toEqual([]);
  });
});
