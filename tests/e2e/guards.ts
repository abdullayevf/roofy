import type { Locator, Page } from "@playwright/test";
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
  /**
   * The part of the box a person can see and touch: the rect cut down to every scrolling or clipping ancestor
   * between it and the page (a sheet's scrolling body, a card with `overflow: hidden`). A scrolled-out field of a
   * pinned sheet still has a rect under the bottom edge, but the body clips it above the pinned action, so it is
   * not under the home indicator. `visibleBottom <= visibleTop` means it is clipped away entirely.
   */
  visibleTop: number;
  visibleBottom: number;
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

    // Cut the box down to each clipping ancestor below the page (the page's own scroll is what the guards scroll).
    let visibleTop = rect.top;
    let visibleBottom = rect.bottom;
    for (let a: Element | null = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowY)) {
        const ar = a.getBoundingClientRect();
        visibleTop = Math.max(visibleTop, ar.top);
        visibleBottom = Math.min(visibleBottom, ar.bottom);
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
      visibleTop,
      visibleBottom,
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
// Foreman money: a foreman-role capture must show no dollar amount at all.
// ---------------------------------------------------------------------------

/** Fails when the page's visible text has a dollar amount ("$775", "$1,200.00"). Run it on every foreman-role capture. */
export async function checkNoMoney(page: Page): Promise<GuardResult> {
  const text = await page.locator("body").innerText();
  const found = text.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) ?? [];
  return {
    name: "foreman-no-money",
    ok: found.length === 0,
    failures: found.map((m) => `foreman-facing page shows an amount: ${m}`),
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
    // A control a scrolling body clips away entirely is not on the screen, so it is not under an inset either.
    if (el.visibleBottom <= el.visibleTop) continue;
    if (el.visibleBottom > 0 && el.visibleTop < SAFE_AREA_TOP_PX) {
      failures.push(
        `${describe(el)} top ${el.rect.top.toFixed(0)}px is within the ${SAFE_AREA_TOP_PX}px top safe-area inset`,
      );
    }
    if (
      el.pinned &&
      el.visibleTop < atTop.viewportHeight &&
      el.visibleBottom > atTop.viewportHeight - SAFE_AREA_BOTTOM_PX
    ) {
      failures.push(
        `${describe(el)} (pinned) bottom ${el.rect.bottom.toFixed(0)}px is within the ${SAFE_AREA_BOTTOM_PX}px bottom safe-area inset`,
      );
    }
  }

  await scrollTo(1e9);
  const atBottom = await page.evaluate(collectInteractiveElements);
  for (const el of atBottom.elements) {
    if (el.pinned || el.visibleBottom <= el.visibleTop) continue;
    const vh = atBottom.viewportHeight;
    if (el.visibleTop < vh && el.visibleBottom > vh - SAFE_AREA_BOTTOM_PX) {
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
// Pinned action bar
/** At most one primary button or link showing on the screen (design loop jobs-2 F1: no two solid buttons side by side). */
export async function checkOnePrimary(page: Page): Promise<GuardResult> {
  const names = await page.locator('[data-variant="primary"]:visible').allInnerTexts();
  const ok = names.length <= 1;
  return {
    name: "one-primary",
    ok,
    failures: ok ? [] : [`${names.length} primary buttons: ${names.map((n) => n.trim()).join(", ")}`],
  };
}

/** On a phone, the screen's one primary action sits in the bottom third of the viewport, in thumb reach (jobs-2 D1/F7). */
export async function checkPrimaryInBottomThird(page: Page): Promise<GuardResult> {
  const viewport = page.viewportSize();
  const box = await page.locator('[data-variant="primary"]:visible').first().boundingBox();
  if (!viewport || !box)
    return { name: "primary-in-thumb-reach", ok: false, failures: ["no visible primary button"] };
  const centre = box.y + box.height / 2;
  const ok = centre >= (viewport.height * 2) / 3 && box.y + box.height <= viewport.height;
  return {
    name: "primary-in-thumb-reach",
    ok,
    failures: ok
      ? []
      : [
          `primary button centre at ${Math.round(centre)} px; the bottom third starts at ${Math.round((viewport.height * 2) / 3)} px`,
        ],
  };
}

/**
 * Scrolled to the bottom, the page's last content ends above the pinned bar: the page pads by the bar's height
 * (jobs-2 F16: done stage, installed, phone on its side).
 */
export async function checkContentClearsPinnedBar(page: Page): Promise<GuardResult> {
  const name = "content-clears-pinned-bar";
  const bar = page.locator('[data-slot="primary-action"]:visible').first();
  if ((await bar.count()) === 0) return { name, ok: true, failures: [] };
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const barBox = await bar.boundingBox();
  const lastBottom = await page.evaluate(() => {
    const screen = document.querySelector("[data-screen]");
    if (!screen) return null;
    let bottom = 0;
    for (const el of Array.from(screen.querySelectorAll("li, p, h2, section > *"))) {
      if (el.closest('[data-slot="primary-action"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0) bottom = Math.max(bottom, r.bottom);
    }
    return bottom;
  });
  if (!barBox || lastBottom === null) return { name, ok: true, failures: [] };
  const ok = lastBottom <= barBox.y + 1;
  return {
    name,
    ok,
    failures: ok
      ? []
      : [
          `last content ends at ${Math.round(lastBottom)} px; the pinned bar starts at ${Math.round(barBox.y)} px`,
        ],
  };
}

/**
 * On a phone, no button in the pinned bar sits under the raised Log circle (the circle overhangs the bar; a phone on
 * its side puts the bar's buttons in one row either side of it). jobs-2 D1/F7.
 */
export async function checkBarClearsLogCircle(page: Page): Promise<GuardResult> {
  const circle = await page.locator("nav .rounded-full.bg-chalk").first().boundingBox();
  if (!circle) return { name: "bar-clears-log-circle", ok: true, failures: [] };
  const failures: string[] = [];
  for (const el of await page
    .locator(".pin-action > button:visible, .pin-action > a:visible, .pin-action > [data-variant]:visible")
    .all()) {
    const b = await el.boundingBox();
    if (!b) continue;
    const overlaps =
      b.x < circle.x + circle.width &&
      b.x + b.width > circle.x &&
      b.y < circle.y + circle.height &&
      b.y + b.height > circle.y;
    if (overlaps)
      failures.push(
        `"${(await el.innerText()).trim()}" (x ${Math.round(b.x)} to ${Math.round(b.x + b.width)}) is under the Log circle (x ${Math.round(circle.x)} to ${Math.round(circle.x + circle.width)})`,
      );
  }
  return { name: "bar-clears-log-circle", ok: failures.length === 0, failures };
}

/**
 * The screen's primary action is where a hand or eye finds it first (pay iter1 D4/F5). From 1024 px it is inside the
 * first viewport without scrolling (in the title row). Below that the pinned bar sits on top of the tab bar, never
 * under it, and is the same at the top of the page as at the bottom.
 */
export async function checkPrimaryActionPlacement(page: Page): Promise<GuardResult> {
  const name = "primary-action-placement";
  const viewport = page.viewportSize();
  const primary = page.locator('[data-slot="primary-action"] [data-variant="primary"]:visible').first();
  if (!viewport || (await primary.count()) === 0) return { name, ok: true, failures: [] };
  const failures: string[] = [];
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  const box = await primary.boundingBox();
  if (box && (box.y < 0 || box.y + box.height > viewport.height))
    failures.push(`primary "${(await primary.innerText()).trim()}" spans ${Math.round(box.y)} to ${Math.round(box.y + box.height)} px; the first viewport ends at ${viewport.height} px`);
  if (viewport.width < 1024) {
    const tabTop = await page.evaluate(() => {
      const navs = Array.from(document.querySelectorAll("nav")).filter((n) => getComputedStyle(n).position === "fixed");
      const tops = navs.map((n) => n.getBoundingClientRect()).filter((r) => r.height > 0 && r.bottom >= window.innerHeight - 2);
      return tops.length ? Math.min(...tops.map((r) => r.top)) : null;
    });
    const bar = await page.locator('[data-slot="primary-action"]:visible').first().boundingBox();
    if (bar && tabTop !== null && bar.y + bar.height > tabTop + 1)
      failures.push(`the pinned bar ends at ${Math.round(bar.y + bar.height)} px, under the tab bar (top ${Math.round(tabTop)} px)`);
  }
  return { name, ok: failures.length === 0, failures };
}

/**
 * An open toast on a phone sits above the tab bar, the Log circle's lift and any pinned bar, never over them
 * (entry-settings i1 D6 + F9). Open the toast first (save, then call this straight away; a toast lasts 4 s).
 */
export async function checkToastClearsBars(page: Page): Promise<GuardResult> {
  const name = "toast-clears-bars";
  const toast = page.locator('li[data-state="open"]').filter({ hasText: /\S/ }).first();
  if ((await toast.count()) === 0) return { name, ok: false, failures: ["no open toast to measure"] };
  const failures = await page.evaluate(() => {
    const li = document.querySelector('li[data-state="open"]');
    if (!li) return ["the toast closed before it was measured"];
    const toastBox = li.getBoundingClientRect();
    const out: string[] = [];
    const tops: { what: string; top: number }[] = [];
    for (const nav of Array.from(document.querySelectorAll("nav"))) {
      const r = nav.getBoundingClientRect();
      if (getComputedStyle(nav).position === "fixed" && r.height > 0 && r.bottom >= window.innerHeight - 2) tops.push({ what: "the tab bar", top: r.top });
    }
    const circle = document.querySelector("nav .rounded-full.bg-chalk");
    if (circle && circle.getBoundingClientRect().height > 0) tops.push({ what: "the Log circle", top: circle.getBoundingClientRect().top });
    for (const bar of Array.from(document.querySelectorAll('[data-slot="primary-action"]'))) {
      const r = bar.getBoundingClientRect();
      if (getComputedStyle(bar).position === "fixed" && r.height > 0) tops.push({ what: "the pinned bar", top: r.top });
    }
    for (const t of tops)
      if (window.innerWidth < 1024 && toastBox.bottom > t.top + 0.5)
        out.push(`the toast ends at ${Math.round(toastBox.bottom)} px, over ${t.what} (top ${Math.round(t.top)} px)`);
    return out;
  });
  return { name, ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * Date inputs read dd/mm/yyyy on every browser, not just the iPhone shot (i1-D14/F9, T13 i3-F1). A date input's
 * value is always yyyy-mm-dd; what the person sees is the browser's field order. Chromium shows it in the
 * accessibility tree (Day, Month, Year spinbuttons), so read the order there; other engines are held to the
 * en-AU document language and clock instead. Passes when the page has no date input.
 */
export async function checkDateFields(page: Page): Promise<GuardResult> {
  const failures: string[] = [];
  const count = await page.locator('input[type="date"]:visible').count();
  if (count > 0) {
    const env = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      today: new Date(2026, 8, 28).toLocaleDateString(),
    }));
    if (env.lang !== "en-AU") failures.push(`<html lang> is "${env.lang}", not en-AU`);
    if (env.today !== "28/09/2026")
      failures.push(`the browser writes 28 Sep 2026 as ${env.today}, not 28/09/2026`);
    if (page.context().browser()?.browserType().name() === "chromium") {
      const cdp = await page.context().newCDPSession(page);
      try {
        const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
          nodes: { role?: { value?: string }; name?: { value?: string } }[];
        };
        // Chromium's accessible name repeats the part ("Day Day"), so read the leading word.
        const part = (n: (typeof nodes)[number]) => /^(Day|Month|Year)\b/.exec(n.name?.value ?? "")?.[1];
        const order = nodes.filter((n) => n.role?.value === "spinbutton" && part(n)).map((n) => part(n)!);
        // Each date input contributes Day, Month, Year in the order the browser draws them.
        for (let i = 0; i + 2 < order.length; i += 3) {
          const shown = order.slice(i, i + 3).join("/");
          if (shown !== "Day/Month/Year")
            failures.push(`date input ${i / 3 + 1} is ${shown}, not Day/Month/Year`);
        }
        if (order.length === 0) failures.push("no date field parts in the accessibility tree");
      } finally {
        await cdp.detach();
      }
    }
  }
  return { name: "dateFields", ok: failures.length === 0, failures };
}

/**
 * Lesson 20: a screen that needs a connection says "Needs connection" once; it never also shows the offline banner
 * promising entries "will send automatically". Both visible on one screen is a contradiction.
 */
export async function checkOfflineAgrees(page: Page): Promise<GuardResult> {
  const both = await page.evaluate(() => {
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    };
    const texts = [...document.querySelectorAll("body *")].filter(
      (el) => el.children.length === 0 && el.textContent && shown(el),
    );
    const banner = texts.some((el) => /will send automatically/i.test(el.textContent ?? ""));
    const needs = texts.some((el) => /needs connection/i.test(el.textContent ?? ""));
    return banner && needs;
  });
  const failures = both
    ? ['offline banner ("will send automatically") and "Needs connection" are both visible']
    : [];
  return { name: "offlineAgrees", ok: failures.length === 0, failures };
}

/**
 * Lesson 24: the options of a segmented control are one row, or all stacked; never a partial wrap (a lone option on a
 * second row with a stray divider). Opt-in: the expense form specs call it on iPhone and Android.
 */
export async function checkSegmentedRows(page: Page): Promise<GuardResult> {
  const failures = await page.evaluate(() => {
    const out: string[] = [];
    for (const group of document.querySelectorAll("[data-segmented]")) {
      const rects = [...group.querySelectorAll(":scope > label")].map((l) => l.getBoundingClientRect());
      const first = rects[0];
      if (!first || rects.length < 2 || first.width === 0) continue;
      const oneRow = rects.every((r) => Math.abs(r.top - first.top) <= 1);
      const stacked = rects.every((r, i) => i === 0 || r.top >= (rects[i - 1]?.bottom ?? 0) - 1);
      if (!oneRow && !stacked)
        out.push(`${group.getAttribute("aria-label")}: options wrap onto a partial second row`);
    }
    return out;
  });
  return { name: "segmentedRows", ok: failures.length === 0, failures };
}

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
      | "overflow"
      | "touchTargets"
      | "axe"
      | "console"
      | "contrast"
      | "safeAreas"
      | "keyboard"
      | "textZoom"
      | "dateFields"
      | "offlineAgrees",
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
  if (!skip.dateFields) results.push(await checkDateFields(page));
  if (!skip.offlineAgrees) results.push(await checkOfflineAgrees(page));
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

/**
 * Waits until React has attached to every text box, select and text area on the page (F2). Call it after every
 * `goto` and in-flow navigation before a fill: before hydration a box is read-only, and a value set into a box React
 * has not reached yet never gets to the form's state.
 */
export async function waitForHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const controls = [
      ...document.querySelectorAll("input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea"),
    ];
    return controls.every((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$")));
  });
}

/**
 * Waits until a sliding sheet or dialog has stopped: its box is the same for five frames running. `toBeVisible` is true
 * the moment the sheet starts to slide in, so a position read straight after it can come from mid-slide.
 */
export async function expectStill(target: Locator, timeout = 5000): Promise<void> {
  await target.evaluate(
    (el, ms) =>
      new Promise<void>((resolve, reject) => {
        const started = performance.now();
        let last = "";
        let same = 0;
        const frame = () => {
          const r = el.getBoundingClientRect();
          const now = `${r.x},${r.y},${r.width},${r.height}`;
          same = now === last ? same + 1 : 0;
          last = now;
          if (same >= 5) resolve();
          else if (performance.now() - started > ms)
            reject(new Error(`still moving after ${ms} ms (${now})`));
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    timeout,
  );
}

// ---------------------------------------------------------------------------
// Text never touches the edge of the box it sits in; a Back row is a real target
// ---------------------------------------------------------------------------

/**
 * In every visible table, the text of each last cell ends at least `minGap` px inside the nearest bordered box around it
 * (the grouped surface), so a figure never sits against the outline.
 */
export async function checkTableEdgeGap(page: Page, minGap = 16): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((min) => {
    const out: string[] = [];
    for (const cell of Array.from(document.querySelectorAll("tr > td:last-child"))) {
      const cellRect = cell.getBoundingClientRect();
      if (cellRect.width === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(cell);
      let right = 0;
      for (const r of Array.from(range.getClientRects())) if (r.width > 0) right = Math.max(right, r.right);
      let box: Element | null = cell.parentElement;
      while (
        box &&
        !(
          parseFloat(getComputedStyle(box).borderRightWidth) > 0 &&
          box.tagName !== "TR" &&
          box.tagName !== "TD"
        )
      )
        box = box.parentElement;
      const edge = box
        ? box.getBoundingClientRect().right - parseFloat(getComputedStyle(box).borderRightWidth)
        : cellRect.right;
      if (right > 0 && edge - right < min - 0.5)
        out.push(
          `"${(cell.textContent ?? "").trim().slice(0, 30)}" ends ${(edge - right).toFixed(1)}px from the border (needs >= ${min})`,
        );
    }
    return out;
  }, minGap);
  return { name: "table-edge-gap", ok: failures.length === 0, failures };
}

/**
 * In every visible table, each header cell's text starts and ends where its column's body text does (left-aligned columns
 * share a left edge, right-aligned ones a right edge), and the last column's text ends at least `minGap` px inside the border.
 */
export async function checkTableHeaderAlign(page: Page, minGap = 16): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((min) => {
    const out: string[] = [];
    const textBox = (cell: Element) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      let left = Infinity;
      let right = 0;
      for (const r of Array.from(range.getClientRects())) {
        if (r.width <= 0) continue;
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
      }
      return { left, right };
    };
    for (const table of Array.from(document.querySelectorAll("table"))) {
      if (table.getBoundingClientRect().width === 0) continue;
      const heads = Array.from(table.querySelectorAll("thead th"));
      const row = table.querySelector("tbody tr");
      if (!row) continue;
      const cells = Array.from(row.children);
      heads.forEach((th, i) => {
        const td = cells[i];
        if (!td) return;
        const h = textBox(th);
        const b = textBox(td);
        const rightAligned =
          getComputedStyle(th).textAlign === "right" || getComputedStyle(th).textAlign === "end";
        const name = (th.textContent ?? "").trim();
        if (rightAligned && Math.abs(h.right - b.right) > 1)
          out.push(`"${name}" header ends ${h.right.toFixed(1)} but its cells end ${b.right.toFixed(1)}`);
        if (!rightAligned && Math.abs(h.left - b.left) > 1)
          out.push(`"${name}" header starts ${h.left.toFixed(1)} but its cells start ${b.left.toFixed(1)}`);
        if (i === heads.length - 1) {
          const edge = table.getBoundingClientRect().right;
          if (edge - h.right < min - 0.5)
            out.push(
              `"${name}" header ends ${(edge - h.right).toFixed(1)}px from the table edge (needs >= ${min})`,
            );
        }
      });
    }
    return out;
  }, minGap);
  return { name: "table-header-align", ok: failures.length === 0, failures };
}

/** The Back row is a 48 px target on a phone (it is a text link, which the general touch-target check skips). */
export async function checkBackRow(page: Page): Promise<GuardResult> {
  const back = page.getByRole("link", { name: /^Back to / }).first();
  const box = await back.boundingBox();
  const failures = !box
    ? ["no Back row found"]
    : box.height < 48
      ? [`Back row is ${box.height.toFixed(0)}px tall (needs >= 48)`]
      : [];
  return { name: "back-row", ok: failures.length === 0, failures };
}

/** Every body row of every visible table is at least `min` px tall (a 48 px row is a touch target; lesson: rows are not 30 px slivers). */
export async function checkTableRowHeight(page: Page, min = 48): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((least) => {
    const out: string[] = [];
    for (const tr of Array.from(document.querySelectorAll("table tbody tr"))) {
      const h = tr.getBoundingClientRect().height;
      if (h > 0 && h < least - 0.5)
        out.push(
          `"${(tr.textContent ?? "").trim().slice(0, 30)}" row is ${h.toFixed(1)}px tall (needs >= ${least})`,
        );
    }
    return out;
  }, min);
  return { name: "table-row-height", ok: failures.length === 0, failures };
}

/**
 * Every money value inside `scope` (a leaf element whose whole text is a dollar amount, or "−$" for a credit) is set in the
 * figure font (Barlow, DESIGN.md `figure`), never the body font in bold.
 */
export async function checkMoneyFigureFont(page: Page, scope: string): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((sel) => {
    const first = (v: string) => (v.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
    const barlow = first(getComputedStyle(document.documentElement).getPropertyValue("--font-barlow"));
    const out: string[] = [];
    let seen = 0;
    for (const el of Array.from(document.querySelectorAll(`${sel} *`))) {
      if (el.children.length > 0 || !/^[−-]?\$[\d,]+\.\d{2}$/.test((el.textContent ?? "").trim())) continue;
      if (el.getBoundingClientRect().width === 0) continue;
      seen += 1;
      const family = first(getComputedStyle(el).fontFamily);
      if (family !== barlow)
        out.push(`"${(el.textContent ?? "").trim()}" is set in ${family}, not the figure font ${barlow}`);
    }
    if (seen === 0) out.push(`no money value found in ${sel}`);
    return out;
  }, scope);
  return { name: "money-figure-font", ok: failures.length === 0, failures };
}

/**
 * Lesson 23 (pay/i1-D7+F6): a date such as "Mon 21 Sep" never breaks across two lines. Every visible `scope` element's
 * dates are joined with non-breaking spaces (no plain-space date left) and each date sits on one line box.
 */
export async function checkDatesStayWhole(page: Page, scope: string): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((sel) => {
    const out: string[] = [];
    let seen = 0;
    const WHOLE = /[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}(?: \d{4})?/g;
    const SPLIT = /[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/;
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (el.getBoundingClientRect().width === 0) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        if (SPLIT.test(text)) out.push(`"${text.trim()}" has a date with plain spaces`);
        for (const m of text.matchAll(WHOLE)) {
          seen += 1;
          const range = document.createRange();
          range.setStart(node, m.index ?? 0);
          range.setEnd(node, (m.index ?? 0) + m[0].length);
          if (range.getClientRects().length > 1) out.push(`"${m[0].replace(/ /g, " ")}" breaks across two lines`);
        }
      }
    }
    if (seen === 0) out.push(`no date found in ${sel}`);
    return out;
  }, scope);
  return { name: "dates-stay-whole", ok: failures.length === 0, failures };
}

