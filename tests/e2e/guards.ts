import type { Page } from "@playwright/test";
import { runAxe } from "./axe";
import { contrastRatio } from "../../scripts/check-contrast";

/**
 * Layout/health guards for the design loop (`docs/specs/04-design-process.md`
 * §2 "automated checks"). Every check is a small, independently-callable
 * function that reports rather than throws (`GuardResult`); `expectScreenHealthy`
 * composes them and throws a single aggregated error, which is what regular
 * e2e specs want. `scripts/design-capture.ts` calls `checkScreenHealthy`
 * directly (the non-throwing composition) so a failing screen doesn't abort
 * the whole capture run — it just gets recorded in `checks.json`/`checks.md`.
 *
 * Safe-area contract: the app's layout is expected to pad with something
 * shaped like `padding: max(var(--sat-sim, 0px), env(safe-area-inset-top))`
 * (and the `--sab-sim`/`env(safe-area-inset-bottom)` equivalent for the
 * bottom). `checkSafeAreas` sets `--sat-sim: 47px` and `--sab-sim: 34px` on
 * `:root` — the iPhone notch/home-indicator insets DESIGN.md §8 calls out —
 * and then checks the *rendered* positions of interactive elements against
 * those same 47px/34px margins, regardless of whether the page's CSS
 * actually reads the simulated variables. A layout that ignores safe areas
 * entirely still fails (correctly): nothing wires the padding, so elements
 * sit at their un-padded positions and the guard catches it.
 *
 * Primary-action contract: `checkKeyboard` looks for the screen's one
 * primary action via a `data-primary-action` attribute (any element —
 * usually the Save/Approve/... button). A screen that hasn't adopted the
 * attribute yet just skips that half of the check rather than failing.
 */

export type GuardResult = { name: string; ok: boolean; failures: string[] };

/**
 * `page.evaluate(fn)` serializes `fn` via `Function.prototype.toString()`
 * and re-runs that text as-is inside the page. Run through `tsx` directly
 * (as `scripts/design-capture.ts` does), esbuild's "keep names" transform
 * rewrites any *nested* named function/const inside `fn` to call a
 * module-local `__name(...)` helper that only exists in this Node module,
 * not in the page — so a function with named helpers nested inside it
 * (`collectInteractiveElements`, `collectContrastNodes` below) throws
 * `__name is not defined` when evaluated. This doesn't happen under
 * Playwright's own (SWC-based) test transform, so `tests/e2e/guards.spec.ts`
 * doesn't see it — only `design-capture.ts`'s direct `tsx` run does.
 * Defining a global no-op `__name` in the page before evaluating sidesteps
 * it without changing how the guard functions themselves are written.
 */
async function polyfillEsbuildNameHelper(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown };
    if (!target.__name) target.__name = (fn) => fn;
  });
}

export type ConsoleMessage = { type: "error" | "warning"; text: string };
export type ConsoleCollector = { messages: ConsoleMessage[] };

/**
 * Attaches console/page-error listeners. Call this BEFORE navigation (or
 * `page.setContent`) so nothing fired during load is missed.
 */
export function collectConsole(page: Page): ConsoleCollector {
  const collector: ConsoleCollector = { messages: [] };
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      collector.messages.push({ type, text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    collector.messages.push({ type: "error", text: err.message });
  });
  return collector;
}

// ---------------------------------------------------------------------------
// No horizontal overflow
// ---------------------------------------------------------------------------

export async function checkNoOverflow(page: Page): Promise<GuardResult> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const ok = scrollWidth <= clientWidth;
  return {
    name: "no-horizontal-overflow",
    ok,
    failures: ok ? [] : [`documentElement.scrollWidth (${scrollWidth}px) > clientWidth (${clientWidth}px)`],
  };
}

// ---------------------------------------------------------------------------
// Interactive element collection (shared by touch-target and safe-area checks)
// ---------------------------------------------------------------------------

type RawInteractiveElement = {
  tag: string;
  role: string | null;
  text: string;
  rect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  /**
   * True for an `a` whose parent is a `p` that also has its own non-empty
   * text — an inline text link running inside a paragraph, which DESIGN.md's
   * touch-target rule does not hold to 48x48 (it isn't a standalone tap
   * target the way a button or a full-width row is).
   */
  inlineTextLink: boolean;
  /** Element (or an ancestor) is position: fixed/sticky, so it stays put while the page scrolls. */
  pinned: boolean;
};

