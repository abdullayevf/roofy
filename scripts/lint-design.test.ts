import { describe, expect, it } from "vitest";
import { lintSource } from "./lint-design";

const rules = (file: string, src: string) => lintSource(file, src).map((f) => f.rule);

describe("design lint", () => {
  it("flags banned fonts", () => {
    expect(rules("src/app/layout.tsx", 'import { Inter } from "next/font/google";')).toContain("banned-font");
    expect(rules("src/app/x.css", "font-family: Roboto, sans-serif;")).toContain("banned-font");
    expect(rules("src/app/x.tsx", "const interval = 5; // font sizing")).not.toContain("banned-font");
  });
  it("flags banned fonts case-insensitively, including geist variants", () => {
    expect(rules("src/app/x.css", "font-family: geist, sans-serif;")).toContain("banned-font");
    expect(rules("src/app/x.css", "font-family: ROBOTO, sans-serif;")).toContain("banned-font");
    expect(rules("src/app/fonts.ts", 'import { GeistSans } from "geist/font/sans";')).toContain(
      "banned-font",
    );
    expect(rules("src/app/fonts.ts", "const GeistMono = loadFont();")).toContain("banned-font");
    expect(rules("src/app/x.tsx", "const sync = useSync(); // not a font")).not.toContain("banned-font");
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
    expect(rules("src/a.tsx", '<p className="tracking-tighter">')).not.toContain("letter-spacing");
  });
  it("flags tracking-[…px|rem|em] arbitrary values other than tracking-[0]", () => {
    expect(rules("src/a.tsx", '<p className="tracking-[2px]">')).toContain("letter-spacing");
    expect(rules("src/a.tsx", '<p className="tracking-[0.05rem]">')).toContain("letter-spacing");
    expect(rules("src/a.tsx", '<p className="tracking-[0]">')).not.toContain("letter-spacing");
  });
  it("flags non-zero CSS letter-spacing in px/rem/em but allows zero", () => {
    expect(rules("src/a.css", "letter-spacing: 2px;")).toContain("letter-spacing");
    expect(rules("src/a.css", "letter-spacing: 1rem;")).toContain("letter-spacing");
    expect(rules("src/a.css", "letter-spacing: 0px;")).not.toContain("letter-spacing");
    expect(rules("src/a.css", "letter-spacing: 0;")).not.toContain("letter-spacing");
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
  it("flags bare bg-radial/bg-conic with no dash suffix", () => {
    expect(rules("src/a.tsx", '<div className="bg-radial">')).toContain("gradient");
    expect(rules("src/a.tsx", '<div className="bg-conic">')).toContain("gradient");
    expect(rules("src/a.tsx", '<div className="bg-radial-[at_top]">')).toContain("gradient");
  });
  it("flags purple family utility classes", () => {
    expect(rules("src/a.tsx", '<div className="text-violet-600">')).toContain("purple");
  });
  it("flags raw colours outside tokens.css", () => {
    expect(rules("src/a.tsx", 'style={{ color: "#1f4fb5" }}')).toContain("raw-color");
    expect(rules("src/a.css", "color: rgb(0 0 0);")).toContain("raw-color");
    expect(rules("src/app/tokens.css", "--ink: #2f3133;")).not.toContain("raw-color");
  });
  it("does not flag href fragment links as raw colours", () => {
    expect(rules("src/a.tsx", '<a href="#faded">Skip</a>')).not.toContain("raw-color");
    expect(rules("src/a.tsx", "<a href='#faded'>Skip</a>")).not.toContain("raw-color");
  });
  it("only flags raw colours with 3, 4, 6 or 8 hex digits in a colour context", () => {
    expect(rules("src/a.css", "color: #fff;")).toContain("raw-color");
    expect(rules("src/a.css", "color: #ffff;")).toContain("raw-color");
    expect(rules("src/a.css", "color: #ffffff;")).toContain("raw-color");
    expect(rules("src/a.css", "color: #ffffffff;")).toContain("raw-color");
    expect(rules("src/a.tsx", 'style={{ color: "#12345" }}')).not.toContain("raw-color");
    expect(rules("src/a.tsx", 'style={{ color: "#1234567" }}')).not.toContain("raw-color");
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
    const f = lintSource("src/a.tsx", 'ok\n<p className="uppercase">');
    expect(f[0]).toMatchObject({ file: "src/a.tsx", line: 2, rule: "uppercase" });
  });
  it("bans shadow classes except shadow-sheet, shadow-toast and shadow-none", () => {
    expect(rules("src/a.tsx", '<div className="shadow-md">')).toContain("shadow");
    expect(rules("src/a.tsx", '<div className="hover:shadow-lg">')).toContain("shadow");
    expect(rules("src/a.tsx", '<div className="shadow-[0_2px_4px_rgba(0,0,0,.2)]">')).toContain("shadow");
    expect(rules("src/a.tsx", '<div className="shadow-sheet">')).not.toContain("shadow");
    expect(rules("src/a.tsx", '<div className="shadow-toast">')).not.toContain("shadow");
    expect(rules("src/a.tsx", '<div className="shadow-none">')).not.toContain("shadow");
  });
  it("bans pulse/shimmer loading animation", () => {
    expect(rules("src/a.tsx", '<div className="animate-pulse">')).toContain("shimmer");
    expect(rules("src/a.tsx", '<div className="animate-shimmer">')).toContain("shimmer");
    expect(rules("src/a.tsx", '<div className="animate-spin">')).not.toContain("shimmer");
  });
  it("bans font-mono", () => {
    expect(rules("src/a.tsx", '<p className="font-mono">')).toContain("font-mono");
    expect(rules("src/a.tsx", '<p className="font-body">')).not.toContain("font-mono");
  });
  it("bans hard-coded px outside the spacing scale in Tailwind arbitrary values", () => {
    expect(rules("src/a.tsx", '<div className="p-[13px]">')).toContain("hard-px");
    expect(rules("src/a.tsx", '<div className="w-[13px]">')).toContain("hard-px");
    expect(rules("src/a.tsx", '<div className="p-[16px]">')).not.toContain("hard-px");
    expect(rules("src/a.tsx", '<div className="w-[240px]">')).not.toContain("hard-px");
    expect(rules("src/a.tsx", '<div className="gap-x-[1.5px]">')).not.toContain("hard-px");
    expect(rules("src/a.tsx", '<div className="-mt-[13px]">')).toContain("hard-px");
  });
  it("bans jargon words in JSX text and label/title/aria-label props, but not code identifiers", () => {
    expect(rules("src/a.tsx", "<button>Submit</button>")).toContain("jargon");
    expect(rules("src/a.tsx", '<Field label="Mutation log" />')).toContain("jargon");
    expect(rules("src/a.tsx", '<Input aria-label="Sync now" />')).toContain("jargon");
    expect(rules("src/a.tsx", '<Dialog title="Entity details" />')).toContain("jargon");
    expect(rules("src/a.tsx", "const sync = isSynced(a, b);")).not.toContain("jargon");
    expect(rules("src/a.tsx", '<input type="submit" />')).not.toContain("jargon");
    expect(rules("src/a.tsx", "<button onSubmit={handleSubmit}>Save</button>")).not.toContain("jargon");
    expect(rules("src/a.tsx", "const { data } = useSync();")).not.toContain("jargon");
  });
});
