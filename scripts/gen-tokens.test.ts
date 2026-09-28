import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateTokensCss } from "./gen-tokens";

const FIXTURE = `# Roofy — DESIGN.md ("Galvanised")

## 2. Colour palette and roles

### Light (default)
| Token | Hex | Role | Contrast |
|---|---|---|---|
| \`galv\` | \`#EDEFED\` | Page background (zincalume) | — |
| \`surface\` | \`#FFFFFF\` | Lists, sheets, inputs | — |
| \`ink\` | \`#2F3133\` | Primary text, icons (Monument) | 11.3 on galv · 13.1 on surface |
| \`ink-2\` | \`#5A605C\` | Secondary text | 5.6 on galv · 6.4 on surface |
| \`line\` | \`#D5DAD6\` | Dividers between rows (decorative) | — |
| \`edge\` | \`#7D8580\` | Input and control borders | 3.8 on surface · 3.3 on galv |
| \`chalk\` | \`#1F4FB5\` | Primary actions, links, focus ring | 7.4 white-on-chalk · 6.4 on galv |
| \`tape\` | \`#FFC82C\` | Marks: selected crew, today, tape bar fill (always with \`ink\` text/outline) | ink on tape 8.4 |
| \`over\` | \`#C62D1F\` | Over budget, errors, destructive | 5.5 on surface · 4.8 on galv |
| \`watch\` | \`#8A5300\` | Trending over, warnings (text); fill uses \`tape\` | 6.3 on surface |
| \`good\` | \`#256B40\` | On track, sent, done | 5.6 on galv |

### Dark
| Token | Hex | Contrast |
|---|---|---|
| \`galv\` | \`#1F2224\` | — |
| \`surface\` | \`#2A2E30\` | — |
| \`ink\` | \`#ECEEEC\` | 13.7 on galv |
| \`ink-2\` | \`#A9B0AC\` | 6.2 on surface |
| \`line\` | \`#3A3F42\` | — |
| \`edge\` | \`#7A827E\` | ≥ 3.0 on surface |
| \`chalk\` (button fill) | \`#3563CC\` (white text 5.5) · links \`#8FB0FF\` (6.4) | |
| \`tape\` | \`#FFC82C\` (galv text on tape 10.3) | |
| \`over\` | \`#FF8A7A\` (6.0) · \`watch\` \`#FFC82C\` · \`good\` \`#6FCF97\` (7.2) | |

Dark mode is elevation-by-lightness (surfaces get lighter as they rise), no shadows.

## 3. Typography

Not colour content.

## 6. Depth and elevation (light)

| Level | Use | Treatment |
|---|---|---|
| 0 | Page | \`galv\` |
| 1 | Lists, panels | \`surface\`, radius 12, no shadow (separation by colour) |
| 2 | Sheets, menus, popovers | \`surface\`, radius 16 (sheets top only), shadow \`0 8px 24px rgb(31 34 36 / 0.18)\` |
| 3 | Toasts | \`ink\` background, \`surface\` text, shadow \`0 12px 32px rgb(31 34 36 / 0.28)\` |

Radius hierarchy is deliberate.

## 7. Do's and don'ts
`;

