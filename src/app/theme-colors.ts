/**
 * The manifest and the `theme-color` meta need literal colours, but raw colours may live only in
 * `tokens.css` (design lint). `theme-colors.json` holds the two `--galv` values, generated from
 * tokens.css by `scripts/gen-theme-colors.ts` (`pnpm tokens:gen`, checked by `pnpm tokens:check`),
 * so nothing reads `src/` at run time. `parseGalv` is the parser the script and tests use.
 */
import galv from "./theme-colors.json";

export interface GalvColors {
  light: string;
  dark: string;
}

const DECLARATION = /--galv:\s*(#[0-9a-fA-F]{3,8})\s*;/;

export function parseGalv(css: string): GalvColors {
  const darkAt = css.indexOf("prefers-color-scheme: dark");
  const light = DECLARATION.exec(darkAt === -1 ? css : css.slice(0, darkAt))?.[1];
  const dark = darkAt === -1 ? undefined : DECLARATION.exec(css.slice(darkAt))?.[1];
  if (!light) throw new Error("tokens.css has no light --galv colour.");
  if (!dark) throw new Error("tokens.css has no dark --galv colour.");
  return { light, dark };
}

/** The generated colours (`pnpm tokens:gen` writes theme-colors.json from tokens.css), bundled at build time. */
export function readGalv(): GalvColors {
  return galv;
}