/**
 * Runs in the browser (must not close over anything — Playwright serializes
 * it via `toString()`). Selector list matches the guard spec: button,
 * a[href], input, select, textarea, common interactive roles, summary, and
 * label (only when it wraps/targets a form control).
 */
function collectInteractiveElements(): {
  elements: RawInteractiveElement[];
  viewportHeight: number;
} {
  const SELECTOR =
    'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="link"], summary, label';
  const nodes = Array.from(document.querySelectorAll(SELECTOR));
  const elements: RawInteractiveElement[] = [];

  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();

    if (tag === "label") {
      const forId = el.getAttribute("for");
      const forTarget = forId ? document.getElementById(forId) : null;
      const wrapsControl =
        el.querySelector("input, select, textarea") !== null ||
        (forTarget !== null && ["input", "select", "textarea"].includes(forTarget.tagName.toLowerCase()));
      if (!wrapsControl) continue;
      // A label beside a visible control is a supplementary target: the
      // control itself is what has to meet 48x48. Only a label standing in
      // for a visually hidden control (custom checkbox/radio) is checked.
      const control = (forTarget ?? el.querySelector("input, select, textarea")) as HTMLElement | null;
      if (control) {
        const cs = getComputedStyle(control);
        const cr = control.getBoundingClientRect();
        const controlVisible =
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          Number(cs.opacity) > 0 &&
          cr.width > 1 &&
          cr.height > 1;
        if (controlVisible) continue;
      }
    }

    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    let pinned = false;
    for (let a: Element | null = el; a; a = a.parentElement) {
      const pos = getComputedStyle(a).position;
      if (pos === "fixed" || pos === "sticky") {
        pinned = true;
        break;
      }
    }

    let inlineTextLink = false;
    if (tag === "a") {
      const parent = el.parentElement;
      if (parent && parent.tagName.toLowerCase() === "p") {
        const hasOwnText = Array.from(parent.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
        );
        if (hasOwnText) inlineTextLink = true;
      }
    }

    elements.push({
      tag,
      role: el.getAttribute("role"),
      text: (el.textContent ?? "").trim().slice(0, 60),
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      inlineTextLink,
      pinned,
    });
  }

  return { elements, viewportHeight: window.innerHeight };
}

// ---------------------------------------------------------------------------
// Touch targets (phone only)
// ---------------------------------------------------------------------------

const MIN_TARGET_PX = 48;

