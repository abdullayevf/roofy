// PostToolUse hook: format and lint the file Claude just edited. Exit 2 shows problems to Claude.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

let input;
try {
  const raw = readFileSync(0, "utf8").trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(0); // malformed/empty stdin: nothing to act on
}
const file = input?.tool_input?.file_path;
if (!file || !existsSync(file) || file.includes("/graft/") || file.includes("/node_modules/"))
  process.exit(0);

// Only ever touch files inside the project — never format/lint arbitrary paths on disk.
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const resolvedFile = resolve(file);
const rel = relative(resolve(projectDir), resolvedFile);
if (rel.startsWith("..") || isAbsolute(rel)) process.exit(0);

const run = (args) => execFileSync("pnpm", ["exec", ...args], { stdio: "pipe", encoding: "utf8" });
try {
  if (/\.(ts|tsx|mjs|js|css|json|md)$/.test(file)) run(["prettier", "--write", file]);
  if (/\.(ts|tsx|mjs|js)$/.test(file)) run(["eslint", "--fix", file]);
} catch (err) {
  process.stderr.write(`Lint problems in ${file}:\n${err.stdout ?? ""}${err.stderr ?? ""}`);
  process.exit(2);
}
