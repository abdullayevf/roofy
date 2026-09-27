// Stop hook: refuse to finish while code changes break typecheck or unit tests.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

let input;
try {
  const raw = readFileSync(0, "utf8").trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(0); // malformed/empty stdin: nothing to act on
}
if (input.stop_hook_active) process.exit(0); // never trap the session in a loop

// Any changed path counts as a code change unless it's docs (docs/ or .md).
const isCodePath = (path) => !path.startsWith("docs/") && !path.endsWith(".md");
const changed = execSync("git status --porcelain", { encoding: "utf8" })
  .split("\n")
  .filter((l) => l.length > 0)
  .some((l) => {
    let path = l.slice(3); // porcelain v1: "XY " prefix, path starts at index 3
    const arrow = path.indexOf(" -> "); // renames/copies: "old -> new"
    if (arrow !== -1) path = path.slice(arrow + 4);
    return isCodePath(path);
  });
if (!changed) process.exit(0);

try {
  execSync("pnpm -s typecheck && pnpm -s test:unit", { stdio: "pipe", encoding: "utf8" });
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.split("\n").slice(-60).join("\n");
  process.stderr.write(`Typecheck or unit tests are failing. Fix before finishing:\n${out}`);
  process.exit(2);
}
