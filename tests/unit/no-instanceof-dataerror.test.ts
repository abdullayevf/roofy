import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// In the production build the db services load from instrumentation.ts, a separate bundle with its own copy of
// src/data/contracts.ts, so `x instanceof DataError` is false for an error the other copy threw (see 55f7277).
// Code must call isDataError, which checks a brand shared across copies.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("DataError recognition", () => {
  it("never uses instanceof DataError in src or scripts (use isDataError)", () => {
    const offenders = [...sourceFiles("src"), ...sourceFiles("scripts")].flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((text, i) => ({ file, line: i + 1, text: text.trim() }))
        .filter(({ text }) => !text.startsWith("*") && !text.startsWith("//") && /instanceof\s+DataError\b/.test(text))
        .map(({ file: f, line }) => `${f}:${line}`),
    );
    expect(offenders).toEqual([]);
  });
});
