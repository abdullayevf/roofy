// Stop hook: refuse to finish while code changes break typecheck or unit tests.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
if (input.stop_hook_active) process.exit(0); // never trap the session in a loop

const changed = execSync("git status --porcelain", { encoding: "utf8" })
  .split("\n")
  .some((l) => /\s(src|scripts|tests)\//.test(l) || /\.(ts|tsx)$/.test(l));
if (!changed) process.exit(0);

try {
  execSync("pnpm -s typecheck && pnpm -s test:unit", { stdio: "pipe", encoding: "utf8" });
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.split("\n").slice(-60).join("\n");
  process.stderr.write(`Typecheck or unit tests are failing. Fix before finishing:\n${out}`);
  process.exit(2);
}
