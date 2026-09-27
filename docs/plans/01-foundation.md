# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clean, strict, self-checking project skeleton: Next.js app, tests at every level, dev database, design lint and a Claude Code harness that blocks broken work.

**Architecture:** Single Next.js 16 app at the repo root (`src/` layout). Tooling scripts in `scripts/`. Dev Postgres in Docker on `127.0.0.1:5440`. Claude Code hooks format every edited file and refuse to end a turn while typecheck or unit tests fail.

**Tech Stack:** pnpm 10, Next.js 16.3.6, React 19, TypeScript ~6.0.3, Tailwind CSS 4, ESLint 10 (flat config), Prettier 3, Vitest 5, Playwright 1.63, tsx, Docker Compose, postgres:17-alpine.

**Spec:** `docs/specs/03-architecture.md` §2, §3, §10, §11; `docs/design/DESIGN.md` §7 (design lint rules); `docs/plans/00-master-plan.md` (Global Constraints).

## Global Constraints

- TypeScript pinned to `~6.0.3` (TypeScript 7's native compiler is not yet supported by Next.js tooling).
- App port `3100`, dev DB port `5440`, both bound to `127.0.0.1` (other projects on this VPS use 3000, 3005, 5434, 5439, 8080).
- `src/domain` imports only `@/domain/*` and `@/lib/*`; `src/components`, `src/offline` never import `@/server/*`.
- No Inter/Roboto/Geist, no gradients, no purple, no all-caps labels, no raw colours outside `src/app/tokens.css` (DESIGN.md §7).
- Do not touch other Docker projects, nginx config, or system packages beyond what a task states.

## Review Focus

1. **Scaffold leftovers** — create-next-app ships Geist fonts, gradients and hex colours; if left in place, design lint must fail. Pinned in Task 1 Step 6 (placeholder page) and Task 5 Step 8 (lint runs clean on `src/`).
2. **Hook infinite loop** — a Stop hook that keeps failing could trap a session; the hook must exit 0 when `stop_hook_active` is true. Pinned in Task 6 Step 4.
3. **Port collision with other VPS projects** — dev server/DB must use 3100/5440 only. Pinned in Task 3 Step 3 and Task 4 config.
4. **Boundary rule silently not matching** — a mis-written ESLint pattern would pass everything. Pinned in Task 2 Step 5 (deliberate violation must error).
5. **Design lint false negatives on Tailwind v4 syntax** (`bg-linear-to-r`, `tracking-[0.2em]`). Pinned in Task 5 tests.

---

## File map

| File | Responsibility |
|---|---|
| `package.json`, `pnpm-lock.yaml` | Scripts and dependencies |
| `tsconfig.json` | Strict TS, `@/*` alias |
| `eslint.config.mjs` | Next lint + import boundaries |
| `.prettierrc.json`, `.prettierignore` | Formatting |
| `vitest.config.ts` | Unit test config |
| `playwright.config.ts`, `tests/e2e/smoke.spec.ts` | E2E on 3 device projects |
| `ops/compose.dev.yml`, `ops/dev/init.sql`, `.env.example` | Dev database |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/tokens.css` | Placeholder shell (real design comes in Phase 2) |
| `scripts/lint-design.ts`, `scripts/lint-design.test.ts` | Design lint |
| `CLAUDE.md` | Project rules for Claude |
| `.claude/settings.json`, `scripts/hooks/format-changed.mjs`, `scripts/hooks/stop-check.mjs` | Hooks |
| `.claude/agents/spec-reviewer.md` | Independent spec reviewer |
| `docs/plans/PROGRESS.md` | Cross-session progress log |

---

### Task 1: Scaffold the Next.js app with strict TypeScript

**Files:**
- Create: everything create-next-app generates at repo root, then modify `package.json`, `tsconfig.json`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/app/tokens.css`, `.nvmrc`
- Delete: `src/app/favicon.ico` (replaced in Phase 2), `public/*.svg` from scaffold

**Interfaces:**
- Produces: scripts `dev`, `build`, `start`, `typecheck`, `lint`; alias `@/*` → `src/*`.

- [ ] **Step 1: Generate the scaffold in the scratch directory**

```bash
SCAFFOLD=/tmp/roofy-scaffold && rm -rf "$SCAFFOLD"
pnpm dlx create-next-app@16.3.6 "$SCAFFOLD" --ts --eslint --tailwind --app --src-dir \
  --import-alias "@/*" --use-pnpm --skip-install --yes
ls "$SCAFFOLD"
```
Expected: `package.json`, `src/app/…`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`.

- [ ] **Step 2: Copy into the repo without clobbering existing files**

```bash
cd /home/admin/roofy
cat "$SCAFFOLD/.gitignore" >> .gitignore
rsync -a --exclude .git --exclude .gitignore --exclude README.md "$SCAFFOLD"/ ./
rm -f public/*.svg src/app/favicon.ico
```

- [ ] **Step 3: Set package name, engines, scripts; pin TypeScript**

Edit `package.json` so these fields read exactly (keep generated dependency entries):

```json
{
  "name": "roofy",
  "private": true,
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "next dev -p 3100",
    "build": "next build",
    "start": "next start -p 3100 -H 127.0.0.1",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

```bash
echo "24" > .nvmrc
pnpm install
pnpm add -D typescript@~6.0.3
```

- [ ] **Step 4: Make TypeScript strict**

In `tsconfig.json` `compilerOptions`, set (add or replace):

```json
"strict": true,
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true,
"noFallthroughCasesInSwitch": true,
"exactOptionalPropertyTypes": false,
"forceConsistentCasingInFileNames": true
```

- [ ] **Step 5: Replace scaffold styling with a neutral placeholder**

`src/app/tokens.css`:

```css
/* Design tokens. Generated from docs/design/DESIGN.md in Phase 2. Only file allowed to contain raw colours. */
:root {
  --galv: #edefed;
  --surface: #ffffff;
  --ink: #2f3133;
}
```

`src/app/globals.css`:

```css
@import "tailwindcss";
@import "./tokens.css";

body {
  background: var(--galv);
  color: var(--ink);
}
```

- [ ] **Step 6: Replace layout and page**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roofy",
  description: "Crew and job costing for roofing businesses",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="p-4">
      <h1>Roofy</h1>
      <p>Foundation build. Screens arrive in Phase 2.</p>
    </main>
  );
}
```

- [ ] **Step 7: Verify build, typecheck and lint**

```bash
pnpm typecheck && pnpm lint && pnpm build
```
Expected: all succeed; build prints the `/` route.

- [ ] **Step 8: Commit**

```bash
git add -A ':!graft' ':!.ignore'
git commit -m "chore: scaffold Next.js 16 app with strict TypeScript

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Vitest and import-boundary lint

**Files:**
- Create: `vitest.config.ts`, `src/lib/smoke.test.ts`
- Modify: `eslint.config.mjs`, `package.json`

**Interfaces:**
- Produces: `pnpm test:unit` (runs `src/**/*.test.ts` and `scripts/**/*.test.ts`), boundary rules used by every later phase.

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest@^5 @vitest/coverage-v8@^5 vite-tsconfig-paths fast-check tsx
```

- [ ] **Step 2: Write the config**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts"],
      exclude: ["src/domain/**/*.test.ts"],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
```

Add scripts to `package.json`:

```json
"test:unit": "vitest run",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3: Write a smoke test and run it**

`src/lib/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs TypeScript tests", () => {
    const sum: number = [1, 2, 3].reduce((a, b) => a + b, 0);
    expect(sum).toBe(6);
  });
});
```

Run: `pnpm test:unit` — Expected: `1 passed`.

- [ ] **Step 4: Add boundary rules**

Append these objects to the exported array in `eslint.config.mjs`:

```js
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/(?!domain/|lib/)",
              message: "src/domain may only import from @/domain and @/lib.",
            },
            {
              regex: "^(react|react-dom|next|drizzle-orm|pg|postgres|dexie|zod)(/|$)",
              message: "src/domain is pure TypeScript: no frameworks, IO or DB.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/offline/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^@/server(/|$)", message: "UI and offline code must not import server code." }] },
      ],
    },
  },
```

- [ ] **Step 5: Prove the rule fires, then remove the probe**

```bash
mkdir -p src/domain src/server
echo 'export const x = 1;' > src/server/probe.ts
echo 'import { x } from "@/server/probe"; export const y = x;' > src/domain/probe.ts
pnpm exec eslint src/domain/probe.ts; echo "exit=$?"
rm src/domain/probe.ts src/server/probe.ts
```
Expected: error containing `src/domain may only import from @/domain and @/lib.` and `exit=1`.

- [ ] **Step 6: Commit**

```bash
git add -A ':!graft' ':!.ignore'
git commit -m "chore: add Vitest and import-boundary lint rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dev database container

**Files:**
- Create: `ops/compose.dev.yml`, `ops/dev/init.sql`, `.env.example`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: `DATABASE_URL` (`roofy_dev`) and `TEST_DATABASE_URL` (`roofy_test`) on `127.0.0.1:5440`; scripts `db:up`, `db:down`.

- [ ] **Step 1: Write the compose file**

`ops/compose.dev.yml`:

```yaml
name: roofy-dev
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: roofy
      POSTGRES_PASSWORD: roofy_dev_pw
      POSTGRES_DB: roofy_dev
    ports:
      - "127.0.0.1:5440:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./dev/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    mem_limit: 512m
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U roofy -d roofy_dev"]
      interval: 5s
      retries: 10
volumes:
  db-data: {}
```

`ops/dev/init.sql`:

```sql
CREATE DATABASE roofy_test OWNER roofy;
```

`.env.example`:

```bash
DATABASE_URL=postgres://roofy:roofy_dev_pw@127.0.0.1:5440/roofy_dev
TEST_DATABASE_URL=postgres://roofy:roofy_dev_pw@127.0.0.1:5440/roofy_test
```

```bash
cp .env.example .env.local
grep -qxF '.env*.local' .gitignore || echo '.env*.local' >> .gitignore
```

Add scripts:

```json
"db:up": "docker compose -f ops/compose.dev.yml up -d --wait",
"db:down": "docker compose -f ops/compose.dev.yml down"
```

- [ ] **Step 2: Confirm the port is free**

Run: `ss -tln | grep -c ':5440 ' || true` — Expected: `0`.

- [ ] **Step 3: Start and check both databases**

```bash
pnpm db:up
PGPASSWORD=roofy_dev_pw psql -h 127.0.0.1 -p 5440 -U roofy -d roofy_dev -Atc "select 1"
PGPASSWORD=roofy_dev_pw psql -h 127.0.0.1 -p 5440 -U roofy -d roofy_test -Atc "select current_database()"
```
Expected: `1` then `roofy_test`.

- [ ] **Step 4: Commit**

```bash
git add ops .env.example package.json .gitignore
git commit -m "chore: add dev Postgres 17 container on 127.0.0.1:5440

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Playwright with iPhone, Android and desktop projects

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: projects `iphone` (WebKit 390×844), `android` (Chromium 412×915), `desktop` (Chromium 1440×900); script `test:e2e`.

- [ ] **Step 1: Install**

```bash
pnpm add -D @playwright/test@^1.63 @axe-core/playwright
pnpm exec playwright install chromium webkit
pnpm exec playwright install-deps chromium webkit || sudo pnpm exec playwright install-deps chromium webkit
```

- [ ] **Step 2: Config**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } } },
    { name: "android", use: { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
```

Add script `"test:e2e": "playwright test"`; append to `.gitignore`: `test-results/` and `playwright-report/`.

- [ ] **Step 3: Write the smoke test**

`tests/e2e/smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home renders with the product name and no serious a11y issues", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Roofy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Roofy");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious).toEqual([]);
});
```

- [ ] **Step 4: Run on all three projects**

Run: `pnpm test:e2e` — Expected: `3 passed` (iphone, android, desktop).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests package.json pnpm-lock.yaml .gitignore
git commit -m "test: add Playwright with iPhone, Android and desktop projects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Design lint

**Files:**
- Create: `scripts/lint-design.ts`, `scripts/lint-design.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `lintSource(file: string, content: string): Finding[]`, `type Finding = { file: string; line: number; rule: RuleId; message: string }`; CLI `pnpm lint:design` scanning `src/` (exit 1 on findings). Suppression: a line `// design-lint-disable-next-line <rule-id> -- <reason>` (or `/* … */` in CSS) directly above.

