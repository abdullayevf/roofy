import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { atkinson, barlow } from "./fonts";
import { readGalv } from "./theme-colors";
import { THEME_COOKIE, dataThemeFor, parseTheme } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roofy",
  description: "Crew and job costing for roofing businesses",
  applicationName: "Roofy",
  appleWebApp: { capable: true, title: "Roofy", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Next emits `mobile-web-app-capable`; older iOS only reads the Apple-prefixed name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

/**
 * `viewport-fit=cover` lets the layout draw under the notch and home indicator (it pads with
 * `env(safe-area-inset-*)`). The browser bar takes `galv` for the scheme in use: both, by media
 * query, when the theme follows the OS; the chosen one when the person overrode it.
 */
export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const galv = readGalv();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor:
      theme === "light"
        ? galv.light
        : theme === "dark"
          ? galv.dark
          : [
              { media: "(prefers-color-scheme: light)", color: galv.light },
              { media: "(prefers-color-scheme: dark)", color: galv.dark },
            ],
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en-AU"
      data-theme={dataThemeFor(theme)}
      className={`${barlow.variable} ${atkinson.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
