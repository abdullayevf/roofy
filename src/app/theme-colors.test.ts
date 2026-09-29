import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseGalv, readGalv } from "./theme-colors";

const CSS = `
:root { color-scheme: light; --galv: #edefed; --surface: #ffffff; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --galv: #1f2224; --surface: #2a2e30; }
}
:root[data-theme="dark"] { --galv: #1f2224; }
`;

describe("parseGalv", () => {
  it("reads the light galv from :root and the dark galv from the dark media block", () => {
    expect(parseGalv(CSS)).toEqual({ light: "#edefed", dark: "#1f2224" });
  });
  it("refuses a file without both", () => {
    expect(() => parseGalv(":root { --galv: #edefed; }")).toThrow(/dark/);
    expect(() => parseGalv("@media (prefers-color-scheme: dark) { :root { --galv: #111111; } }")).toThrow(/light/);
  });
});

describe("readGalv", () => {
  it("matches the real tokens.css (theme-colors.json has not drifted)", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "tokens.css"), "utf8");
    expect(readGalv()).toEqual(parseGalv(css));
  });
  it("gives two different hex colours", () => {
    const g = readGalv();
    expect(g.light).toMatch(/^#[0-9a-f]{6}$/i);
    expect(g.dark).toMatch(/^#[0-9a-f]{6}$/i);
    expect(g.light).not.toBe(g.dark);
  });
});