- [ ] **Step 1: Write the failing tests**

`scripts/lint-design.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lintSource } from "./lint-design";

const rules = (file: string, src: string) => lintSource(file, src).map((f) => f.rule);

describe("design lint", () => {
  it("flags banned fonts", () => {
    expect(rules("src/app/layout.tsx", 'import { Inter } from "next/font/google";')).toContain("banned-font");
    expect(rules("src/app/x.css", "font-family: Roboto, sans-serif;")).toContain("banned-font");
    expect(rules("src/app/x.tsx", "const interval = 5; // font sizing")).not.toContain("banned-font");
  });
  it("flags all-caps labels", () => {
    expect(rules("src/a.tsx", '<span className="uppercase text-sm">')).toContain("uppercase");
    expect(rules("src/a.css", "text-transform: uppercase;")).toContain("uppercase");
  });
  it("flags letter-spaced labels including Tailwind v4 arbitrary values", () => {
    expect(rules("src/a.tsx", '<p className="tracking-widest">')).toContain("letter-spacing");
    expect(rules("src/a.tsx", '<p className="tracking-[0.2em]">')).toContain("letter-spacing");
    expect(rules("src/a.css", "letter-spacing: 0.1em;")).toContain("letter-spacing");
    expect(rules("src/a.tsx", '<p className="tracking-tight">')).not.toContain("letter-spacing");
  });
  it("flags arrow glyphs and middle-dot meta strings in UI files", () => {
    expect(rules("src/a.tsx", "<Button>Next →</Button>")).toContain("arrow-glyph");
    expect(rules("src/a.tsx", "<span>{a} · {b}</span>")).toContain("middot-meta");
  });
  it("flags lucide imports", () => {
    expect(rules("src/a.tsx", 'import { Check } from "lucide-react";')).toContain("lucide");
  });
  it("flags gradients in Tailwind v3/v4 and CSS", () => {
    expect(rules("src/a.tsx", '<div className="bg-gradient-to-r">')).toContain("gradient");
    expect(rules("src/a.tsx", '<div className="bg-linear-to-r">')).toContain("gradient");
    expect(rules("src/a.css", "background: linear-gradient(red, blue);")).toContain("gradient");
  });
  it("flags purple family utility classes", () => {
    expect(rules("src/a.tsx", '<div className="text-violet-600">')).toContain("purple");
  });
  it("flags raw colours outside tokens.css", () => {
    expect(rules("src/a.tsx", 'style={{ color: "#1f4fb5" }}')).toContain("raw-color");
    expect(rules("src/a.css", "color: rgb(0 0 0);")).toContain("raw-color");
    expect(rules("src/app/tokens.css", "--ink: #2f3133;")).not.toContain("raw-color");
  });
  it("flags emoji in UI files", () => {
    expect(rules("src/a.tsx", "<p>Done 🎉</p>")).toContain("emoji");
  });
  it("honours a justified suppression on the previous line only", () => {
    const src = [
      "// design-lint-disable-next-line raw-color -- brand colour for OS theme-color meta",
      'const themeColor = "#edefed";',
      'const other = "#ffffff";',
    ].join("\n");
    const findings = lintSource("src/app/manifest.ts", src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 3, rule: "raw-color" });
  });
  it("reports file and 1-based line numbers", () => {
    const f = lintSource("src/a.tsx", "ok\n<p className=\"uppercase\">");
    expect(f[0]).toMatchObject({ file: "src/a.tsx", line: 2, rule: "uppercase" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run scripts/lint-design.test.ts` — Expected: FAIL, cannot find module `./lint-design`.

