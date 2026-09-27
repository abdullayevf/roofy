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
  ]),
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
  eslintConfigPrettier,
]);

export default eslintConfig;