describe("generateTokensCss", () => {
  const css = generateTokensCss(FIXTURE);

  it("keeps the raw-colours header comment", () => {
    expect(css.split("\n")[0]).toMatch(/^\/\*.*raw colours.*\*\/$/);
  });

  it("emits light tokens on :root with color-scheme light", () => {
    expect(css).toMatch(/:root\s*{[^}]*color-scheme:\s*light;/s);
    expect(css).toMatch(/:root\s*{[^}]*--galv:\s*#edefed;/s);
    expect(css).toMatch(/:root\s*{[^}]*--surface:\s*#ffffff;/s);
    expect(css).toMatch(/:root\s*{[^}]*--ink:\s*#2f3133;/s);
    expect(css).toMatch(/:root\s*{[^}]*--ink-2:\s*#5a605c;/s);
    expect(css).toMatch(/:root\s*{[^}]*--line:\s*#d5dad6;/s);
    expect(css).toMatch(/:root\s*{[^}]*--edge:\s*#7d8580;/s);
    expect(css).toMatch(/:root\s*{[^}]*--chalk:\s*#1f4fb5;/s);
    expect(css).toMatch(/:root\s*{[^}]*--tape:\s*#ffc82c;/s);
    expect(css).toMatch(/:root\s*{[^}]*--over:\s*#c62d1f;/s);
    expect(css).toMatch(/:root\s*{[^}]*--watch:\s*#8a5300;/s);
    expect(css).toMatch(/:root\s*{[^}]*--good:\s*#256b40;/s);
  });

  it("light chalk-link equals chalk (DESIGN.md: light = chalk)", () => {
    const rootBlock = css.match(/:root\s*{([^}]*)}/s)?.[1] ?? "";
    expect(rootBlock).toMatch(/--chalk-link:\s*#1f4fb5;/);
  });

  it("derives on-chalk (white), on-tape (ink in light) and watch-fill (tape)", () => {
    const rootBlock = css.match(/:root\s*{([^}]*)}/s)?.[1] ?? "";
    expect(rootBlock).toMatch(/--on-chalk:\s*#ffffff;/);
    expect(rootBlock).toMatch(/--on-tape:\s*#2f3133;/);
    expect(rootBlock).toMatch(/--watch-fill:\s*#ffc82c;/);
  });

  it("derives on-over as white in light mode (over is dark-toned there)", () => {
    const rootBlock = css.match(/:root\s*{([^}]*)}/s)?.[1] ?? "";
    expect(rootBlock).toMatch(/--on-over:\s*#ffffff;/);
  });

  it("derives on-over as the dark galv in dark mode (over flips to a light tone there, like tape)", () => {
    const mediaBlock = css.match(
      /@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]*)}/s,
    )?.[1];
    expect(mediaBlock).toMatch(/--on-over:\s*#1f2224;/);
  });

  it("emits elevation shadows on :root from §6", () => {
    const rootBlock = css.match(/:root\s*{([^}]*)}/s)?.[1] ?? "";
    expect(rootBlock).toMatch(/--shadow-sheet:\s*0 8px 24px rgb\(31 34 36 \/ 0\.18\);/);
    expect(rootBlock).toMatch(/--shadow-toast:\s*0 12px 32px rgb\(31 34 36 \/ 0\.28\);/);
  });

  it("emits dark tokens under prefers-color-scheme guarded by :not([data-theme=light])", () => {
    const mediaBlock = css.match(
      /@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]*)}/s,
    )?.[1];
    expect(mediaBlock).toBeDefined();
    expect(mediaBlock).toMatch(/color-scheme:\s*dark;/);
    expect(mediaBlock).toMatch(/--galv:\s*#1f2224;/);
    expect(mediaBlock).toMatch(/--surface:\s*#2a2e30;/);
    expect(mediaBlock).toMatch(/--ink:\s*#eceeec;/);
    expect(mediaBlock).toMatch(/--ink-2:\s*#a9b0ac;/);
    expect(mediaBlock).toMatch(/--line:\s*#3a3f42;/);
    expect(mediaBlock).toMatch(/--edge:\s*#7a827e;/);
    expect(mediaBlock).toMatch(/--chalk:\s*#3563cc;/);
    expect(mediaBlock).toMatch(/--tape:\s*#ffc82c;/);
    expect(mediaBlock).toMatch(/--over:\s*#ff8a7a;/);
  });

  it("parses the dark chalk row's two values: fill -> chalk, links -> chalk-link", () => {
    const mediaBlock = css.match(
      /@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]*)}/s,
    )?.[1];
    expect(mediaBlock).toMatch(/--chalk:\s*#3563cc;/);
    expect(mediaBlock).toMatch(/--chalk-link:\s*#8fb0ff;/);
  });

  it("parses watch and good out of the packed dark 'over' row", () => {
    const mediaBlock = css.match(
      /@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]*)}/s,
    )?.[1];
    expect(mediaBlock).toMatch(/--watch:\s*#ffc82c;/);
    expect(mediaBlock).toMatch(/--good:\s*#6fcf97;/);
  });

  it("dark on-tape is galv (per DESIGN.md 'galv text on tape 10.3') and elevation is none", () => {
    const mediaBlock = css.match(
      /@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]*)}/s,
    )?.[1];
    expect(mediaBlock).toMatch(/--on-tape:\s*#1f2224;/);
    expect(mediaBlock).toMatch(/--shadow-sheet:\s*none;/);
    expect(mediaBlock).toMatch(/--shadow-toast:\s*none;/);
  });

  it("also emits the same dark tokens under :root[data-theme=dark]", () => {
    const explicitBlock = css.match(/:root\[data-theme="dark"\]\s*{([^}]*)}/s)?.[1];
    expect(explicitBlock).toBeDefined();
    expect(explicitBlock).toMatch(/color-scheme:\s*dark;/);
    expect(explicitBlock).toMatch(/--galv:\s*#1f2224;/);
    expect(explicitBlock).toMatch(/--chalk-link:\s*#8fb0ff;/);
    expect(explicitBlock).toMatch(/--good:\s*#6fcf97;/);
    expect(explicitBlock).toMatch(/--shadow-sheet:\s*none;/);
  });

  it("also emits a plain [data-theme=dark] block for wrapper elements, not only :root", () => {
    const wrapperBlock = css.match(/\n\[data-theme="dark"\]\s*{([^}]*)}/s)?.[1];
    expect(wrapperBlock).toBeDefined();
    expect(wrapperBlock).toMatch(/color-scheme:\s*dark;/);
    expect(wrapperBlock).toMatch(/--galv:\s*#1f2224;/);
    expect(wrapperBlock).toMatch(/--chalk-link:\s*#8fb0ff;/);
    expect(wrapperBlock).toMatch(/--good:\s*#6fcf97;/);
    expect(wrapperBlock).toMatch(/--shadow-sheet:\s*none;/);
  });

  it("also emits a plain [data-theme=light] block for wrapper elements, forcing light regardless of scheme", () => {
    const wrapperBlock = css.match(/\[data-theme="light"\]\s*{([^}]*)}/s)?.[1];
    expect(wrapperBlock).toBeDefined();
    expect(wrapperBlock).toMatch(/color-scheme:\s*light;/);
    expect(wrapperBlock).toMatch(/--galv:\s*#edefed;/);
    expect(wrapperBlock).toMatch(/--chalk-link:\s*#1f4fb5;/);
    expect(wrapperBlock).toMatch(/--shadow-sheet:\s*0 8px 24px rgb\(31 34 36 \/ 0\.18\);/);
  });

  it("is stable (idempotent) across repeated generation", () => {
    expect(generateTokensCss(FIXTURE)).toEqual(css);
  });
});

describe("gen-tokens drift check", () => {
  it("the committed tokens.css matches what the generator produces from DESIGN.md", () => {
    const md = readFileSync(new URL("../docs/design/DESIGN.md", import.meta.url), "utf8");
    const committed = readFileSync(new URL("../src/app/tokens.css", import.meta.url), "utf8");
    expect(committed).toEqual(generateTokensCss(md));
  });
});