/**
 * Pay iter2 N1: the run totals read as a sum. The top-level rows (`[data-pay-sum=row]`) add up to Total, in cents;
 * GST and reimbursements are "Includes" lines (`[data-pay-sum=includes]`) and are not added again.
 */
export async function checkRunTotalsSum(page: Page, scope = "[data-pay-run-totals]"): Promise<GuardResult> {
  const cents = (t: string) => {
    const m = t.match(/(-?)\$([\d,]+)\.(\d{2})/);
    return m ? (m[1] ? -1 : 1) * (Number(m[2]!.replace(/,/g, "")) * 100 + Number(m[3])) : NaN;
  };
  const rows = await page.locator(`${scope} [data-pay-sum=row]`).allInnerTexts();
  const total = await page.locator(`${scope} [data-pay-sum=total]`).allInnerTexts();
  const failures: string[] = [];
  if (rows.length === 0) failures.push(`no top-level rows in ${scope}`);
  if (total.length !== 1) failures.push(`expected one Total in ${scope}, found ${total.length}`);
  const sum = rows.reduce((a, r) => a + cents(r), 0);
  if (total.length === 1 && sum !== cents(total[0]!)) failures.push(`rows add to ${sum} cents, Total says ${cents(total[0]!)}`);
  return { name: "run-totals-sum", ok: failures.length === 0, failures };
}

