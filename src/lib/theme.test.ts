import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_COOKIE, dataThemeFor, parseTheme, themeCookieString } from "./theme";

describe("theme choice", () => {
  it("uses the roofy_theme cookie", () => expect(THEME_COOKIE).toBe("roofy_theme"));
  it("accepts system, light and dark", () => {
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });
  it("falls back to system for anything else", () => {
    for (const v of [undefined, null, "", "Dark", "auto", 3, ["dark"]]) expect(parseTheme(v)).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("system");
  });
  it("sets data-theme only for an explicit choice", () => {
    expect(dataThemeFor("system")).toBeUndefined();
    expect(dataThemeFor("light")).toBe("light");
    expect(dataThemeFor("dark")).toBe("dark");
  });
  it("writes the same cookie the server action does, for a year, site-wide, so the choice works offline", () => {
    expect(themeCookieString("dark")).toBe("roofy_theme=dark; path=/; max-age=31536000; samesite=lax");
    expect(themeCookieString("system")).toBe("roofy_theme=system; path=/; max-age=31536000; samesite=lax");
    expect(themeCookieString("purple" as never)).toBe("roofy_theme=system; path=/; max-age=31536000; samesite=lax");
  });
});
