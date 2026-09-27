import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roofy",
  description: "Crew and job costing for roofing businesses",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