/**
 * Lesson 23 (pay iter2 N3/D19): an ABN never breaks inside the number. Every visible "ABN 30 833 903 811" in `scope`
 * is joined with non-breaking spaces and sits on one line box.
 */
export async function checkAbnStaysWhole(page: Page, scope: string): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((sel) => {
    const out: string[] = [];
    let seen = 0;
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (el.getBoundingClientRect().width === 0) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        for (const m of text.matchAll(/ABN[\s ]\d[\d\s ]*\d/g)) {
          seen += 1;
          if (/ /.test(m[0])) out.push(`"${m[0]}" has plain spaces`);
          const range = document.createRange();
          range.setStart(node, m.index ?? 0);
          range.setEnd(node, (m.index ?? 0) + m[0].length);
          if (range.getClientRects().length > 1) out.push(`"${m[0].replace(/ /g, " ")}" breaks across two lines`);
        }
      }
    }
    if (seen === 0) out.push(`no ABN found in ${sel}`);
    return out;
  }, scope);
  return { name: "abn-stays-whole", ok: failures.length === 0, failures };
}

/**
 * Scrolled to the end, nothing on the screen sits under a fixed bar (the pinned action bar or the tab bar): the page
 * pads its bottom by every fixed bar's height (pay iter2 D16, lesson: fixed bars never cover content).
 */