export async function checkTouchTargets(page: Page, opts: { phone: boolean }): Promise<GuardResult> {
  if (!opts.phone) return { name: "touch-targets", ok: true, failures: [] };

  await polyfillEsbuildNameHelper(page);
  const { elements } = await page.evaluate(collectInteractiveElements);
  const failures: string[] = [];
  for (const el of elements) {
    if (el.inlineTextLink) continue;
    if (el.rect.width < MIN_TARGET_PX || el.rect.height < MIN_TARGET_PX) {
      const label = el.role ? `${el.tag}[role="${el.role}"]` : el.tag;
      failures.push(
        `<${label}> "${el.text}" is ${el.rect.width.toFixed(0)}x${el.rect.height.toFixed(0)}px (needs >= ${MIN_TARGET_PX}x${MIN_TARGET_PX})`,
      );
    }
  }
  return { name: "touch-targets", ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// axe-core (serious/critical only — the shared WCAG-scoped helper)
// ---------------------------------------------------------------------------

export async function checkAxe(page: Page): Promise<GuardResult> {
  const results = await runAxe(page);
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const failures = serious.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`);
  return { name: "axe-serious-critical", ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Console: zero errors/warnings since navigation, with an allowlist for
// known third-party noise (empty by default).
// ---------------------------------------------------------------------------

export function checkConsole(collector: ConsoleCollector, opts: { allowlist?: RegExp[] } = {}): GuardResult {
  const allowlist = opts.allowlist ?? [];
  const unexpected = collector.messages.filter((m) => !allowlist.some((re) => re.test(m.text)));
  return {
    name: "console-clean",
    ok: unexpected.length === 0,
    failures: unexpected.map((m) => `console.${m.type}: ${m.text}`),
  };
}

// ---------------------------------------------------------------------------
// DOM contrast: every visible text node against its effective background.
// ---------------------------------------------------------------------------

type RawContrastNode = {
  color: [number, number, number];
  bg: [number, number, number];
  fontSize: number;
  fontWeight: number;
  text: string;
};

/** Runs in the browser; must not close over anything. */
function collectContrastNodes(): RawContrastNode[] {
  function parseRgb(value: string): [number, number, number, number] | null {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (!m) return null;
    const parts = m[1]!.split(",").map((s) => Number.parseFloat(s.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts.length > 3 ? (parts[3] ?? 1) : 1];
  }

  function effectiveBackground(
    start: Element,
  ): { kind: "image" } | { kind: "color"; rgb: [number, number, number] } {
    let node: Element | null = start;
    while (node) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") return { kind: "image" };
      const parsed = parseRgb(style.backgroundColor);
      if (parsed && parsed[3] > 0) return { kind: "color", rgb: [parsed[0], parsed[1], parsed[2]] };
      node = node.parentElement;
    }
    return { kind: "color", rgb: [255, 255, 255] };
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out: RawContrastNode[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    if (!text.trim()) continue;
    const parent = node.parentElement;
    if (!parent) continue;

    const style = getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    // Rough visibility check (misses position:fixed elements without an
    // offsetParent, hence the explicit carve-out).
    if (parent.offsetParent === null && style.position !== "fixed") continue;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const colorParsed = parseRgb(style.color);
    if (!colorParsed) continue;

    const bg = effectiveBackground(parent);
    if (bg.kind === "image") continue; // skip text over images

    out.push({
      color: [colorParsed[0], colorParsed[1], colorParsed[2]],
      bg: bg.rgb,
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
      text: text.trim().slice(0, 40),
    });
  }
  return out;
}

function channelsToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const LARGE_TEXT_PX = 24;
const LARGE_BOLD_TEXT_PX = 18.66;
const BOLD_WEIGHT = 700;
const MAX_CONTRAST_FAILURES_LISTED = 20;

export async function checkContrast(page: Page): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const nodes = await page.evaluate(collectContrastNodes);
  const seen = new Set<string>();
  const failures: string[] = [];

  for (const n of nodes) {
    const ratio = contrastRatio(channelsToHex(n.color), channelsToHex(n.bg));
    const isLarge =
      n.fontSize >= LARGE_TEXT_PX || (n.fontWeight >= BOLD_WEIGHT && n.fontSize >= LARGE_BOLD_TEXT_PX);
    const threshold = isLarge ? 3.0 : 4.5;
    if (ratio < threshold) {
      const key = `${n.text}|${ratio.toFixed(2)}|${threshold}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push(
        `"${n.text}" ${ratio.toFixed(2)}:1 < ${threshold.toFixed(1)}:1 required (font-size ${n.fontSize}px, weight ${n.fontWeight})`,
      );
    }
  }

  const listed =
    failures.length > MAX_CONTRAST_FAILURES_LISTED
      ? [
          ...failures.slice(0, MAX_CONTRAST_FAILURES_LISTED),
          `... and ${failures.length - MAX_CONTRAST_FAILURES_LISTED} more`,
        ]
      : failures;
  return { name: "dom-contrast", ok: failures.length === 0, failures: listed };
}

// ---------------------------------------------------------------------------
// Safe areas: nothing interactive under the simulated iPhone insets.
// ---------------------------------------------------------------------------

const SAFE_AREA_TOP_PX = 47;
const SAFE_AREA_BOTTOM_PX = 34;

