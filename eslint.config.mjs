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
          ],
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
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
]);

export default eslintConfig;
