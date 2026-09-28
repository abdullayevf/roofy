import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ID = /\*\*(E\d+\.\d+)/g;

export function missingExamples(specText: string, testTexts: readonly string[]): string[] {
  const ids = [...new Set([...specText.matchAll(ID)].map((m) => m[1]!))];
  const tests = testTexts.join("\n");
  return ids.filter((id) => !new RegExp(`\\b${id.replace(".", "\\.")}(?!\\d)`).test(tests));
}

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

function main(): void {
  const spec = readFileSync("docs/specs/02-pay-rules.md", "utf8");
  const missing = missingExamples(
    spec,
    testFiles("src").map((f) => readFileSync(f, "utf8")),
  );
  if (missing.length > 0) {
    console.error(`Spec examples without a named test: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Every pay-rules example has a named test.");
}

if (process.argv[1]?.endsWith("check-examples.ts")) main();
