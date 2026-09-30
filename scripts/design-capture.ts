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
 * Extra responsive captures for the normal state (first role, light):
 * `<screen>-normal-<role>-landscape-light.png` (844x390), `...-tablet-light.png`
 * (820x1180), and for screens with a `keyboard` entry in the manifest
 * `<screen>-keyboard-iphone.png` (viewport shrunk by the keyboard's height,
 * field focused). The installed shot also writes `-installed-iphone-top.png`
 * and `-installed-iphone-bottom.png`: the first and last screen at viewport
 * size, showing the top and bottom insets, plus one `-installed-iphone-<section>.png`
 * per manifest `installedSections` entry (the gallery's bars sit in the page).
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
import {
  checkNoMoney,
  checkScreenHealthy,
  collectConsole,
  KEYBOARD_HEIGHT_PX,
  type GuardResult,
} from "../tests/e2e/guards";
import { resolveRoute, SCREENS, type DemoState, type Role, type ScreenSpec } from "../tests/e2e/screens";

type Engine = "chromium" | "webkit";

type Viewport = {
  name: "iphone" | "android" | "desktop" | "landscape" | "tablet";
  width: number;
  height: number;
  /** Most slices to write for one capture (default 40). */
  maxSlices?: number;
  /** Guards to skip because they do not mean anything at this size. */
  skip?: Parameters<typeof checkScreenHealthy>[1]["skip"];
};

const VIEWPORTS: Viewport[] = [
  { name: "iphone", width: 390, height: 844 },
  { name: "android", width: 412, height: 915 },
  { name: "desktop", width: 1440, height: 900 },
];

/**
 * DESIGN.md §8 responsive cases beyond the three main viewports, captured for
 * the normal state, first role, light scheme only: a phone on its side and a
 * tablet-width screen (600-1023, phone layout with wider content).
 */
const EXTRA_VIEWPORTS: Viewport[] = [
  // The keyboard guard shrinks the viewport by 336 px, which leaves nothing at 390 px tall; the keyboard is
  // captured on its own, in portrait (see captureKeyboard).
  { name: "landscape", width: 844, height: 390, maxSlices: 90, skip: { keyboard: true } },
  { name: "tablet", width: 820, height: 1180 },
];

const SCHEMES = ["light", "dark"] as const;

const SAFE_AREA_TOP_PX = 47;
const SAFE_AREA_BOTTOM_PX = 34;
const SAFE_AREA_SIDE_PX = 47;

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
async function screenshotSlices(page: Page, outDir: string, label: string, maxSlices = 40): Promise<void> {
  const sliceDir = join(outDir, "slices");
  mkdirSync(sliceDir, { recursive: true });
  const { total, step } = await page.evaluate(() => ({
    total: document.documentElement.scrollHeight,
    step: window.innerHeight,
  }));
  const count = Math.min(maxSlices, Math.max(1, Math.ceil(total / step)));
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
  await screenshotSlices(page, outDir, label, viewport.maxSlices);

  const results = await checkScreenHealthy(page, {
    phone: viewport.name !== "desktop",
    console: consoleCollector,
    skip: viewport.skip,
  });
  // A foreman never sees an amount, in any state or viewport.
  if (cookieRole === "foreman") results.push(await checkNoMoney(page));

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
  /** The screen's role: the shot is signed in as them (a foreman's installed shots must be the foreman's screen). */
  role: Role | null;
  /** iPhone on its side: 844x390 with the notch-side left/right insets (and a home-bar inset, no status-bar inset). */
  landscape?: boolean;
}): Promise<CheckRecord | undefined> {
  const { browsers, base, screen, outDir, webkitAvailable, role, landscape = false } = opts;
  const engine = engineFor({ name: "iphone", width: 390, height: 844 }, webkitAvailable);
  const size = landscape ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const insets = landscape
    ? { top: 0, bottom: 21, left: SAFE_AREA_SIDE_PX, right: SAFE_AREA_SIDE_PX }
    : { top: SAFE_AREA_TOP_PX, bottom: SAFE_AREA_BOTTOM_PX, left: 0, right: 0 };

  const context = await browsers[engine].newContext({
    viewport: size,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  if (role) await context.addCookies([{ name: "roofy_role", value: role, url: base }]);
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
  const fileName = `${screen.id}-installed-${landscape ? "landscape" : "iphone"}.png`;

  if (!response || response.status() === 404) {
    console.warn(`design-capture: skipping installed-mode shot for ${screen.id} (route not built yet).`);
    await context.close();
    return undefined;
  }

  await page.evaluate(({ top, bottom, left, right }) => {
    document.documentElement.style.setProperty("--sat-sim", `${top}px`);
    document.documentElement.style.setProperty("--sab-sim", `${bottom}px`);
    document.documentElement.style.setProperty("--sal-sim", `${left}px`);
    document.documentElement.style.setProperty("--sar-sim", `${right}px`);
  }, insets);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  if (!landscape) {
    await page.screenshot({ path: join(outDir, fileName), fullPage: true });
    await screenshotSlices(page, outDir, fileName.replace(/\.png$/, ""));
  }

  // The one long image can't be reviewed, so the first and last screen a person would see are also written as
  // plain viewport shots: the top inset over the page header, and the bottom inset with the tab bar (and any
  // pinned sheet action) above it.
  const base_ = fileName.replace(/\.png$/, "");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(outDir, `${base_}-top.png`) });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: join(outDir, `${base_}-bottom.png`) });
  // Screens whose bars sit in the page rather than fixed to the viewport (the gallery): one shot per named
  // section, its heading scrolled to the top, so the tab bars and pinned actions and their bottom inset show.
  for (const section of screen.installedSections ?? []) {
    await page
      .getByRole("heading", { level: 2, name: section, exact: true })
      .first()
      .evaluate((el) => {
        el.scrollIntoView({ block: "start" });
      });
    const slug = section.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await page.screenshot({ path: join(outDir, `${base_}-${slug}.png`) });
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  if (engine !== "chromium" && !landscape) {
    console.warn(
      `design-capture: WebKit cannot emulate \`display-mode: standalone\` (CDP-only) — ${fileName} has the safe-area simulation but not the standalone media feature.`,
    );
  }
  // Only the foreman check runs on installed shots; the other guards ran on the same route's ordinary captures.
  const record: CheckRecord | undefined =
    role === "foreman"
      ? {
          screen: screen.id,
          state: "normal",
          role,
          viewport: "iphone",
          scheme: "light",
          engine,
          file: fileName,
          results: [await checkNoMoney(page)],
        }
      : undefined;
  await context.close();
  return record;
}