- [ ] **Step 3: Implement**

`scripts/lint-design.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run scripts/lint-design.test.ts` — Expected: all pass.

- [ ] **Step 5: Add the script**

`package.json`: `"lint:design": "tsx scripts/lint-design.ts"`

- [ ] **Step 6: Commit**

```bash
git add scripts package.json
git commit -m "feat: add design lint enforcing DESIGN.md anti-patterns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: (folded check) Scaffold is clean**

Run: `pnpm lint:design` — Expected: `Design lint: clean.` If it reports scaffold leftovers (e.g. `src/app/page.tsx` classes or fonts), remove them and re-run.

- [ ] **Step 8: Add the combined verify script and run it**

`package.json`: `"verify": "pnpm typecheck && pnpm lint && pnpm lint:design && pnpm test:unit"`
Run: `pnpm verify` — Expected: every step succeeds. Commit:

```bash
git add package.json && git commit -m "chore: add pnpm verify

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Claude Code harness — CLAUDE.md, hooks, reviewer agent, progress log

**Files:**
- Create: `CLAUDE.md`, `.claude/settings.json`, `scripts/hooks/format-changed.mjs`, `scripts/hooks/stop-check.mjs`, `.claude/agents/spec-reviewer.md`, `docs/plans/PROGRESS.md`, `.prettierrc.json`, `.prettierignore`

