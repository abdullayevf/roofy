/**
 * Design-loop screenshot capture (docs/specs/04-design-process.md §2 steps 2-4).
 *
 * This script does NOT start the app. Start it first:
 *
 *   pnpm build && pnpm start
 *
 * (a production build, so styles/animations/fonts match what users get —
 * the design loop explicitly captures "preview build, not dev mode").
 *
 * Usage:
 *
 *   pnpm design:capture <group> [--screens id,id,...] [--base http://127.0.0.1:3100]
 *
 * <group> is one of tests/e2e/screens.ts's ScreenGroup values ("system",
 * "field-1", "field-2", "jobs-1", "jobs-2", "crew", "expenses", "pay",
 * "reports", "entry-settings"). --screens filters to specific screen ids
 * within that group.
 *
 * For each screen x state x role x viewport (iPhone 390x844, Android
 * 412x915, desktop 1440x900) x scheme (light/dark), writes a full-page PNG:
 *
 *   docs/design/loop/shots/<group>/<screen>-<state>-<role>-<viewport>-<scheme>.png
 *
 * plus one installed-mode iPhone shot per screen (normal state, light,
 * `display-mode: standalone` emulated, safe areas simulated):
 *
 *   docs/design/loop/shots/<group>/<screen>-installed-iphone.png
 *
 * and the automated-checks summary for the whole run:
 *
 *   docs/design/loop/shots/<group>/checks.json
 *   docs/design/loop/shots/<group>/checks.md
 *
 * Browser overrides (same contract as playwright.config.ts, honoured here
 * because this script drives Playwright directly rather than through the
 * test runner):
 *
 *   ROOFY_NO_WEBKIT=1                 run the iPhone viewport on Chromium
 *   ROOFY_CHROMIUM_EXECUTABLE=<path>  Chromium binary to launch
 */

import { chromium, webkit, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkScreenHealthy, collectConsole, type GuardResult } from "../tests/e2e/guards";
import { resolveRoute, SCREENS, type DemoState, type Role, type ScreenSpec } from "../tests/e2e/screens";

type Engine = "chromium" | "webkit";

type Viewport = { name: "iphone" | "android" | "desktop"; width: number; height: number };

const VIEWPORTS: Viewport[] = [
  { name: "iphone", width: 390, height: 844 },
  { name: "android", width: 412, height: 915 },
  { name: "desktop", width: 1440, height: 900 },
];

const SCHEMES = ["light", "dark"] as const;

const SAFE_AREA_TOP_PX = 47;
const SAFE_AREA_BOTTOM_PX = 34;

type CheckRecord = {
  screen: string;
  state: DemoState;
  role: Role | null;
  viewport: Viewport["name"];
  scheme: (typeof SCHEMES)[number];
  engine: Engine;
  file: string;
  results: GuardResult[];
};

function parseArgs(argv: string[]): { group: string; screensFilter?: string[]; base: string } {
  const [group, ...rest] = argv;
  if (!group) {
    console.error("Usage: design-capture.ts <group> [--screens id,id] [--base http://127.0.0.1:3100]");
    process.exit(1);
  }
  let screensFilter: string[] | undefined;
  let base = "http://127.0.0.1:3100";
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--screens") {
      screensFilter = (rest[++i] ?? "").split(",").filter(Boolean);
    } else if (arg === "--base") {
      base = rest[++i] ?? base;
    }
  }
  return { group, screensFilter, base };
}

/**
 * Full-page shots of long screens get shrunk to an unreadable strip by any
 * image viewer (critics included), so every capture also gets viewport-sized
 * slices: `slices/<label>--p01.png`, `--p02.png`, … (max 40). Pinned bars
 * repeat on every slice, exactly as a person scrolling would see them.
 */
