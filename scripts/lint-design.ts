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
  | "emoji";

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
    test: (l) => /font/i.test(l) && /\b(Inter|Roboto|Arial|Helvetica|Space Grotesk|Geist|system-ui)\b/.test(l),
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
    test: (l) => /\btracking-(wide|wider|widest)\b/.test(l) || /tracking-\[0?\.\d/.test(l) || /letter-spacing:\s*0?\.\d+em/.test(l),
  },
  { id: "arrow-glyph", message: "No arrow glyphs appended to text (DESIGN.md §7).", applies: isUi, test: (l) => /[→›»]/.test(l) },
  { id: "middot-meta", message: "No '·'-joined meta strings in the UI (DESIGN.md §7).", applies: isUi, test: (l) => /\s·\s/.test(l) },
  { id: "lucide", message: "Use Phosphor icons, not Lucide (DESIGN.md §4).", applies: any, test: (l) => /from\s+["']lucide-react["']/.test(l) },
  {
    id: "gradient",
    message: "No gradients (DESIGN.md §1/§7).",
    applies: any,
    test: (l) => /(bg-gradient-|bg-linear-|bg-radial-|bg-conic-|linear-gradient\(|radial-gradient\(|conic-gradient\()/.test(l),
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
    applies: (f) => !f.endsWith("src/app/tokens.css"),
    test: (l) => /#[0-9a-fA-F]{3,8}\b/.test(l) || /\b(rgba?|hsla?|oklch)\(/.test(l),
  },
  { id: "emoji", message: "No emoji in the UI (DESIGN.md §7).", applies: isUi, test: (l) => /\p{Extended_Pictographic}/u.test(l) },
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