/**
 * Keyboard-open capture (DESIGN.md §8: "sheet content scrolls above the
 * keyboard; primary action stays visible"): an iPhone-size viewport shrunk by
 * the keyboard's height with the named field focused, as a viewport shot plus
 * a check that the field and the named primary action are both fully inside
 * the viewport and not covered. The shell's tab bar is hidden for the shot:
 * a real sheet opens above it, whereas a gallery panel sits in the page.
 */
async function captureKeyboard(opts: {
  browsers: Record<Engine, Browser>;
  base: string;
  screen: ScreenSpec;
  role: Role | null;
  outDir: string;
  webkitAvailable: boolean;
}): Promise<CheckRecord | undefined> {
  const { browsers, base, screen, role, outDir, webkitAvailable } = opts;
  if (!screen.keyboard) return undefined;
  const viewport: Viewport = { name: "iphone", width: 390, height: 844 };
  const engine = engineFor(viewport, webkitAvailable);
  const context = await browsers[engine].newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  if (role) await context.addCookies([{ name: "roofy_role", value: role, url: base }]);
  const page = await context.newPage();
  const response = await page
    .goto(new URL(resolveRoute(screen.route), base).toString(), { waitUntil: "networkidle" })
    .catch(() => null);
  if (!response || response.status() === 404) {
    await context.close();
    return undefined;
  }
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);

  const { field: fieldLabel, action: actionName } = screen.keyboard;
  const field = page.getByLabel(fieldLabel, { exact: true }).first();
  await field.scrollIntoViewIfNeeded();
  await field.focus();
  await page.addStyleTag({ content: 'nav[aria-label="Primary"] { display: none !important; }' });
  await page.setViewportSize({ width: viewport.width, height: viewport.height - KEYBOARD_HEIGHT_PX });
  await field.evaluate((el) => {
    el.closest("[data-sheet-panel]")?.scrollIntoView({ block: "center" });
    el.scrollIntoView({ block: "nearest" });
  });
  const action = page.getByRole("button", { name: actionName, exact: true }).first();

  const failures: string[] = [];
  for (const [what, locator] of [
    [`field "${fieldLabel}"`, field],
    [`action "${actionName}"`, action],
  ] as const) {
    const visible = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const inside =
        r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        inside,
        covered: !(top && (top === el || el.contains(top) || top.contains(el))),
        r: `top=${r.top.toFixed(0)} bottom=${r.bottom.toFixed(0)} viewport height=${window.innerHeight}`,
      };
    });
    if (!visible.inside)
      failures.push(`${what} is not fully inside the keyboard-open viewport (${visible.r})`);
    else if (visible.covered) failures.push(`${what} is covered by another element`);
  }

  const fileName = `${screen.id}-keyboard-iphone.png`;
  await page.screenshot({ path: join(outDir, fileName) });
  await context.close();
  return {
    screen: screen.id,
    state: "normal",
    role,
    viewport: "iphone",
    scheme: "light",
    engine,
    file: fileName,
    results: [{ name: "keyboard-open", ok: failures.length === 0, failures }],
  };
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
            if (screen.viewports && !screen.viewports.includes(viewport.name as "iphone" | "android" | "desktop")) continue;
            for (const scheme of screen.lightOnly ? (["light"] as const) : SCHEMES) {
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
      if (screen.noExtras) continue;
      const installedRole: Role | null = screen.roles[0] ?? null;
      for (const landscape of [false, true]) {
        const installed = await captureInstalled({
          browsers,
          base,
          screen,
          outDir,
          webkitAvailable,
          role: installedRole,
          landscape,
        });
        if (installed) records.push(installed);
      }

      // Landscape phone and tablet: the normal state, first role, light only.
      const firstRole: Role | null = screen.roles[0] ?? null;
      if (screen.states.includes("normal") && !screen.desktopOnly) {
        for (const viewport of EXTRA_VIEWPORTS) {
          const result = await captureOne({
            browsers,
            base,
            screen,
            state: "normal",
            role: firstRole,
            viewport,
            scheme: "light",
            outDir,
            webkitAvailable,
          });
          if (result.status === "skipped") skipped.push(result.label);
          else if (result.checkRecord) records.push(result.checkRecord);
        }
        const keyboard = await captureKeyboard({
          browsers,
          base,
          screen,
          role: firstRole,
          outDir,
          webkitAvailable,
        });
        if (keyboard) records.push(keyboard);
      }
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