async function screenshotSlices(page: Page, outDir: string, label: string): Promise<void> {
  const sliceDir = join(outDir, "slices");
  mkdirSync(sliceDir, { recursive: true });
  const { total, step } = await page.evaluate(() => ({
    total: document.documentElement.scrollHeight,
    step: window.innerHeight,
  }));
  const count = Math.min(40, Math.max(1, Math.ceil(total / step)));
  for (let i = 0; i < count; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * step);
    await page.screenshot({ path: join(sliceDir, `${label}--p${String(i + 1).padStart(2, "0")}.png`) });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function assertServerReachable(base: string): Promise<void> {
  try {
    await fetch(base);
  } catch (err) {
    console.error(
      `design-capture: cannot reach ${base}. This script does not start the server — run \`pnpm build && pnpm start\` first (or pass --base for a different one).`,
    );
    console.error(String(err));
    process.exit(1);
  }
}

/** Which browser engine a given viewport should capture with. */
function engineFor(viewport: Viewport, webkitAvailable: boolean): Engine {
  return viewport.name === "iphone" && webkitAvailable ? "webkit" : "chromium";
}

async function captureOne(opts: {
  browsers: Record<Engine, Browser>;
  base: string;
  screen: ScreenSpec;
  state: DemoState;
  role: Role | null;
  viewport: Viewport;
  scheme: (typeof SCHEMES)[number];
  outDir: string;
  webkitAvailable: boolean;
}): Promise<{ status: "ok" | "skipped"; label: string; checkRecord?: CheckRecord }> {
  const { browsers, base, screen, state, role, viewport, scheme, outDir, webkitAvailable } = opts;
  const engine = engineFor(viewport, webkitAvailable);
  const label = `${screen.id}-${state}-${role ?? "none"}-${viewport.name}-${scheme}`;

  const context = await browsers[engine].newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: scheme,
    reducedMotion: "reduce",
  });

  // state:"foreman" forces the foreman role/DTO for this one capture,
  // regardless of `role` (see tests/e2e/screens.ts's DemoState doc comment).
  const cookieRole = state === "foreman" ? "foreman" : role;
  if (cookieRole) {
    await context.addCookies([{ name: "roofy_role", value: cookieRole, url: base }]);
  }

  const page = await context.newPage();
  const consoleCollector = collectConsole(page);

  const url = new URL(resolveRoute(screen.route), base);
  if (state !== "normal" && state !== "foreman") url.searchParams.set("demo", state);

  const response = await page.goto(url.toString(), { waitUntil: "networkidle" }).catch((err: unknown) => {
    console.warn(`design-capture: navigation to ${url.toString()} failed: ${String(err)}`);
    return null;
  });

  if (!response || response.status() === 404) {
    console.warn(`design-capture: skipping ${label} (route not built yet: ${url.toString()}).`);
    await context.close();
    return { status: "skipped", label };
  }

  await page.evaluate(() => document.fonts.ready).catch(() => undefined);

  const fileName = `${label}.png`;
  await page.screenshot({ path: join(outDir, fileName), fullPage: true });
  await screenshotSlices(page, outDir, label);

  const results = await checkScreenHealthy(page, {
    phone: viewport.name !== "desktop",
    console: consoleCollector,
  });

  await context.close();

  return {
    status: "ok",
    label,
    checkRecord: {
      screen: screen.id,
      state,
      role: cookieRole,
      viewport: viewport.name,
      scheme,
      engine,
      file: fileName,
      results,
    },
  };
}

async function captureInstalled(opts: {
  browsers: Record<Engine, Browser>;
  base: string;
  screen: ScreenSpec;
  outDir: string;
  webkitAvailable: boolean;
}): Promise<void> {
  const { browsers, base, screen, outDir, webkitAvailable } = opts;
  const engine = engineFor({ name: "iphone", width: 390, height: 844 }, webkitAvailable);

  const context = await browsers[engine].newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  // page.emulateMedia has no display-mode feature; CDP is the only way to
  // simulate `display: standalone`, and CDP's Emulation domain is
  // Chromium-only — WebKit has no equivalent, so the shot is still taken
  // (with the safe-area simulation) but without the standalone media query.
  if (engine === "chromium") {
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "display-mode", value: "standalone" }],
    });
  }

  const url = new URL(resolveRoute(screen.route), base);
  const response = await page.goto(url.toString(), { waitUntil: "networkidle" }).catch(() => null);
  const fileName = `${screen.id}-installed-iphone.png`;

  if (!response || response.status() === 404) {
    console.warn(`design-capture: skipping installed-mode shot for ${screen.id} (route not built yet).`);
    await context.close();
    return;
  }

  await page.evaluate(
    ([top, bottom]) => {
      document.documentElement.style.setProperty("--sat-sim", `${top}px`);
      document.documentElement.style.setProperty("--sab-sim", `${bottom}px`);
    },
    [SAFE_AREA_TOP_PX, SAFE_AREA_BOTTOM_PX],
  );
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.screenshot({ path: join(outDir, fileName), fullPage: true });
  await screenshotSlices(page, outDir, fileName.replace(/\.png$/, ""));

  if (engine !== "chromium") {
    console.warn(
      `design-capture: WebKit cannot emulate \`display-mode: standalone\` (CDP-only) — ${fileName} has the safe-area simulation but not the standalone media feature.`,
    );
  }
  await context.close();
}

