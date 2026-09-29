import type { MetadataRoute } from "next";
import { readGalv } from "./theme-colors";

/** The web app manifest (`/manifest.webmanifest`). Colours come from tokens.css (`--galv`, light). */
export default function manifest(): MetadataRoute.Manifest {
  const { light } = readGalv();
  return {
    name: "Roofy",
    short_name: "Roofy",
    description: "Crew and job costing for roofing businesses",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "en-AU",
    background_color: light,
    theme_color: light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