export async function checkContentClearsFixedBars(page: Page): Promise<GuardResult> {
  const name = "content-clears-fixed-bars";
  // Scroll to the end of the settled page: the bar's measured height pads the page after hydration, so scroll again
  // until the page stops growing (under load a single early scroll can stop short of the real end).
  let last = -1;
  for (let i = 0; i < 6; i++) {
    const h = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return document.documentElement.scrollHeight;
    });
    await page.waitForTimeout(150);
    if (h === last) break;
    last = h;
  }
  const failures = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="primary-action"], nav[aria-label="Primary"]')).filter(
      (el) => getComputedStyle(el).position === "fixed" && el.getBoundingClientRect().height > 0,
    );
    if (bars.length === 0) return [];
    const top = Math.min(...bars.map((b) => b.getBoundingClientRect().top));
    const screen = document.querySelector("[data-screen]");
    if (!screen) return [];
    const out: string[] = [];
    for (const el of Array.from(screen.querySelectorAll("li, p, h2, button, a, section > *"))) {
      if (el.closest('[data-slot="primary-action"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > top + 1)
        out.push(`"${(el.textContent ?? "").trim().slice(0, 40)}" ends at ${Math.round(r.bottom)} px, under a fixed bar at ${Math.round(top)} px`);
    }
    return out.slice(0, 5);
  });
  return { name, ok: failures.length === 0, failures };
}

