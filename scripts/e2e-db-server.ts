import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { loadDotEnv } from "../src/server/db/env";
import { E2E_PORT, e2eDatabaseUrls, e2eServerEnv } from "../tests/e2e-db/env";

// Starts the already-built app (`.next`) in db mode on 3101 against roofy_e2e. It never builds: the one build is
// made by the caller (ROOFY_DATA=fake pnpm build, as playwright's fake server does), and ROOFY_DATA is read at
// runtime, so the same build serves both modes. Run `pnpm db:reset-e2e` first.
loadDotEnv();
if (!existsSync(".next/BUILD_ID")) {
  console.error("There is no build in .next. Run: ROOFY_DATA=fake pnpm build");
  process.exit(1);
}
if (!e2eDatabaseUrls().DATABASE_URL) {
  console.error("TEST_DATABASE_URL is not set. Add it to .env (see .env.example).");
  process.exit(1);
}
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "start", "-p", String(E2E_PORT), "-H", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env, ...e2eServerEnv() },
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 143 : 1)));
