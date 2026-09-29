/**
 * The manifest and the `theme-color` meta need literal colours, but raw colours may live only in
 * `tokens.css` (design lint). So this reads `--galv` out of tokens.css itself: the light value from
 * `:root`, the dark value from the `prefers-color-scheme: dark` block. Server-only (uses `fs`); the
 * result is cached for the life of the process. tokens.css ships with the app (`next start` runs
 * from the repo), so it is there at build and at run time.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

let cached: GalvColors | undefined;

export function readGalv(): GalvColors {
  cached ??= parseGalv(readFileSync(join(process.cwd(), "src", "app", "tokens.css"), "utf8"));
  return cached;
}