/**
 * A phone on its side: the pinned bar is one compact row (at most `max` px tall), its buttons and its sentence don't
 * overlap one another or the raised Log circle (pay iter2 D25/N2). No bar, or no Log circle to measure against, fails.
 */
export async function checkPinnedBarCompact(page: Page, max = 64): Promise<GuardResult> {
  const name = "pinned-bar-compact";
  const bar = page.locator('[data-slot="primary-action"]:visible').first();
  if ((await bar.count()) === 0) return { name, ok: false, failures: ["no pinned bar on the screen"] };
  const failures: string[] = [];
  const box = await bar.boundingBox();
  if (!box) failures.push("the pinned bar has no box");
  else if (box.height > max + 0.5) failures.push(`pinned bar is ${Math.round(box.height)} px tall (max ${max})`);
  const circleLoc = page.locator("nav .rounded-full.bg-chalk:visible").first();
  const circle = (await circleLoc.count()) === 0 ? null : await circleLoc.boundingBox();
  if (!circle) failures.push("no Log circle in the tab bar to measure against");
  const parts: { label: string; b: { x: number; y: number; width: number; height: number } }[] = [];
  for (const el of await bar.locator(":scope > *:visible").all()) {
    const b = await el.boundingBox();
    if (b && b.width > 0) parts.push({ label: (await el.innerText()).trim().slice(0, 30), b });
  }
  const hit = (a: (typeof parts)[number]["b"], c: (typeof parts)[number]["b"]) =>
    a.x < c.x + c.width - 0.5 && a.x + a.width > c.x + 0.5 && a.y < c.y + c.height - 0.5 && a.y + a.height > c.y + 0.5;
  parts.forEach((p, i) => {
    for (const q of parts.slice(i + 1)) if (hit(p.b, q.b)) failures.push(`"${p.label}" overlaps "${q.label}"`);
    if (circle && hit(p.b, circle)) failures.push(`"${p.label}" is under the Log circle`);
  });
  return { name, ok: failures.length === 0, failures };
}

