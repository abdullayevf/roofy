/** Theme override (DESIGN.md §8: follows the OS scheme; the user can override it in More). */
export type Theme = "system" | "light" | "dark";

export const THEME_COOKIE = "roofy_theme";
export const DEFAULT_THEME: Theme = "system";
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** A cookie value → a theme; anything unknown is "system". */
export function parseTheme(value: unknown): Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value)
    ? (value as Theme)
    : DEFAULT_THEME;
}

/** The `data-theme` attribute for <html>: none for "system" so tokens.css follows the OS. */
export function dataThemeFor(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