**Interfaces:**
- Consumes: scripts `typecheck`, `test:unit`, `lint:design` from Tasks 1–5.
- Produces: automatic formatting/linting after every edit; a Stop gate on typecheck + unit tests; `spec-reviewer` agent used at every phase exit.

- [ ] **Step 1: Prettier**

```bash
pnpm add -D prettier eslint-config-prettier
```

`.prettierrc.json`:

```json
{ "printWidth": 110 }
```

`.prettierignore`:

```
graft/
pnpm-lock.yaml
.next/
test-results/
playwright-report/
```

- [ ] **Step 2: Format hook**

`scripts/hooks/format-changed.mjs`:

```js
// PostToolUse hook: format and lint the file Claude just edited. Exit 2 shows problems to Claude.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = input?.tool_input?.file_path;
if (!file || !existsSync(file) || file.includes("/graft/") || file.includes("/node_modules/")) process.exit(0);

const run = (args) => execFileSync("pnpm", ["exec", ...args], { stdio: "pipe", encoding: "utf8" });
try {
  if (/\.(ts|tsx|mjs|js|css|json|md)$/.test(file)) run(["prettier", "--write", file]);
  if (/\.(ts|tsx|mjs|js)$/.test(file)) run(["eslint", "--fix", file]);
} catch (err) {
  process.stderr.write(`Lint problems in ${file}:\n${err.stdout ?? ""}${err.stderr ?? ""}`);
  process.exit(2);
}
```

