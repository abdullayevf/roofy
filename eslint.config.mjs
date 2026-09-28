import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    // Other agents' git worktrees live under here — their own working
    // trees lint themselves; this repo's `eslint .` shouldn't reach in.
    ".claude/worktrees/**",
  ]),
  {
    files: ["src/domain/**/*.{ts,tsx}"],
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
              // Note: written as `^node:|^(fs|...)(/|$)` rather than the flat
              // `^(node:|fs|...)(/|$)` form, because the flat form never matches
              // "node:fs"-style specifiers (the "(/|$)" suffix applies to whichever
              // alternative matched, and "fs" follows "node:" with no separator).
              regex:
                "^(react|react-dom|next|drizzle-orm|pg|postgres|dexie|zod|node:|(fs|path|os|child_process|http|https|net|crypto)(/|$))",
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
        {
          patterns: [
            { regex: "^@/server(/|$)", message: "UI and offline code must not import server code." },
            {
              regex: "^@/data/fake(/|$)",
              message: "UI and offline code must not import the fake data layer directly.",
            },
            {
              // getData() and the session cookies are server-only; components get data as props
              // and may import types from @/data/contracts.
              regex: "^@/data(/index|/session)?$",
              message: "UI and offline code must not import getData or the session; take data as props.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/data/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ regex: "^@/server(/|$)", message: "src/data must not import server code." }],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src/domain", from: "./src", except: ["./domain", "./lib"] },
            { target: ["./src/components", "./src/offline"], from: "./src/server" },
            { target: ["./src/components", "./src/offline"], from: "./src/data/fake" },
            { target: "./src/data", from: "./src/server" },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
]);

export default eslintConfig;
