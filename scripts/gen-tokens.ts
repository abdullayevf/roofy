import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generates src/app/tokens.css from docs/design/DESIGN.md §2 (colour) and §6
 * (elevation). It parses the token name / hex pairs out of the markdown
 * tables rather than hard-coding any hex value: only the *shape* of each row
 * (which cell holds which token, and the extra inline pairs packed into the
 * dark table's `chalk` and `over` rows) is hard-coded here.
 */

const COLOR_TOKEN_ORDER = [
  "galv",
  "surface",
  "ink",
  "ink-2",
  "line",
  "edge",
  "chalk",
  "chalk-link",
  "tape",
  "over",
  "watch",
  "good",
  "on-chalk",
  "on-tape",
  "on-over",
  "watch-fill",
  "over-fill",
  "on-over-fill",
  "bar",
  "on-bar",
] as const;

export type ColorTokenName = (typeof COLOR_TOKEN_ORDER)[number];
export type ColorTokens = Record<ColorTokenName, string>;
export type Elevation = { sheet: string; toast: string };

const HEX_RE = "[0-9A-Fa-f]{3,8}";

/** A markdown table row of the shape `| \`token\` <anything> | \`#hex\` <anything> | ... |`. */
const ROW_RE = new RegExp("^\\|\\s*`([a-z0-9-]+)`[^|]*\\|\\s*`#(" + HEX_RE + ")`");

function normalizeHex(hex: string): string {
  return `#${hex.toLowerCase()}`;
}

/** Slices out the body of a `## N. Heading` section, up to (not including) the next `## ` heading. */
function topSection(md: string, headingMatch: RegExp): string {
  const start = md.search(headingMatch);
  if (start === -1) {
    throw new Error(`gen-tokens: could not find section matching ${headingMatch}`);
  }
  const afterStart = start + (md.slice(start).match(headingMatch)?.[0]?.length ?? 0);
  const rest = md.slice(afterStart);
  const nextTop = rest.search(/\n## /);
  return nextTop === -1 ? rest : rest.slice(0, nextTop);
}

/** Slices from one `### Heading` to the next `### ` (or end of the given text). */
function subSection(text: string, headingMatch: RegExp): string {
  const start = text.search(headingMatch);
  if (start === -1) {
    throw new Error(`gen-tokens: could not find sub-section matching ${headingMatch}`);
  }
  const afterStart = start + (text.slice(start).match(headingMatch)?.[0]?.length ?? 0);
  const rest = text.slice(afterStart);
  const nextSub = rest.search(/\n### /);
  return nextSub === -1 ? rest : rest.slice(0, nextSub);
}

/** Parses every `| \`token\` ... | \`#hex\` ... |` row in a block of markdown into a token -> hex map. */
function parseRows(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = ROW_RE.exec(line.trim());
    if (m) out[m[1]!] = normalizeHex(m[2]!);
  }
  return out;
}

function parseColorSection(md: string): { light: Record<string, string>; dark: Record<string, string> } {
  const body = topSection(md, /## 2\. Colour palette[^\n]*\n/);
  const lightText = subSection(body, /### Light[^\n]*\n/);
  const darkText = subSection(body, /### Dark[^\n]*\n/);

  const light = parseRows(lightText);
  const dark = parseRows(darkText);

  // The dark table packs extra token/hex pairs into two rows rather than
  // giving each its own row (DESIGN.md §2 dark table):
  //   `chalk` (button fill) | `#3563CC` ... · links `#8FB0FF` ...
  //   `over`  | `#FF8A7A` ... · `watch` `#FFC82C` · `good` `#6FCF97` ...
  const darkLinks = new RegExp("links\\s*`#(" + HEX_RE + ")`", "i").exec(darkText);
  const darkWatch = new RegExp("`watch`\\s*`#(" + HEX_RE + ")`", "i").exec(darkText);
  const darkGood = new RegExp("`good`\\s*`#(" + HEX_RE + ")`", "i").exec(darkText);

  if (!darkLinks)
    throw new Error("gen-tokens: could not find the dark chalk-link hex (the 'links `#…`' text)");
  if (!darkWatch) throw new Error("gen-tokens: could not find the dark watch hex packed into the 'over' row");
  if (!darkGood) throw new Error("gen-tokens: could not find the dark good hex packed into the 'over' row");

  dark["chalk-link"] = normalizeHex(darkLinks[1]!);
  dark["watch"] = normalizeHex(darkWatch[1]!);
  dark["good"] = normalizeHex(darkGood[1]!);

  return { light, dark };
}

function parseElevation(md: string): Elevation {
  const body = topSection(md, /## 6\. Depth and elevation[^\n]*\n/);
  const shadows = [...body.matchAll(/shadow\s*`([^`]+)`/g)].map((m) => m[1]!);
  const sheet = shadows[0];
  const toast = shadows[1];
  if (!sheet || !toast) {
    throw new Error("gen-tokens: expected two `shadow \`…\`` values in §6 (sheet, toast)");
  }
  return { sheet, toast };
}

function buildColors(
  base: Record<string, string>,
  opts: { chalkLink: string; onTapeFrom: string; onOverFrom: string; onBarFrom: string },
): ColorTokens {
  const required = [
    "galv",
    "surface",
    "ink",
    "ink-2",
    "line",
    "edge",
    "chalk",
    "tape",
    "over",
    "watch",
    "good",
    "over-fill",
    "bar",
  ];
  for (const key of required) {
    if (!base[key]) throw new Error(`gen-tokens: missing token "${key}" while building colours`);
  }
  return {
    galv: base.galv!,
    surface: base.surface!,
    ink: base.ink!,
    "ink-2": base["ink-2"]!,
    line: base.line!,
    edge: base.edge!,
    chalk: base.chalk!,
    "chalk-link": opts.chalkLink,
    tape: base.tape!,
    over: base.over!,
    watch: base.watch!,
    good: base.good!,
    "on-chalk": "#ffffff",
    "on-tape": opts.onTapeFrom,
    "on-over": opts.onOverFrom,
    "watch-fill": base.tape!,
    "over-fill": base["over-fill"]!,
    // Text on a filled destructive button is always white: `over-fill` is dark-toned in both schemes.
    "on-over-fill": "#ffffff",
    bar: base.bar!,
    "on-bar": opts.onBarFrom,
  };
}

function colorDeclarations(c: ColorTokens, indent: string): string {
  return COLOR_TOKEN_ORDER.map((name) => `${indent}--${name}: ${c[name]};`).join("\n");
}

export function generateTokensCss(designMd: string): string {
  const { light: lightBase, dark: darkBase } = parseColorSection(designMd);
  const elevation = parseElevation(designMd);

  // `over` is dark-toned in light mode (#C62D1F) but light-toned in dark
  // mode (#FF8A7A, calibrated as a *text* colour on dark surfaces per §2) —
  // the same inversion `tape` has, so `on-over` is derived the same way
  // `on-tape` is: white where the fill is dark, a dark surface tone where
  // the fill is itself light. This backs the filled destructive button
  // (DESIGN.md §4, confirmation sheets only).
  const light = buildColors(lightBase, {
    chalkLink: lightBase.chalk!,
    onTapeFrom: lightBase.ink!,
    onOverFrom: "#ffffff",
    onBarFrom: lightBase.surface!,
  });
  const dark = buildColors(darkBase, {
    chalkLink: darkBase["chalk-link"]!,
    onTapeFrom: darkBase.galv!,
    onOverFrom: darkBase.galv!,
    onBarFrom: darkBase.ink!,
  });

  const header =
    "/* Design tokens. Generated from docs/design/DESIGN.md by scripts/gen-tokens.ts. Only file allowed to contain raw colours. */";

  return `${header}
:root {
  color-scheme: light;
${colorDeclarations(light, "  ")}
  --shadow-sheet: ${elevation.sheet};
  --shadow-toast: ${elevation.toast};
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${colorDeclarations(dark, "    ")}
    --shadow-sheet: none;
    --shadow-toast: none;
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
${colorDeclarations(dark, "  ")}
  --shadow-sheet: none;
  --shadow-toast: none;
}

/*
 * Non-:root variants so a wrapper element (e.g. a side-by-side light/dark
 * demo on /design) can force a theme regardless of the page's own scheme,
 * not only the document root.
 */
[data-theme="dark"] {
  color-scheme: dark;
${colorDeclarations(dark, "  ")}
  --shadow-sheet: none;
  --shadow-toast: none;
}

[data-theme="light"] {
  color-scheme: light;
${colorDeclarations(light, "  ")}
  --shadow-sheet: ${elevation.sheet};
  --shadow-toast: ${elevation.toast};
}
`;
}

function main(): void {
  const root = process.cwd();
  const mdPath = join(root, "docs/design/DESIGN.md");
  const outPath = join(root, "src/app/tokens.css");
  const generated = generateTokensCss(readFileSync(mdPath, "utf8"));

  if (process.argv.includes("--check")) {
    const current = readFileSync(outPath, "utf8");
    if (current !== generated) {
      console.error(
        `${outPath} is out of date with ${mdPath}. Run \`pnpm tokens:gen\` and commit the result.`,
      );
      process.exit(1);
    }
    console.log("tokens.css matches DESIGN.md.");
    return;
  }

  writeFileSync(outPath, generated);
  console.log(`Wrote ${outPath}`);
}

if (process.argv[1]?.endsWith("gen-tokens.ts")) main();
