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
