import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * WCAG 2.1 contrast checker for src/app/tokens.css. Computes ratios from the
 * hex values that ship in tokens.css (not from DESIGN.md's stated numbers),
 * so it catches drift between what the doc claims and what the app renders.
 */

export function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace(/^#/, "");
  const full =
    h.length === 3 || h.length === 4 ? [...h.slice(0, 3)].map((c) => c + c).join("") : h.slice(0, 6);
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => srgbChannelToLinear(channel / 255)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1.0 (identical) to 21.0 (black/white). Order-independent. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export type Role = "text" | "large" | "ui" | "key-figure";

export const ROLE_THRESHOLD: Record<Role, number> = {
  text: 4.5,
  large: 3.0,
  ui: 3.0,
  "key-figure": 7.0,
};

export type ContrastPair = { fg: string; bg: string; role: Role };

// Every pair DESIGN.md §2 declares a ratio for, in both schemes (see the
// generator's "over/watch/good" row and "chalk (fill) / chalk-link" split).
// ink on galv/surface is also checked at the stricter key-figure bar, since
// it carries the big signage numerals DESIGN.md §1/§3 calls out.
export const PAIRS: ContrastPair[] = [
  { fg: "ink", bg: "galv", role: "text" },
  { fg: "ink", bg: "galv", role: "key-figure" },
  { fg: "ink", bg: "surface", role: "text" },
  { fg: "ink", bg: "surface", role: "key-figure" },
  { fg: "ink-2", bg: "galv", role: "text" },
  { fg: "ink-2", bg: "surface", role: "text" },
  { fg: "edge", bg: "surface", role: "ui" },
  { fg: "edge", bg: "galv", role: "ui" },
  { fg: "on-chalk", bg: "chalk", role: "text" },
  { fg: "chalk-link", bg: "galv", role: "text" },
  { fg: "chalk-link", bg: "surface", role: "text" },
  { fg: "on-tape", bg: "tape", role: "text" },
  { fg: "over", bg: "surface", role: "text" },
  { fg: "over", bg: "galv", role: "text" },
  { fg: "on-over", bg: "over", role: "text" },
  { fg: "on-over-fill", bg: "over-fill", role: "text" },
  { fg: "on-bar", bg: "bar", role: "text" },
  { fg: "watch", bg: "surface", role: "text" },
  { fg: "good", bg: "galv", role: "text" },
  { fg: "good", bg: "surface", role: "text" },
];

export type SchemeTokens = Record<string, string>;

function parseVars(block: string): SchemeTokens {
  const out: SchemeTokens = {};
  const re = /--([a-z0-9-]+):\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const name = m[1]!;
    const value = m[2]!.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) out[name] = value;
  }
  return out;
}

export function parseTokensCss(css: string): { light: SchemeTokens; dark: SchemeTokens } {
  const rootMatch = /:root\s*{([^}]*)}/s.exec(css);
  const darkMatch = /:root\[data-theme="dark"\]\s*{([^}]*)}/s.exec(css);
  if (!rootMatch) throw new Error("check-contrast: could not find a :root block in tokens.css");
  if (!darkMatch)
    throw new Error('check-contrast: could not find a :root[data-theme="dark"] block in tokens.css');
  return { light: parseVars(rootMatch[1]!), dark: parseVars(darkMatch[1]!) };
}

type Row = { scheme: "light" | "dark"; pair: ContrastPair; ratio: number | undefined; pass: boolean };

export function evaluate(tokens: { light: SchemeTokens; dark: SchemeTokens }): Row[] {
  const rows: Row[] = [];
  for (const [scheme, set] of [
    ["light", tokens.light],
    ["dark", tokens.dark],
  ] as const) {
    for (const pair of PAIRS) {
      const fgHex = set[pair.fg];
      const bgHex = set[pair.bg];
      if (!fgHex || !bgHex) {
        rows.push({ scheme, pair, ratio: undefined, pass: false });
        continue;
      }
      const ratio = contrastRatio(fgHex, bgHex);
      rows.push({ scheme, pair, ratio, pass: ratio >= ROLE_THRESHOLD[pair.role] });
    }
  }
  return rows;
}

export function formatTable(rows: Row[]): string {
  return rows
    .map((r) => {
      const status = r.pass ? "PASS" : "FAIL";
      const label = `${r.pair.fg} on ${r.pair.bg}`.padEnd(22);
      const role = `(${r.pair.role}, ≥ ${ROLE_THRESHOLD[r.pair.role].toFixed(1)})`.padEnd(20);
      const value = r.ratio === undefined ? "MISSING TOKEN" : `${r.ratio.toFixed(2)}:1`;
      return `${status}  ${r.scheme.padEnd(5)} ${label} ${role} ${value}`;
    })
    .join("\n");
}

function main(): void {
  const cssPath = join(process.cwd(), "src/app/tokens.css");
  const css = readFileSync(cssPath, "utf8");
  const tokens = parseTokensCss(css);
  const rows = evaluate(tokens);

  console.log(formatTable(rows));

  const failures = rows.filter((r) => !r.pass);
  if (failures.length > 0) {
    console.error(`\n${failures.length} contrast pair(s) below their WCAG 2.1 threshold.`);
    process.exit(1);
  }
  console.log(`\nContrast check: all ${rows.length} pairs pass.`);
}

if (process.argv[1]?.endsWith("check-contrast.ts")) main();
