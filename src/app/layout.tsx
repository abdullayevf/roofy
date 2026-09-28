import type { Metadata } from "next";
import { atkinson, barlow } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roofy",
  description: "Crew and job costing for roofing businesses",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={`${barlow.variable} ${atkinson.variable}`}>
      <body>{children}</body>
    </html>
  );
}
