import localFont from "next/font/local";

// Self-hosted per DESIGN.md §3/§10: Barlow Semi Condensed for numbers, headings
// and tab labels; Atkinson Hyperlegible Next for body, inputs, buttons and
// lists. Files copied from @fontsource (latin subset only) into ./fonts.
// adjustFontFallback stays on (its default) to size the fallback metrics and
// reduce layout shift before each font loads.
export const barlow = localFont({
  src: [
    { path: "./fonts/barlow-semi-condensed-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-semi-condensed-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-semi-condensed-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
  // design-lint-disable-next-line banned-font
  adjustFontFallback: "Arial", // next/font/local's fallback-metrics option, not a brand font choice
});

export const atkinson = localFont({
  src: [
    { path: "./fonts/atkinson-hyperlegible-next-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-next-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-atkinson",
  display: "swap",
  // design-lint-disable-next-line banned-font
  adjustFontFallback: "Arial", // next/font/local's fallback-metrics option, not a brand font choice
});
