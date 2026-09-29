"use server";
/**
 * The theme choice (More → Theme): a `roofy_theme` cookie that the root layout turns into
 * `data-theme` on <html> on the server, so there is no flash. Not HTTP-only or secret; it is a
 * display preference, not a session.
 */
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

export async function setTheme(theme: Theme): Promise<void> {
  const jar = await cookies();
  jar.set(THEME_COOKIE, parseTheme(theme), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