/** From 1024 px the screen's actions end at the content's right edge (pay iter2 D17), and share one height. */
export async function checkActionsAtContentEdge(page: Page, actions: string, screen = "[data-screen]"): Promise<GuardResult> {
  const name = "actions-at-content-edge";
  const s = await page.locator(screen).first().boundingBox();
  const buttons = await page.locator(`${actions} :is(button, a)[data-variant]:visible:not([data-variant="link"])`).all();
  const boxes = (await Promise.all(buttons.map((b) => b.boundingBox()))).filter((b) => b !== null);
  if (!s || boxes.length === 0) return { name, ok: true, failures: [] };
  const failures: string[] = [];
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  if (Math.abs(right - (s.x + s.width)) > 1) failures.push(`actions end at ${Math.round(right)} px; content edge is ${Math.round(s.x + s.width)} px`);
  const heights = new Set(boxes.map((b) => Math.round(b.height)));
  if (heights.size > 1) failures.push(`action heights differ: ${[...heights].join(", ")} px`);
  const tops = new Set(boxes.map((b) => Math.round(b.y)));
  if (tops.size > 1) failures.push(`actions are not in one row (tops ${[...tops].join(", ")} px)`);
  return { name, ok: failures.length === 0, failures };
}

/**
 * From 1024 px the sidebar's column (its background and rule) runs from the top of the page to the bottom, even on a page
 * taller than the window (D18). Skips below 1024 px, where there is no sidebar.
 */