export async function checkSafeAreas(page: Page): Promise<GuardResult> {
  await page.evaluate(
    ([top, bottom]) => {
      document.documentElement.style.setProperty("--sat-sim", `${top}px`);
      document.documentElement.style.setProperty("--sab-sim", `${bottom}px`);
    },
    [SAFE_AREA_TOP_PX, SAFE_AREA_BOTTOM_PX],
  );

  // Scrolling content can always be scrolled out from under an inset, except
  // at the very top of the page (top inset) and the very bottom (bottom
  // inset). Pinned (fixed/sticky) elements never move, so they must clear
  // both insets at every scroll position.
  await polyfillEsbuildNameHelper(page);
  const failures: string[] = [];
  const scrollTo = (y: number) => page.evaluate((top) => window.scrollTo(0, top), y);
  const describe = (el: RawInteractiveElement) => `<${el.tag}> "${el.text}"`;

  await scrollTo(0);
  const atTop = await page.evaluate(collectInteractiveElements);
  for (const el of atTop.elements) {
    if (el.rect.bottom > 0 && el.rect.top < SAFE_AREA_TOP_PX) {
      failures.push(
        `${describe(el)} top ${el.rect.top.toFixed(0)}px is within the ${SAFE_AREA_TOP_PX}px top safe-area inset`,
      );
    }
    if (
      el.pinned &&
      el.rect.top < atTop.viewportHeight &&
      el.rect.bottom > atTop.viewportHeight - SAFE_AREA_BOTTOM_PX
    ) {
      failures.push(
        `${describe(el)} (pinned) bottom ${el.rect.bottom.toFixed(0)}px is within the ${SAFE_AREA_BOTTOM_PX}px bottom safe-area inset`,
      );
    }
  }

  await scrollTo(1e9);
  const atBottom = await page.evaluate(collectInteractiveElements);
  for (const el of atBottom.elements) {
    if (el.pinned) continue;
    const vh = atBottom.viewportHeight;
    if (el.rect.top < vh && el.rect.bottom > vh - SAFE_AREA_BOTTOM_PX) {
      failures.push(
        `${describe(el)} bottom ${el.rect.bottom.toFixed(0)}px (scrolled to the end) is within the ${SAFE_AREA_BOTTOM_PX}px bottom safe-area inset`,
      );
    }
  }
  await scrollTo(0);
  return { name: "safe-area-insets", ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// On-screen keyboard: focusing the first text input must not leave the
// input, or the page's primary action, hidden or covered once the
// keyboard's vertical space is gone (04-design-process.md §2 step 4:
// "nothing hidden under safe areas or the keyboard, checked with an
// on-screen-keyboard viewport").
// ---------------------------------------------------------------------------

/** Height the on-screen keyboard takes off a phone viewport (also used by design-capture's keyboard-open shot). */
export const KEYBOARD_HEIGHT_PX = 336;
const PRIMARY_ACTION_SELECTOR = "[data-primary-action]";
const TEXT_INPUT_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="password"], input[type="search"], input[type="url"], input:not([type]), textarea';

/** Runs in the browser; must not close over anything. Focuses the first visible, enabled match. */
function focusFirstTextInput(selector: string): boolean {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
  for (const el of candidates) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if ("disabled" in el && (el as unknown as { disabled: boolean }).disabled) continue;
    el.focus();
    return document.activeElement === el;
  }
  return false;
}

type KeyboardAssessment = {
  hasFocus: boolean;
  inputVisible: boolean;
  inputDebug: string;
  primaryFound: boolean;
  primaryVisible: boolean;
  primaryDebug: string;
};

/** Runs in the browser, after the viewport has been shrunk; must not close over anything. */
function assessKeyboardOcclusion(primarySelector: string): KeyboardAssessment {
  function describe(el: Element): string {
    const id = el.id ? `#${el.id}` : "";
    return `<${el.tagName.toLowerCase()}${id}>`;
  }

  function checkVisible(el: Element): { visible: boolean; debug: string } {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const withinViewport =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= vh &&
      rect.right <= vw &&
      rect.width > 0 &&
      rect.height > 0;
    const cx = Math.min(Math.max(rect.left + rect.width / 2, 0), Math.max(vw - 1, 0));
    const cy = Math.min(Math.max(rect.top + rect.height / 2, 0), Math.max(vh - 1, 0));
    const topEl = document.elementFromPoint(cx, cy);
    const notOccluded = topEl !== null && (topEl === el || el.contains(topEl) || topEl.contains(el));
    return {
      visible: withinViewport && notOccluded,
      debug: `${describe(el)} rect top=${rect.top.toFixed(0)} bottom=${rect.bottom.toFixed(0)} left=${rect.left.toFixed(0)} right=${rect.right.toFixed(0)} viewport=${vw}x${vh} topmost-element-at-center=${topEl ? describe(topEl) : "none"}`,
    };
  }

  const active = document.activeElement;
  const hasFocus = active !== null && active !== document.body;
  let inputVisible = false;
  let inputDebug = "no element focused";
  if (hasFocus && active) {
    const r = checkVisible(active);
    inputVisible = r.visible;
    inputDebug = r.debug;
  }

  const primary = document.querySelector(primarySelector);
  let primaryFound = false;
  let primaryVisible = false;
  let primaryDebug = "no [data-primary-action] element on the page";
  if (primary) {
    primaryFound = true;
    const r = checkVisible(primary);
    primaryVisible = r.visible;
    primaryDebug = r.debug;
  }

  return { hasFocus, inputVisible, inputDebug, primaryFound, primaryVisible, primaryDebug };
}