function writeChecksReport(outDir: string, group: string, records: CheckRecord[], skipped: string[]): void {
  writeFileSync(
    join(outDir, "checks.json"),
    JSON.stringify({ group, generatedAt: new Date().toISOString(), skipped, records }, null, 2),
  );

  const failing = records.filter((r) => r.results.some((c) => !c.ok));
  const lines: string[] = [
    `# Design-loop automated checks — ${group}`,
    "",
    `Generated ${new Date().toISOString()}.`,
    "",
    `${records.length} capture(s) checked, ${failing.length} with failures, ${skipped.length} skipped (route not built yet).`,
    "",
  ];

  if (skipped.length > 0) {
    lines.push("## Skipped (404 — route not built yet)", "");
    for (const s of skipped) lines.push(`- ${s}`);
    lines.push("");
  }

  if (failing.length === 0) {
    lines.push("No guard failures.");
  } else {
    lines.push("## Failures by screen / state / viewport / scheme", "");
    for (const r of failing) {
      lines.push(`### ${r.screen} — ${r.state} — ${r.role ?? "no role"} — ${r.viewport} — ${r.scheme}`);
      for (const c of r.results.filter((c) => !c.ok)) {
        lines.push(`- **${c.name}**`);
        for (const f of c.failures.slice(0, 5)) lines.push(`  - ${f}`);
        if (c.failures.length > 5) lines.push(`  - ... and ${c.failures.length - 5} more`);
      }
      lines.push("");
    }
  }

  writeFileSync(join(outDir, "checks.md"), lines.join("\n") + "\n");
}

async function main(): Promise<void> {
  const { group, screensFilter, base } = parseArgs(process.argv.slice(2));
  await assertServerReachable(base);

  const screens = SCREENS.filter(
    (s) => s.group === group && (!screensFilter || screensFilter.includes(s.id)),
  );
  if (screens.length === 0) {
    console.error(
      `design-capture: no screens in group "${group}"${screensFilter ? ` matching --screens ${screensFilter.join(",")}` : ""}. See tests/e2e/screens.ts.`,
    );
    process.exit(1);
  }

  const outDir = join(process.cwd(), "docs/design/loop/shots", group);
  mkdirSync(outDir, { recursive: true });

  const noWebkit = process.env.ROOFY_NO_WEBKIT === "1";
  const chromiumExecutable = process.env.ROOFY_CHROMIUM_EXECUTABLE;

  const chromiumBrowser = await chromium.launch(
    chromiumExecutable ? { executablePath: chromiumExecutable } : undefined,
  );
  let webkitBrowser: Browser | undefined;
  if (!noWebkit) {
    try {
      webkitBrowser = await webkit.launch();
    } catch (err) {
      console.warn(
        `design-capture: WebKit launch failed, falling back to Chromium for the iphone viewport (set ROOFY_NO_WEBKIT=1 to silence this). ${String(err)}`,
      );
    }
  }
  const webkitAvailable = webkitBrowser !== undefined;
  const browsers: Record<Engine, Browser> = {
    chromium: chromiumBrowser,
    webkit: webkitBrowser ?? chromiumBrowser,
  };

  const records: CheckRecord[] = [];
  const skipped: string[] = [];

  try {
    for (const screen of screens) {
      for (const state of screen.states) {
        const roleList: (Role | null)[] = screen.roles.length > 0 ? screen.roles : [null];
        for (const role of roleList) {
          for (const viewport of VIEWPORTS) {
            if (screen.phoneOnly && viewport.name === "desktop") continue;
            if (screen.desktopOnly && viewport.name !== "desktop") continue;
            for (const scheme of SCHEMES) {
              const result = await captureOne({
                browsers,
                base,
                screen,
                state,
                role,
                viewport,
                scheme,
                outDir,
                webkitAvailable,
              });
              if (result.status === "skipped") skipped.push(result.label);
              else if (result.checkRecord) records.push(result.checkRecord);
            }
          }
        }
      }
      await captureInstalled({ browsers, base, screen, outDir, webkitAvailable });
    }
  } finally {
    await chromiumBrowser.close();
    if (webkitBrowser) await webkitBrowser.close();
  }

  writeChecksReport(outDir, group, records, skipped);

  const failing = records.filter((r) => r.results.some((c) => !c.ok));
  console.log(
    `design-capture: ${records.length} capture(s), ${failing.length} with guard failures, ${skipped.length} skipped. See ${join("docs/design/loop/shots", group, "checks.md")}.`,
  );
}

if (process.argv[1]?.endsWith("design-capture.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