export async function checkSidebarSpansPage(page: Page): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate(() => {
    const column = document.querySelector("[data-sidebar-column]");
    if (!column || column.getBoundingClientRect().width === 0) return [];
    const rect = column.getBoundingClientRect();
    const page = document.documentElement.scrollHeight;
    const out: string[] = [];
    if (Math.abs(rect.height - page) > 1) out.push(`the sidebar column is ${rect.height.toFixed(0)}px tall on a ${page}px page`);
    if (getComputedStyle(column).backgroundColor === "rgba(0, 0, 0, 0)") out.push("the sidebar column has no background");
    return out;
  });
  return { name: "sidebar-spans-page", ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Reports (Task 18 design fix 1b)
// ---------------------------------------------------------------------------

/**
 * D5/N7, lesson 23: every visible `[data-oneline]` element in `scope` (a right-hand figure, its unit line, the key figure)
 * stays on one line, at any width. Fails when the scope has none, so a rename cannot hide the check.
 */
export async function checkOneLine(page: Page, scope: string): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((sel) => {
    const out: string[] = [];
    let seen = 0;
    for (const el of Array.from(document.querySelectorAll(`${sel} [data-oneline]`))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) continue;
      seen += 1;
      const style = getComputedStyle(el);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
      if (rect.height > line * 1.5) out.push(`"${(el.textContent ?? "").trim()}" wraps (${rect.height.toFixed(0)}px tall, line ${line.toFixed(0)}px)`);
    }
    if (seen === 0) out.push(`no [data-oneline] element found in ${sel}`);
    return out;
  }, scope);
  return { name: "one-line-figures", ok: failures.length === 0, failures };
}

/**
 * N3/D8, lesson 34: the first data row (a report row or hub row) ends inside the first viewport, so a phone sees data
 * without scrolling. Also checks the key figure sits under the title and there is exactly one figure-xl on the page.
 */
export async function checkReportFirstScreen(page: Page, opts: { keyFigure: boolean }): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((withFigure) => {
    const out: string[] = [];
    const visible = (el: Element) => el.getBoundingClientRect().width > 0;
    const row = Array.from(document.querySelectorAll("[data-report-row], [data-report-card]")).find(visible);
    if (!row) return ["no data row found"];
    const bottom = row.getBoundingClientRect().bottom;
    if (bottom > window.innerHeight) out.push(`first row ends at ${bottom.toFixed(0)}px, below the first screen (${window.innerHeight}px)`);
    const xl = Array.from(document.querySelectorAll("main .text-figure-xl, [data-screen] .text-figure-xl")).filter(visible);
    if (xl.length !== (withFigure ? 1 : 0)) out.push(`${xl.length} figure-xl on the page, expected ${withFigure ? 1 : 0}`);
    const title = document.querySelector("h1");
    if (withFigure && title && xl[0] && xl[0].getBoundingClientRect().top < title.getBoundingClientRect().bottom - 1)
      out.push("the key figure is not under the title");
    return out;
  }, opts.keyFigure);
  return { name: "report-first-screen", ok: failures.length === 0, failures };
}

/**
 * D10: one rule for a negative figure. Every visible leaf in a report row whose text starts with a minus sign and a digit
 * or $ has the over-budget colour, in every column.
 */
export async function checkNegativeFiguresShareColour(page: Page): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--over)";
    document.body.appendChild(probe);
    const over = getComputedStyle(probe).color;
    probe.remove();
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("[data-report-row] *"))) {
      const text = (el.textContent ?? "").trim();
      if (el.children.length > 0 || !/^−[\d$]/.test(text) || el.getBoundingClientRect().width === 0) continue;
      const colour = getComputedStyle(el).color;
      if (colour !== over) out.push(`"${text}" is ${colour}, not the over colour ${over}`);
    }
    return out;
  });
  return { name: "negative-figure-colour", ok: failures.length === 0, failures };
}

/** D13: no visible desktop table header breaks onto a second line ("To date", "Forecast", "Working days lost"). */
export async function checkTableHeadersOneLine(page: Page): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate(() => {
    const out: string[] = [];
    for (const th of Array.from(document.querySelectorAll("table thead th"))) {
      if (th.getBoundingClientRect().width === 0) continue;
      const tops = new Set<number>();
      const walker = document.createTreeWalker(th, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!(n.textContent ?? "").trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of Array.from(range.getClientRects())) if (r.width > 0) tops.add(Math.round(r.top));
      }
      if (tops.size > 1) out.push(`header "${(th.textContent ?? "").trim()}" wraps onto ${tops.size} lines`);
    }
    return out;
  });
  return { name: "table-headers-one-line", ok: failures.length === 0, failures };
}

/**
 * Reports iter2 F1/F2 (lesson 34): the first data row (report, hub or history row) starts above `maxTop` px at the top of the
 * page, so an applied range or a filter is one Change row and the data is in the first screen, also on a phone on its side.
 */