export async function checkKeyboard(page: Page, opts: { phone: boolean }): Promise<GuardResult> {
  if (!opts.phone) return { name: "keyboard", ok: true, failures: [] };

  const viewport = page.viewportSize();
  if (!viewport) return { name: "keyboard", ok: true, failures: [] };

  await polyfillEsbuildNameHelper(page);
  const focused = await page.evaluate(focusFirstTextInput, TEXT_INPUT_SELECTOR);
  if (!focused) {
    // No text/number input on this screen (e.g. a read-only list) — nothing
    // for the keyboard to push around.
    return { name: "keyboard", ok: true, failures: [] };
  }

  const reducedHeight = Math.max(viewport.height - KEYBOARD_HEIGHT_PX, 1);
  await page.setViewportSize({ width: viewport.width, height: reducedHeight });

  let assessment: KeyboardAssessment;
  try {
    assessment = await page.evaluate(assessKeyboardOcclusion, PRIMARY_ACTION_SELECTOR);
  } finally {
    await page.setViewportSize(viewport);
  }

  const failures: string[] = [];
  if (!assessment.hasFocus) {
    failures.push("focus was lost when the viewport shrank to simulate the on-screen keyboard");
  } else if (!assessment.inputVisible) {
    failures.push(
      `the focused input is off-viewport or covered once the keyboard opens: ${assessment.inputDebug}`,
    );
  }
  if (assessment.primaryFound && !assessment.primaryVisible) {
    failures.push(
      `the primary action ([data-primary-action]) is off-viewport or covered once the keyboard opens: ${assessment.primaryDebug}`,
    );
  }

  return { name: "keyboard", ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// 200% text zoom: no new horizontal overflow.
//
// src/app/globals.css's type scale utilities are rem-based (docs/design/loop/
// DECISIONS.md, "Type scale moved to rem"), so `html { font-size: 200% }`
// actually doubles their rendered size, and this guard's overflow check is
// exercising real type growth, not just layout that happens to be wide.
// ---------------------------------------------------------------------------

export async function checkTextZoom(page: Page): Promise<GuardResult> {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const overflow = await checkNoOverflow(page);
  return {
    name: "text-zoom-200",
    ok: overflow.ok,
    failures: overflow.failures.map((f) => `at 200% text zoom: ${f}`),
  };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export type ScreenHealthOptions = {
  /** Whether target-size (48x48) is enforced; phone viewports only. */
  phone: boolean;
  /** From `collectConsole(page)`, attached before navigation. Omit to skip the console check. */
  console?: ConsoleCollector;
  /** Known third-party console noise to ignore. Empty by default. */
  consoleAllowlist?: RegExp[];
  /** Skip individual checks (design-capture uses this for states that don't apply, e.g. no need to re-check axe on every scheme). */
  skip?: Partial<
    Record<
      "overflow" | "touchTargets" | "axe" | "console" | "contrast" | "safeAreas" | "keyboard" | "textZoom",
      boolean
    >
  >;
};

/**
 * Runs every guard and returns each result without throwing. Order matters:
 * `checkKeyboard` temporarily resizes the viewport (restored before it
 * returns) and `checkTextZoom` permanently mutates the page (injects a style
 * tag) — both run after the checks that depend on the page's original,
 * unzoomed layout.
 */
export async function checkScreenHealthy(page: Page, opts: ScreenHealthOptions): Promise<GuardResult[]> {
  const skip = opts.skip ?? {};
  const results: GuardResult[] = [];

  if (!skip.overflow) results.push(await checkNoOverflow(page));
  if (!skip.touchTargets) results.push(await checkTouchTargets(page, { phone: opts.phone }));
  if (!skip.axe) results.push(await checkAxe(page));
  if (!skip.console && opts.console) {
    results.push(checkConsole(opts.console, { allowlist: opts.consoleAllowlist }));
  }
  if (!skip.contrast) results.push(await checkContrast(page));
  if (!skip.safeAreas) results.push(await checkSafeAreas(page));
  if (!skip.keyboard) results.push(await checkKeyboard(page, { phone: opts.phone }));
  if (!skip.textZoom) results.push(await checkTextZoom(page));

  return results;
}

/** Throwing variant for ordinary e2e specs: fails fast with every guard's failures listed. */
export async function expectScreenHealthy(page: Page, opts: ScreenHealthOptions): Promise<void> {
  const results = await checkScreenHealthy(page, opts);
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return;

  const message = failed.map((r) => `[${r.name}]\n  ${r.failures.join("\n  ")}`).join("\n\n");
  throw new Error(`expectScreenHealthy: ${failed.length} guard(s) failed:\n\n${message}`);
}