- [ ] **Step 3: Stop hook**

`scripts/hooks/stop-check.mjs`:

```js
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
```

- [ ] **Step 4: Register hooks**

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/format-changed.mjs\"" }]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/stop-check.mjs\"", "timeout": 300 }
        ]
      }
    ]
  }
}
```

Verify the loop guard: `echo '{"stop_hook_active":true}' | node scripts/hooks/stop-check.mjs; echo "exit=$?"` — Expected: `exit=0`.

- [ ] **Step 5: Prove the Stop gate blocks a type error**

```bash
echo 'export const broken: number = "nope";' > src/lib/broken.ts
echo '{}' | node scripts/hooks/stop-check.mjs; echo "exit=$?"
rm src/lib/broken.ts
```
Expected: message `Typecheck or unit tests are failing` and `exit=2`.

- [ ] **Step 6: Spec reviewer agent**

`.claude/agents/spec-reviewer.md`:

```markdown
---
name: spec-reviewer
description: Reviews a diff against Roofy's specs and plan. Use at the end of every task and phase. Reports only correctness and requirement gaps.
tools: Read, Grep, Glob, Bash
model: opus
---
You review changes to Roofy with fresh eyes. You did not write them.

Inputs you will be given: the task or phase plan section, the spec sections it cites, and the git range to review.

