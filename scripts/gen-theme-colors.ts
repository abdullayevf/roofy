import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseGalv } from "../src/app/theme-colors";

/** Writes src/app/theme-colors.json (the two --galv values) from src/app/tokens.css; `--check` only compares. */
export function themeColorsJson(css: string): string {
  return `${JSON.stringify(parseGalv(css), null, 2)}\n`;
}

function main(): void {
  const root = process.cwd();
  const generated = themeColorsJson(readFileSync(join(root, "src/app/tokens.css"), "utf8"));
  const outPath = join(root, "src/app/theme-colors.json");
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(outPath, "utf8");
    } catch {
      // missing counts as out of date
    }
    if (current !== generated) {
      console.error(`${outPath} is out of date with tokens.css. Run \`pnpm tokens:gen\` and commit the result.`);
      process.exit(1);
    }
    console.log("theme-colors.json matches tokens.css.");
    return;
  }
  writeFileSync(outPath, generated);
  console.log(`Wrote ${outPath}`);
}

if (process.argv[1]?.endsWith("gen-theme-colors.ts")) main();
