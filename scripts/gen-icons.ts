/**
 * Renders `scripts/icon.svg` to the app's PNG icons with Playwright's Chromium:
 *   src/app/icon.png (512, the browser-tab icon), src/app/apple-icon.png (180, home-screen icon),
 *   public/icons/icon-192.png, icon-512.png (purpose "any") and icon-maskable-512.png (purpose "maskable").
 * The art is full-bleed with the mark inside the maskable safe zone, so one SVG serves every purpose.
 * Run `pnpm icons:gen`; the PNGs are committed. Honours ROOFY_CHROMIUM_EXECUTABLE.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

export type IconTarget = { file: string; size: number };

export const ICON_TARGETS: IconTarget[] = [
  { file: "src/app/icon.png", size: 512 },
  { file: "src/app/apple-icon.png", size: 180 },
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/icons/icon-maskable-512.png", size: 512 },
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function generateIcons(): Promise<void> {
  const svg = readFileSync(join(root, "scripts", "icon.svg"), "utf8");
  const executablePath = process.env.ROOFY_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const { file, size } of ICON_TARGETS) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(
        `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
      );
      const png = await page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
      const out = join(root, file);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, png);
      await page.close();
      console.log(`${file} (${size}x${size})`);
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  generateIcons().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