Do:
1. Run `git diff <range>` and read every changed file fully.
2. Check each requirement in the cited plan and spec sections: implemented, tested, and matching exact values (money examples must match to the cent).
3. Check the Global Constraints in docs/plans/00-master-plan.md and the phase plan's Review Focus.
4. Run `pnpm verify` and any test commands the plan names; include the output summary.

Report (max 400 words):
- BLOCKING: requirement missing/wrong, test missing for a stated rule, constraint broken, failing command. Give file:line and the spec line it violates.
- NON-BLOCKING: only if it affects correctness later.
Do not report style preferences, speculative refactors, or "consider adding" ideas. If nothing is blocking, say "No blocking issues" first.
```

- [ ] **Step 7: CLAUDE.md**

`CLAUDE.md`:

```markdown
# Roofy

Mobile-first crew and job costing PWA for Australian roofing businesses. Specs in `docs/specs/`, design system in `docs/design/DESIGN.md`, plans in `docs/plans/`. Read `docs/plans/PROGRESS.md` first; update it at the end of every session.

## Commands
- `pnpm dev` (port 3100) · `pnpm build` · `pnpm start`
- `pnpm verify` — typecheck, lint, design lint, unit tests. Must pass before any commit.
- `pnpm test:unit` · `pnpm test:coverage` (100% on src/domain) · `pnpm test:e2e` (iphone, android, desktop)
- `pnpm db:up` / `pnpm db:down` — dev Postgres on 127.0.0.1:5440 (`roofy_dev`, `roofy_test`)

## Rules
- IMPORTANT: all money maths lives in `src/domain` (pure TS). Money = integer cents; quantities/hours = integer hundredths; percentages = basis points. Never use floats for money.
- `src/domain` imports only `@/domain/*` and `@/lib/*`. UI (`src/components`) and `src/offline` never import `@/server/*`.
- Foreman-facing data never includes rates, amounts, budgets, margins or balances.
- Work dates are local dates in the workspace timezone; never use the server's local date.
- UI: only tokens, fonts and components from DESIGN.md; `pnpm lint:design` must be clean. Plain words, sentence case, verbs on buttons.
- TDD: failing test first. Pay-rule examples (E1.1…) are named tests.
- Every task ends with the `spec-reviewer` subagent; every phase ends with the phase gate in `docs/plans/00-master-plan.md`.
- Do not touch other Docker projects or nginx sites on this server. Ports 3000, 3005, 5434, 5439, 8080 belong to other projects.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- When compacting, keep: current phase and task, files changed, failing tests, open decisions.
```

- [ ] **Step 8: Progress log**

`docs/plans/PROGRESS.md`:

```markdown
# Progress

## Current
- Phase: 0 — Foundation (complete when this task's commit lands)
- Next: Phase 1 — Pay engine (`docs/plans/02-pay-engine.md`)

## Log
- 2026-09-28 — Specs, DESIGN.md, master plan, Phase 0/1 plans written.

## Decisions and deviations
- TypeScript pinned to ~6.0.3 (TS 7 native compiler not yet supported by Next.js tooling).

## Open issues
- None.
```

- [ ] **Step 9: Verify and commit**

```bash
pnpm exec prettier --write CLAUDE.md docs/plans/PROGRESS.md .claude/agents/spec-reviewer.md
pnpm verify
git add CLAUDE.md .claude scripts/hooks docs/plans/PROGRESS.md .prettierrc.json .prettierignore package.json pnpm-lock.yaml
git commit -m "chore: add Claude Code harness (CLAUDE.md, hooks, spec reviewer, progress log)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Phase gate**

Run `pnpm verify && pnpm test:e2e`, then dispatch the `spec-reviewer` agent on the Phase 0 range (`git log --oneline` from the scaffold commit to HEAD) with this plan and architecture §2/§3/§10/§11. Fix blocking issues; record results in `PROGRESS.md`.
