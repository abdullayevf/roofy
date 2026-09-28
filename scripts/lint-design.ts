import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type RuleId =
  | "banned-font"
  | "uppercase"
  | "letter-spacing"
  | "arrow-glyph"
  | "middot-meta"
  | "lucide"
  | "gradient"
  | "purple"
  | "raw-color"
  | "emoji"
  | "shadow"
  | "shimmer"
  | "font-mono"
  | "hard-px"
  | "jargon";

export type Finding = { file: string; line: number; rule: RuleId; message: string };

type Rule = {
  id: RuleId;
  message: string;
  applies: (file: string) => boolean;
  test: (line: string) => boolean;
};

const isUi = (f: string) => f.endsWith(".tsx");
const any = () => true;

const RULES: Rule[] = [
  {
    id: "banned-font",
    message: "Banned brand font (DESIGN.md §3/§7). Use Barlow Semi Condensed or Atkinson Hyperlegible Next.",
    applies: any,
    test: (l) =>
      (/font/i.test(l) && /\b(Inter|Roboto|Arial|Helvetica|Space Grotesk|system-ui)\b/i.test(l)) ||
      /\bgeist\b/i.test(l) ||
      /geistsans|geistmono/i.test(l) ||
      /from\s+["']geist\/font\//i.test(l),
  },
  {
    id: "uppercase",
    message: "No all-caps labels; use sentence case (DESIGN.md §3).",
    applies: any,
    test: (l) => /(^|[\s"'`])uppercase($|[\s"'`])/.test(l) || /text-transform:\s*uppercase/.test(l),
  },
  {
    id: "letter-spacing",
    message: "No letter-spaced labels (DESIGN.md §7).",
    applies: any,
    test: (l) => {
      if (/\btracking-(wide|wider|widest)\b/.test(l)) return true;
      // tracking-[…] arbitrary values with an explicit px/rem/em unit are banned;
      // the sole allowed exception is the unitless "tracking-[0]".
      if (/tracking-\[[^\]]*(px|rem|em)\]/.test(l)) return true;
      const css = /letter-spacing:\s*(-?\d*\.?\d+)(px|rem|em)/.exec(l);
      if (css && Number(css[1]) !== 0) return true;
      return false;
    },
  },
  {
    id: "arrow-glyph",
    message: "No arrow glyphs appended to text (DESIGN.md §7).",
    applies: isUi,
    test: (l) => /[→›»]/.test(l),
  },
  {
    id: "middot-meta",
    message: "No '·'-joined meta strings in the UI (DESIGN.md §7).",
    applies: isUi,
    test: (l) => /\s·\s/.test(l),
  },
  {
    id: "lucide",
    message: "Use Phosphor icons, not Lucide (DESIGN.md §4).",
    applies: any,
    test: (l) => /from\s+["']lucide-react["']/.test(l),
  },
  {
    id: "gradient",
    message: "No gradients (DESIGN.md §1/§7).",
    applies: any,
    test: (l) =>
      /(bg-gradient-|bg-linear-|bg-radial\b|bg-conic\b|linear-gradient\(|radial-gradient\(|conic-gradient\()/.test(
        l,
      ),
  },
  {
    id: "purple",
    message: "No purple/violet hues (DESIGN.md §7).",
    applies: any,
    test: (l) => /\b(purple|violet|fuchsia|indigo)-\d{2,3}\b/.test(l),
  },
  {
    id: "raw-color",
    message: "Use tokens from src/app/tokens.css, not raw colours.",
    applies: (f) => f !== "src/app/tokens.css",
    test: (l) =>
      /(?<!href=["'])(?<=^|[\s:(,"'[])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/.test(
        l,
      ) || /\b(rgba?|hsla?|oklch)\(/.test(l),
  },
  {
    id: "emoji",
    message: "No emoji in the UI (DESIGN.md §7).",
    applies: isUi,
    test: (l) => /\p{Extended_Pictographic}/u.test(l),
  },
  {
    id: "shadow",
    message:
      "Only shadow-sheet or shadow-toast elevations are allowed (DESIGN.md §6); shadow-none is also fine.",
    applies: any,
    test: (l) => {
      const allowed = new Set(["shadow-sheet", "shadow-toast", "shadow-none"]);
      const matches = l.match(/\bshadow-(?:\[[^\]]*\]|[a-zA-Z0-9]+)/g) ?? [];
      return matches.some((m) => !allowed.has(m));
    },
  },
  {
    id: "shimmer",
    message: "No shimmer/pulse loading animation (DESIGN.md §7); use the skeleton token only.",
    applies: any,
    test: (l) => /\banimate-(pulse|shimmer)\b/.test(l),
  },
  {
    id: "font-mono",
    message: "No monospace type (DESIGN.md §7).",
    applies: any,
    test: (l) => /\bfont-mono\b/.test(l),
  },
  {
    id: "hard-px",
    message: "Tailwind arbitrary px values must be on the spacing scale (DESIGN.md §2).",
    applies: any,
    test: (l) => {
      const allowed = new Set([1, 1.5, 2, 3, 4, 8, 12, 16, 20, 24, 32, 40, 48, 52, 56, 64, 240]);
      const re = /-\[(-?\d+(?:\.\d+)?)px\]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(l))) {
        const value = Math.abs(Number(m[1]));
        if (!allowed.has(value)) return true;
      }
      return false;
    },
  },
  {
    id: "jargon",
    message: 'No internal jargon in UI text (DESIGN.md §7): avoid "entity", "mutation", "submit", "sync".',
    applies: isUi,
    test: (l) => {
      const jargon = /\b(entity|mutation|submit|sync)\b/i;
      const textMatches = l.match(/>([^<>{}]*)</g) ?? [];
      if (textMatches.some((t) => jargon.test(t.slice(1, -1)))) return true;
      const propRe = /\b(aria-label|label|title)\s*=\s*(["'])((?:(?!\2).)*)\2/gi;
      let m: RegExpExecArray | null;
      while ((m = propRe.exec(l))) {
        if (jargon.test(m[3] ?? "")) return true;
      }
      return false;
    },
  },
];

const SUPPRESS = /design-lint-disable-next-line\s+([a-z-]+)/;

export function lintSource(file: string, content: string): Finding[] {
  const lines = content.split("\n");
  const findings: Finding[] = [];
  lines.forEach((text, i) => {
    const suppressed = i > 0 ? SUPPRESS.exec(lines[i - 1] ?? "")?.[1] : undefined;
    for (const rule of RULES) {
      if (!rule.applies(file) || rule.id === suppressed) continue;
      if (rule.test(text)) findings.push({ file, line: i + 1, rule: rule.id, message: rule.message });
    }
  });
  return findings;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

function main(): void {
  const root = process.cwd();
  const findings = walk(join(root, "src")).flatMap((abs) => {
    const file = relative(root, abs);
    return lintSource(file, readFileSync(abs, "utf8"));
  });
  for (const f of findings) console.error(`${f.file}:${f.line}  ${f.rule}  ${f.message}`);
  if (findings.length > 0) {
    console.error(`\n${findings.length} design lint finding(s).`);
    process.exit(1);
  }
  console.log("Design lint: clean.");
}

if (process.argv[1]?.endsWith("lint-design.ts")) main();