export async function checkFirstRowTop(page: Page, maxTop: number): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((limit) => {
    const row = Array.from(document.querySelectorAll("[data-report-row], [data-report-card], [data-history-row]")).find((el) => el.getBoundingClientRect().width > 0);
    if (!row) return ["no data row found"];
    const top = row.getBoundingClientRect().top + window.scrollY;
    return top < limit ? [] : [`the first row starts at ${top.toFixed(0)}px, expected under ${limit}px`];
  }, maxTop);
  return { name: "first-row-top", ok: failures.length === 0, failures };
}

/**
 * Reports iter2 F3/F8: nothing in `selector` sits under a fixed bar or under the raised Log circle. Checked at the end of the
 * page, where the page's own bottom padding has to do its job.
 */
export async function checkClearOfFixedBars(page: Page, selector: string): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const failures = await page.evaluate((sel) => {
    const boxes: DOMRect[] = [];
    for (const bar of Array.from(document.querySelectorAll<HTMLElement>('[data-slot="primary-action"], nav[aria-label="Primary"]'))) {
      if (getComputedStyle(bar).position !== "fixed" || bar.getBoundingClientRect().height === 0) continue;
      boxes.push(bar.getBoundingClientRect());
      for (const child of Array.from(bar.querySelectorAll("*"))) {
        const r = child.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) boxes.push(r);
      }
    }
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const hit = boxes.find((b) => r.left < b.right - 1 && r.right > b.left + 1 && r.top < b.bottom - 1 && r.bottom > b.top + 1);
      if (hit) out.push(`"${(el.textContent ?? "").trim().slice(0, 40)}" (${Math.round(r.top)}-${Math.round(r.bottom)}px) is under a fixed element at ${Math.round(hit.top)}-${Math.round(hit.bottom)}px`);
    }
    return out.slice(0, 5);
  }, selector);
  return { name: "clear-of-fixed-bars", ok: failures.length === 0, failures };
}

/**
 * Reports iter2 carry-over (F9): no text in `scope` is cut off by a clipping ancestor (the grouped list is overflow-hidden), so a
 * long line wraps instead of clipping, also at 200% text zoom.
 */
export async function checkNoClippedText(page: Page, scope: string): Promise<GuardResult> {
  await polyfillEsbuildNameHelper(page);
  const failures = await page.evaluate((sel) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll(`${sel} *`))) {
      if (el.children.length > 0 || !(el.textContent ?? "").trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      let anc = el.parentElement;
      while (anc && !/(hidden|clip)/.test(getComputedStyle(anc).overflowX)) anc = anc.parentElement;
      if (!anc) continue;
      const a = anc.getBoundingClientRect();
      if (r.right > a.right + 1 || r.left < a.left - 1) out.push(`"${(el.textContent ?? "").trim().slice(0, 50)}" runs ${Math.round(Math.max(r.right - a.right, a.left - r.left))}px past its clipping box`);
    }
    return out.slice(0, 5);
  }, scope);
  return { name: "no-clipped-text", ok: failures.length === 0, failures };
}

/**
 * A pinned Save bar is exactly as wide as the form column it belongs to and centred with it (left and right within 1 px),
 * so no field shows beside the bar and its rule cuts no label (entry-settings i2 D25). `column` is the form column's
 * selector (default: the pinned screen, `.pin-pad`). No pinned bar on the page fails: the caller named a pinned screen.
 */
export async function checkPinnedBarMatchesColumn(page: Page, column = ".pin-pad"): Promise<GuardResult> {
  const name = "pinned-bar-matches-column";
  const bar = page.locator('[data-slot="primary-action"]:visible').first();
  if ((await bar.count()) === 0) return { name, ok: false, failures: ["no pinned bar on the screen"] };
  const col = page.locator(column).first();
  const [b, c] = await Promise.all([bar.boundingBox(), col.boundingBox()]);
  if (!b || !c) return { name, ok: false, failures: [`no box for ${b ? column : "the pinned bar"}`] };
  const failures: string[] = [];
  if (Math.abs(b.x - c.x) > 1) failures.push(`the bar starts at ${Math.round(b.x)} px; the form column starts at ${Math.round(c.x)} px`);
  const [br, cr] = [b.x + b.width, c.x + c.width];
  if (Math.abs(br - cr) > 1) failures.push(`the bar ends at ${Math.round(br)} px; the form column ends at ${Math.round(cr)} px`);
  return { name, ok: failures.length === 0, failures };
}

/**
 * After a refused save an error line (an icon and a sentence in the error colour) is inside the first viewport and not
 * covered by anything, wherever the bad field sits in a tall form (entry-settings i2 D8 + F2, lesson 44).
 */
export async function checkErrorLineInView(page: Page): Promise<GuardResult> {
  const name = "error-line-in-view";
  const failures = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll<HTMLElement>("span.text-over")).filter((el) => el.querySelector("svg"));
    if (lines.length === 0) return ["no error line on the page"];
    const h = window.visualViewport?.height ?? window.innerHeight;
    const seen = lines.some((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.top < 0 || r.bottom > h) return false;
      const top = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
      return top !== null && el.contains(top);
    });
    return seen ? [] : [`${lines.length} error line(s) on the page, none fully inside the first ${Math.round(h)} px and uncovered`];
  });
  return { name, ok: failures.length === 0, failures };
}
